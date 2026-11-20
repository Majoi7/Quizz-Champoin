import express from 'express';
import {
  applyScoreMutation,
  createParticipant,
  deleteParticipant,
  getCompetition,
  getFullQuizState,
  getRankedParticipants,
  getRecentEvents,
  resetCompetitionData,
  resetSingleParticipantScore,
  undoLastScoreOperation,
  updateCompetitionConfig,
  updateParticipantDetails,
} from './db.ts';
import { requireAdmin, type AuthRequest } from '../src/middleware/auth.ts';
import type { ServerWsMessage } from '../src/types/quiz.ts';

export interface CreateApiAppOptions {
  onBroadcast?: (message: ServerWsMessage) => void;
}

export function createApiApp(options: CreateApiAppOptions = {}): express.Express {
  const app = express();

  app.use((req, _res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const reqWithFlag = req as express.Request & { _body?: boolean };
      try {
        if (req.body !== undefined && !reqWithFlag._body) {
          reqWithFlag._body = true;
        }
      } catch {
        // Ignore lazy getter errors on malformed pre-parsed bodies; express.json will handle or error cleanly
      }
    }
    next();
  });
  app.use(express.json({ limit: '4mb' }));

  const handleInfraError = (err: unknown, res: express.Response): boolean => {
    const code = err instanceof Error ? err.message : '';
    if (code === 'DATABASE_NOT_CONFIGURED') {
      res.status(503).json({
        error:
          'Base de données non configurée. Ajoutez SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY dans vos variables d’environnement.',
      });
      return true;
    }
    if (code === 'SUPABASE_SCHEMA_MISSING') {
      res.status(503).json({
        error:
          'Les tables Supabase ne sont pas encore créées. Exécutez supabase/schema.sql dans votre SQL Editor Supabase.',
      });
      return true;
    }
    if (code === 'SUPABASE_RLS_BLOCKED') {
      res.status(503).json({
        error:
          'Droits d’écriture Supabase insuffisants : ajoutez SUPABASE_SERVICE_ROLE_KEY dans vos variables serveur.',
      });
      return true;
    }
    return false;
  };

  const broadcast = (message: ServerWsMessage) => {
    try {
      options.onBroadcast?.(message);
    } catch (err) {
      console.warn('[api] Broadcast error ignored:', err);
    }
  };

  function parseBodyObject(body: unknown): Record<string, unknown> {
    if (!body) return {};
    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
      } catch {
        return {};
      }
    }
    if (Buffer.isBuffer(body)) {
      try {
        const parsed = JSON.parse(body.toString('utf8'));
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
      } catch {
        return {};
      }
    }
    return typeof body === 'object' ? (body as Record<string, unknown>) : {};
  }

  // Healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, serverTime: new Date().toISOString() });
  });

  // Public Supabase Realtime config (public anon key only, never service role key)
  app.get('/api/realtime-config', (_req, res) => {
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
    const supabaseAnonKey = (
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      ''
    ).trim();
    const wsEnabled = !process.env.VERCEL;
    res.json({
      supabaseUrl: supabaseUrl || null,
      supabaseAnonKey: supabaseAnonKey || null,
      wsEnabled,
    });
  });

  // Public endpoints
  app.get('/api/state', async (_req, res) => {
    try {
      res.json(await getFullQuizState());
    } catch (error) {
      console.error('[GET /api/state] error:', error);
      res.status(500).json({ error: 'Impossible de charger l’état en direct.' });
    }
  });

  app.get('/api/participants/:id', async (req, res) => {
    try {
      const ranked = await getRankedParticipants();
      const participant = ranked.find((p) => p.id === req.params.id);
      if (!participant) {
        res.status(404).json({ error: 'Participant introuvable.' });
        return;
      }
      const [allEvents, competition] = await Promise.all([getRecentEvents(200), getCompetition()]);
      const events = allEvents.filter((e) => e.participant_id === participant.id);
      res.json({
        participant,
        leaderScore: ranked[0]?.score ?? 0,
        totalParticipants: ranked.length,
        events,
        competition,
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[GET /api/participants/:id] error:', error);
      res.status(500).json({ error: 'Impossible de charger la fiche participant.' });
    }
  });

  app.post('/api/register', async (req, res) => {
    try {
      const body = parseBodyObject(req.body);
      const created = await createParticipant({
        first_name: typeof body.first_name === 'string' ? body.first_name : String(body.first_name ?? ''),
        last_name: typeof body.last_name === 'string' ? body.last_name : String(body.last_name ?? ''),
        nickname: typeof body.nickname === 'string' ? body.nickname : null,
        phone: typeof body.phone === 'string' ? body.phone : null,
        avatar_url: typeof body.avatar_url === 'string' ? body.avatar_url : null,
      });

      const participants = await getRankedParticipants();
      broadcast({
        type: 'participants:updated',
        payload: {
          participants,
          serverTime: new Date().toISOString(),
        },
      });

      res.status(201).json({ participant: created });
    } catch (err) {
      const code = err instanceof Error ? err.message : 'UNKNOWN';
      if (code === 'REGISTRATIONS_CLOSED') {
        res.status(403).json({ error: 'Les inscriptions sont actuellement fermées par la régie.' });
        return;
      }
      if (code === 'INVALID_NAME') {
        res.status(400).json({ error: 'Veuillez saisir un prénom et un nom valides (2 caractères min.).' });
        return;
      }
      if (code === 'PHONE_REQUIRED') {
        res.status(400).json({ error: 'Le numéro de téléphone est obligatoire pour cette session.' });
        return;
      }
      if (code === 'INVALID_AVATAR') {
        res.status(400).json({ error: "L'image de profil est invalide ou trop volumineuse." });
        return;
      }
      if (code === 'DUPLICATE_PARTICIPANT') {
        res.status(409).json({ error: 'Un participant portant ce nom et prénom est déjà inscrit.' });
        return;
      }
      if (code === 'DUPLICATE_PHONE') {
        res.status(409).json({ error: 'Ce numéro de téléphone est déjà associé à un participant.' });
        return;
      }
      if (handleInfraError(err, res)) {
        return;
      }
      console.error('[POST /api/register] unexpected error:', err);
      res.status(500).json({ error: "Erreur lors de l'inscription." });
    }
  });

  // Admin Authentication (Firebase ID Token)
  app.get('/api/admin/me', requireAdmin, (req: AuthRequest, res) => {
    res.json({ admin: req.admin });
  });

  // Admin Participant & Scoring Mutations
  app.post('/api/admin/participants', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const body = parseBodyObject(req.body);
      const created = await createParticipant(
        {
          first_name: typeof body.first_name === 'string' ? body.first_name : String(body.first_name ?? ''),
          last_name: typeof body.last_name === 'string' ? body.last_name : String(body.last_name ?? ''),
          nickname: typeof body.nickname === 'string' ? body.nickname : null,
          phone: typeof body.phone === 'string' ? body.phone : null,
          avatar_url: typeof body.avatar_url === 'string' ? body.avatar_url : null,
        },
        { bypassRegistrationLock: true }
      );
      const participants = await getRankedParticipants();
      broadcast({
        type: 'participants:updated',
        payload: {
          participants,
          serverTime: new Date().toISOString(),
        },
      });
      res.status(201).json({ participant: created });
    } catch (err) {
      const code = err instanceof Error ? err.message : 'UNKNOWN';
      if (code === 'INVALID_NAME') {
        res.status(400).json({ error: 'Prénom et nom requis (2 caractères minimum).' });
        return;
      }
      if (code === 'INVALID_AVATAR') {
        res.status(400).json({ error: "L'image de profil est invalide ou trop volumineuse." });
        return;
      }
      if (code === 'DUPLICATE_PARTICIPANT') {
        res.status(409).json({ error: 'Ce participant existe déjà.' });
        return;
      }
      if (code === 'DUPLICATE_PHONE') {
        res.status(409).json({ error: 'Ce numéro de téléphone est déjà utilisé.' });
        return;
      }
      if (handleInfraError(err, res)) {
        return;
      }
      console.error('[POST /api/admin/participants] unexpected error:', err);
      res.status(500).json({ error: 'Impossible de créer le participant.' });
    }
  });

  app.patch('/api/admin/participants/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const updated = await updateParticipantDetails(req.params.id, parseBodyObject(req.body));
      const participants = await getRankedParticipants();
      broadcast({
        type: 'participants:updated',
        payload: {
          participants,
          serverTime: new Date().toISOString(),
        },
      });
      res.json({ participant: updated });
    } catch (err) {
      const code = err instanceof Error ? err.message : 'UNKNOWN';
      if (code === 'NOT_FOUND') {
        res.status(404).json({ error: 'Participant introuvable.' });
        return;
      }
      if (code === 'DUPLICATE_PARTICIPANT') {
        res.status(409).json({ error: 'Un autre participant porte déjà ce nom.' });
        return;
      }
      res.status(400).json({ error: 'Mise à jour impossible.' });
    }
  });

  app.delete('/api/admin/participants/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      await deleteParticipant(req.params.id);
      const participants = await getRankedParticipants();
      broadcast({
        type: 'participants:updated',
        payload: {
          participants,
          serverTime: new Date().toISOString(),
        },
      });
      res.json({ ok: true });
    } catch {
      res.status(404).json({ error: 'Participant introuvable.' });
    }
  });

  app.post('/api/admin/score', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const body = parseBodyObject(req.body);
      const participantId = String(body.participantId ?? '');
      const delta = Number(body.delta);
      const reason = (body.reason as Parameters<typeof applyScoreMutation>[2]) ?? 'CUSTOM';
      const result = await applyScoreMutation(
        participantId,
        delta,
        reason,
        req.admin?.name ?? 'Administrateur'
      );

      broadcast({
        type: 'score:applied',
        payload: {
          ...result,
          serverTime: new Date().toISOString(),
        },
      });

      res.json(result);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'UNKNOWN';
      if (code === 'PARTICIPANT_DISQUALIFIED') {
        res.status(400).json({ error: 'Impossible de modifier le score d’un participant disqualifié.' });
        return;
      }
      if (code === 'INVALID_DELTA') {
        res.status(400).json({ error: 'La variation de score doit être non nulle.' });
        return;
      }
      if (code === 'NOT_FOUND') {
        res.status(404).json({ error: 'Participant introuvable.' });
        return;
      }
      if (handleInfraError(err, res)) {
        return;
      }
      console.error('[POST /api/admin/score] error:', err);
      res.status(500).json({ error: 'Erreur lors de la mise à jour du score.' });
    }
  });

  app.post('/api/admin/participants/:id/reset', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const result = await resetSingleParticipantScore(
        req.params.id,
        req.admin?.name ?? 'Administrateur'
      );
      broadcast({
        type: 'score:applied',
        payload: {
          ...result,
          serverTime: new Date().toISOString(),
        },
      });
      res.json(result);
    } catch {
      res.status(404).json({ error: 'Participant introuvable.' });
    }
  });

  app.post('/api/admin/undo', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const result = await undoLastScoreOperation(req.admin?.name ?? 'Administrateur');
      broadcast({
        type: 'score:applied',
        payload: {
          ...result,
          serverTime: new Date().toISOString(),
        },
      });
      res.json(result);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'UNKNOWN';
      if (code === 'NOTHING_TO_UNDO') {
        res.status(400).json({ error: 'Aucune opération récente à annuler.' });
        return;
      }
      res.status(400).json({ error: 'Impossible d’annuler cette opération.' });
    }
  });

  app.patch('/api/admin/competition', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const competition = await updateCompetitionConfig(parseBodyObject(req.body));
      const participants = await getRankedParticipants();
      broadcast({
        type: 'competition:updated',
        payload: {
          competition,
          participants,
          serverTime: new Date().toISOString(),
        },
      });
      res.json({ competition, participants });
    } catch (error) {
      if (handleInfraError(error, res)) return;
      console.error('[PATCH /api/admin/competition] error:', error);
      res.status(500).json({ error: 'Impossible de mettre à jour la compétition.' });
    }
  });

  app.post('/api/admin/competition/reset', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const body = parseBodyObject(req.body);
      const mode = body.mode === 'full' ? 'full' : 'scores';
      await resetCompetitionData(mode);
      const fullState = await getFullQuizState();
      broadcast({
        type: 'state:sync',
        payload: fullState,
      });
      res.json(fullState);
    } catch (error) {
      if (handleInfraError(error, res)) return;
      console.error('[POST /api/admin/competition/reset] error:', error);
      res.status(500).json({ error: 'Impossible de réinitialiser la compétition.' });
    }
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const errObj = err as { type?: string; status?: number } | null;
    if (errObj?.type === 'entity.too.large' || errObj?.status === 413) {
      res.status(413).json({ error: 'La photo ou les données envoyées sont trop volumineuses.' });
      return;
    }
    if (errObj?.type === 'entity.parse.failed' || errObj?.status === 400) {
      res.status(400).json({ error: 'Requête JSON invalide.' });
      return;
    }
    console.error('[API error middleware]', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  });

  return app;
}
