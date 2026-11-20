import express from 'express';
import {
  applyScoreMutation,
  authenticateAdmin,
  createParticipant,
  deleteParticipant,
  getAdminByToken,
  getCompetition,
  getFullQuizState,
  getRankedParticipants,
  getRecentEvents,
  initDatabase,
  resetCompetitionData,
  resetSingleParticipantScore,
  revokeAdminSession,
  undoLastScoreOperation,
  updateCompetitionConfig,
  updateParticipantDetails,
} from './db';
import type { AdminUser, ServerWsMessage } from '../src/types/quiz';

interface AuthedRequest extends express.Request {
  admin?: AdminUser;
  authToken?: string;
}

export interface CreateApiAppOptions {
  onBroadcast?: (message: ServerWsMessage) => void;
}

export function createApiApp(options: CreateApiAppOptions = {}): express.Express {
  initDatabase();

  const app = express();
  app.use((req, _res, next) => {
    const reqWithFlag = req as express.Request & { _body?: boolean };
    if (req.body !== undefined && !reqWithFlag._body) {
      reqWithFlag._body = true;
    }
    next();
  });
  app.use(express.json({ limit: '4mb' }));

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

  function requireAdmin(
    req: AuthedRequest,
    res: express.Response,
    next: express.NextFunction
  ): void {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    const admin = getAdminByToken(token);
    if (!admin) {
      res.status(401).json({ error: 'Authentification administrateur requise.' });
      return;
    }
    req.admin = admin;
    req.authToken = token;
    next();
  }

  // Healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, serverTime: new Date().toISOString() });
  });

  // Public endpoints
  app.get('/api/state', (_req, res) => {
    res.json(getFullQuizState());
  });

  app.get('/api/participants/:id', (req, res) => {
    const ranked = getRankedParticipants();
    const participant = ranked.find((p) => p.id === req.params.id);
    if (!participant) {
      res.status(404).json({ error: 'Participant introuvable.' });
      return;
    }
    const events = getRecentEvents(200).filter((e) => e.participant_id === participant.id);
    const competition = getCompetition();
    res.json({
      participant,
      leaderScore: ranked[0]?.score ?? 0,
      totalParticipants: ranked.length,
      events,
      competition,
      serverTime: new Date().toISOString(),
    });
  });

  app.post('/api/register', (req, res) => {
    try {
      const body = parseBodyObject(req.body);
      const created = createParticipant({
        first_name: typeof body.first_name === 'string' ? body.first_name : String(body.first_name ?? ''),
        last_name: typeof body.last_name === 'string' ? body.last_name : String(body.last_name ?? ''),
        nickname: typeof body.nickname === 'string' ? body.nickname : null,
        phone: typeof body.phone === 'string' ? body.phone : null,
        avatar_url: typeof body.avatar_url === 'string' ? body.avatar_url : null,
      });

      broadcast({
        type: 'participants:updated',
        payload: {
          participants: getRankedParticipants(),
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
      console.error('[POST /api/register] unexpected error:', err);
      res.status(500).json({ error: "Erreur lors de l'inscription." });
    }
  });

  // Admin Authentication
  app.post('/api/admin/login', (req, res) => {
    const email = String(req.body?.email ?? '');
    const passcode = String(req.body?.passcode ?? '');
    const auth = authenticateAdmin(email, passcode);
    if (!auth) {
      res.status(401).json({ error: 'Identifiants de régie invalides.' });
      return;
    }
    res.json(auth);
  });

  app.get('/api/admin/me', requireAdmin, (req: AuthedRequest, res) => {
    res.json({ admin: req.admin });
  });

  app.post('/api/admin/logout', requireAdmin, (req: AuthedRequest, res) => {
    if (req.authToken) revokeAdminSession(req.authToken);
    res.json({ ok: true });
  });

  // Admin Participant & Scoring Mutations
  app.post('/api/admin/participants', requireAdmin, (req: AuthedRequest, res) => {
    try {
      const body = parseBodyObject(req.body);
      const created = createParticipant(
        {
          first_name: typeof body.first_name === 'string' ? body.first_name : String(body.first_name ?? ''),
          last_name: typeof body.last_name === 'string' ? body.last_name : String(body.last_name ?? ''),
          nickname: typeof body.nickname === 'string' ? body.nickname : null,
          phone: typeof body.phone === 'string' ? body.phone : null,
          avatar_url: typeof body.avatar_url === 'string' ? body.avatar_url : null,
        },
        { bypassRegistrationLock: true }
      );
      broadcast({
        type: 'participants:updated',
        payload: {
          participants: getRankedParticipants(),
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
      console.error('[POST /api/admin/participants] unexpected error:', err);
      res.status(500).json({ error: 'Impossible de créer le participant.' });
    }
  });

  app.patch('/api/admin/participants/:id', requireAdmin, (req: AuthedRequest, res) => {
    try {
      const updated = updateParticipantDetails(req.params.id, req.body ?? {});
      broadcast({
        type: 'participants:updated',
        payload: {
          participants: getRankedParticipants(),
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

  app.delete('/api/admin/participants/:id', requireAdmin, (req: AuthedRequest, res) => {
    try {
      deleteParticipant(req.params.id);
      broadcast({
        type: 'participants:updated',
        payload: {
          participants: getRankedParticipants(),
          serverTime: new Date().toISOString(),
        },
      });
      res.json({ ok: true });
    } catch {
      res.status(404).json({ error: 'Participant introuvable.' });
    }
  });

  app.post('/api/admin/score', requireAdmin, (req: AuthedRequest, res) => {
    try {
      const participantId = String(req.body?.participantId ?? '');
      const delta = Number(req.body?.delta);
      const reason = req.body?.reason ?? 'CUSTOM';
      const result = applyScoreMutation(
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
      res.status(404).json({ error: 'Participant introuvable.' });
    }
  });

  app.post('/api/admin/participants/:id/reset', requireAdmin, (req: AuthedRequest, res) => {
    try {
      const result = resetSingleParticipantScore(
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

  app.post('/api/admin/undo', requireAdmin, (req: AuthedRequest, res) => {
    try {
      const result = undoLastScoreOperation(req.admin?.name ?? 'Administrateur');
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

  app.patch('/api/admin/competition', requireAdmin, (req: AuthedRequest, res) => {
    const competition = updateCompetitionConfig(req.body ?? {});
    const participants = getRankedParticipants();
    broadcast({
      type: 'competition:updated',
      payload: {
        competition,
        participants,
        serverTime: new Date().toISOString(),
      },
    });
    res.json({ competition, participants });
  });

  app.post('/api/admin/competition/reset', requireAdmin, (req: AuthedRequest, res) => {
    const mode = req.body?.mode === 'full' ? 'full' : 'scores';
    resetCompetitionData(mode);
    const fullState = getFullQuizState();
    broadcast({
      type: 'state:sync',
      payload: fullState,
    });
    res.json(fullState);
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const errObj = err as { type?: string; status?: number } | null;
    if (errObj?.type === 'entity.too.large' || errObj?.status === 413) {
      res.status(413).json({ error: "La photo ou les données envoyées sont trop volumineuses." });
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
