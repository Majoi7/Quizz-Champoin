import crypto from 'node:crypto';
import { normalizeParticipantKey, rankParticipants } from '../src/lib/ranking.ts';
import {
  applySupabaseScoreMutation,
  createSupabaseParticipant,
  deleteSupabaseParticipant,
  getSupabaseCompetition,
  getSupabaseFullQuizState,
  getSupabaseRankedParticipants,
  getSupabaseRecentEvents,
  isSupabaseConfigured,
  resetSupabaseCompetitionData,
  resetSupabaseSingleParticipantScore,
  undoSupabaseLastScoreOperation,
  updateSupabaseCompetitionConfig,
  updateSupabaseParticipantDetails,
  upsertSupabaseAdminUser,
} from './supabaseDb.ts';
import type {
  Competition,
  CompetitionStatus,
  FullQuizState,
  Participant,
  ParticipantStatus,
  RankedParticipant,
  ScoreEvent,
  ScoreReason,
  TieBreakerRule,
} from '../src/types/quiz.ts';

export const DEFAULT_COMPETITION: Competition = {
  id: 'main',
  name: 'QUIZ CHAMPION LIVE',
  subtitle: 'Compétition de culture générale',
  status: 'PREPARATION',
  registrations_open: true,
  require_phone: false,
  confirm_large_delta: true,
  large_delta_threshold: 20,
  tie_breaker: 'EARLIEST_REACHED',
  points_correct: 10,
  points_wrong: -5,
  points_bonus: 20,
  current_round: 1,
  round_title: 'Manche 1',
  started_at: null,
  elapsed_seconds: 0,
  resumed_at: null,
  question_timer_seconds: 30,
  question_timer_running: false,
  question_timer_started_at: null,
};

export function isCloudSqlConfigured(): boolean {
  return Boolean((process.env.SQL_HOST || '').trim());
}

async function getDrizzleCtx() {
  if (!isCloudSqlConfigured()) {
    throw new Error('DATABASE_NOT_CONFIGURED');
  }
  const [drizzleOrm, dbMod, schemaMod, usersMod] = await Promise.all([
    import('drizzle-orm'),
    import('../src/db/index.ts'),
    import('../src/db/schema.ts'),
    import('../src/db/users.ts'),
  ]);
  return {
    and: drizzleOrm.and,
    desc: drizzleOrm.desc,
    eq: drizzleOrm.eq,
    ne: drizzleOrm.ne,
    db: dbMod.db,
    competitions: schemaMod.competitions,
    participants: schemaMod.participants,
    scoreEvents: schemaMod.scoreEvents,
    getOrCreateUser: usersMod.getOrCreateUser,
  };
}

type DrizzleCtx = Awaited<ReturnType<typeof getDrizzleCtx>>;
type DbExecutor = Pick<DrizzleCtx['db'], 'select' | 'insert' | 'update' | 'delete'>;

function mapCompetitionRow(row: {
  id: string;
  name: string;
  subtitle: string;
  status: string;
  registrationsOpen: boolean;
  requirePhone: boolean;
  confirmLargeDelta: boolean;
  largeDeltaThreshold: number;
  tieBreaker: string;
  pointsCorrect: number;
  pointsWrong: number;
  pointsBonus: number;
  currentRound: number;
  roundTitle: string;
  startedAt: string | null;
  elapsedSeconds: number;
  resumedAt: string | null;
  questionTimerSeconds: number;
  questionTimerRunning: boolean;
  questionTimerStartedAt: string | null;
}): Competition {
  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle,
    status: row.status as CompetitionStatus,
    registrations_open: row.registrationsOpen,
    require_phone: row.requirePhone,
    confirm_large_delta: row.confirmLargeDelta,
    large_delta_threshold: row.largeDeltaThreshold,
    tie_breaker: row.tieBreaker as TieBreakerRule,
    points_correct: row.pointsCorrect,
    points_wrong: row.pointsWrong,
    points_bonus: row.pointsBonus,
    current_round: row.currentRound,
    round_title: row.roundTitle,
    started_at: row.startedAt,
    elapsed_seconds: row.elapsedSeconds,
    resumed_at: row.resumedAt,
    question_timer_seconds: row.questionTimerSeconds,
    question_timer_running: row.questionTimerRunning,
    question_timer_started_at: row.questionTimerStartedAt,
  };
}

function mapParticipantRow(row: {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  phone: string | null;
  avatarUrl: string | null;
  score: number;
  status: string;
  scoreUpdatedAt: string;
  createdAt: string;
}): Participant {
  return {
    id: row.id,
    first_name: row.firstName,
    last_name: row.lastName,
    nickname: row.nickname,
    phone: row.phone,
    avatar_url: row.avatarUrl,
    score: row.score,
    status: row.status as ParticipantStatus,
    score_updated_at: row.scoreUpdatedAt,
    created_at: row.createdAt,
  };
}

function mapEventRow(row: {
  id: string;
  participantId: string;
  participantName: string;
  delta: number;
  previousScore: number;
  newScore: number;
  reason: string;
  roundNumber: number;
  adminName: string;
  reverted: boolean;
  createdAt: string;
}): ScoreEvent {
  return {
    id: row.id,
    participant_id: row.participantId,
    participant_name: row.participantName,
    delta: row.delta,
    previous_score: row.previousScore,
    new_score: row.newScore,
    reason: row.reason as ScoreReason,
    round_number: row.roundNumber,
    admin_name: row.adminName,
    reverted: row.reverted,
    created_at: row.createdAt,
  };
}

function isPgUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const record = err as { code?: unknown; cause?: { code?: unknown } };
  return record.code === '23505' || record.cause?.code === '23505';
}

async function ensureCompetitionRow(ctx: DrizzleCtx, executor: DbExecutor = ctx.db): Promise<Competition> {
  const { competitions, eq } = ctx;
  const existing = await executor
    .select()
    .from(competitions)
    .where(eq(competitions.id, 'main'))
    .limit(1);

  if (existing[0]) {
    return mapCompetitionRow(existing[0]);
  }

  await executor
    .insert(competitions)
    .values({
      id: 'main',
      name: DEFAULT_COMPETITION.name,
      subtitle: DEFAULT_COMPETITION.subtitle,
      status: DEFAULT_COMPETITION.status,
      registrationsOpen: DEFAULT_COMPETITION.registrations_open,
      requirePhone: DEFAULT_COMPETITION.require_phone,
      confirmLargeDelta: DEFAULT_COMPETITION.confirm_large_delta,
      largeDeltaThreshold: DEFAULT_COMPETITION.large_delta_threshold,
      tieBreaker: DEFAULT_COMPETITION.tie_breaker,
      pointsCorrect: DEFAULT_COMPETITION.points_correct,
      pointsWrong: DEFAULT_COMPETITION.points_wrong,
      pointsBonus: DEFAULT_COMPETITION.points_bonus,
      currentRound: DEFAULT_COMPETITION.current_round,
      roundTitle: DEFAULT_COMPETITION.round_title,
      startedAt: DEFAULT_COMPETITION.started_at,
      elapsedSeconds: DEFAULT_COMPETITION.elapsed_seconds,
      resumedAt: DEFAULT_COMPETITION.resumed_at,
      questionTimerSeconds: DEFAULT_COMPETITION.question_timer_seconds,
      questionTimerRunning: DEFAULT_COMPETITION.question_timer_running,
      questionTimerStartedAt: DEFAULT_COMPETITION.question_timer_started_at,
    })
    .onConflictDoNothing();

  const created = await executor
    .select()
    .from(competitions)
    .where(eq(competitions.id, 'main'))
    .limit(1);

  if (!created[0]) {
    throw new Error('COMPETITION_NOT_INITIALIZED');
  }
  return mapCompetitionRow(created[0]);
}

export async function upsertAdminUser(
  uid: string,
  email: string,
  name?: string
): Promise<{ uid: string; email: string; name: string; role: 'SUPER_ADMIN' | 'HOST' }> {
  if (isSupabaseConfigured()) {
    return upsertSupabaseAdminUser(uid, email, name);
  }
  if (!isCloudSqlConfigured()) {
    const cleanEmail = email.trim().toLowerCase();
    const displayName = (name && name.trim()) || cleanEmail.split('@')[0] || 'Régie';
    const configuredOwner = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    return {
      uid,
      email: cleanEmail,
      name: displayName,
      role: !configuredOwner || cleanEmail === configuredOwner ? 'SUPER_ADMIN' : 'HOST',
    };
  }
  const { getOrCreateUser } = await getDrizzleCtx();
  const user = await getOrCreateUser(uid, email, name);
  return {
    uid: user.uid,
    email: user.email,
    name: user.name,
    role: user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOST',
  };
}

export async function getCompetition(): Promise<Competition> {
  if (isSupabaseConfigured()) {
    return getSupabaseCompetition();
  }
  if (!isCloudSqlConfigured()) {
    return { ...DEFAULT_COMPETITION };
  }
  try {
    const ctx = await getDrizzleCtx();
    return await ensureCompetitionRow(ctx, ctx.db);
  } catch (error) {
    console.error('Database query failed in getCompetition:', error);
    throw new Error('Impossible de charger la configuration de la compétition.', { cause: error });
  }
}

async function getRankedParticipantsWithExecutor(
  ctx: DrizzleCtx,
  executor: DbExecutor,
  tieBreaker?: TieBreakerRule
): Promise<RankedParticipant[]> {
  const resolvedTieBreaker = tieBreaker ?? (await ensureCompetitionRow(ctx, executor)).tie_breaker;
  const rows = await executor.select().from(ctx.participants);
  return rankParticipants(rows.map(mapParticipantRow), resolvedTieBreaker);
}

export async function getRankedParticipants(): Promise<RankedParticipant[]> {
  if (isSupabaseConfigured()) {
    return getSupabaseRankedParticipants();
  }
  if (!isCloudSqlConfigured()) {
    return [];
  }
  try {
    const ctx = await getDrizzleCtx();
    return await getRankedParticipantsWithExecutor(ctx, ctx.db);
  } catch (error) {
    console.error('Database query failed in getRankedParticipants:', error);
    throw new Error('Impossible de charger les participants.', { cause: error });
  }
}

export async function getRecentEvents(limit = 100): Promise<ScoreEvent[]> {
  if (isSupabaseConfigured()) {
    return getSupabaseRecentEvents(limit);
  }
  if (!isCloudSqlConfigured()) {
    return [];
  }
  try {
    const { db, desc, scoreEvents } = await getDrizzleCtx();
    const rows = await db
      .select()
      .from(scoreEvents)
      .orderBy(desc(scoreEvents.createdAt))
      .limit(limit);
    return rows.map(mapEventRow);
  } catch (error) {
    console.error('Database query failed in getRecentEvents:', error);
    throw new Error("Impossible de charger l'historique des scores.", { cause: error });
  }
}

export async function getFullQuizState(): Promise<FullQuizState> {
  if (isSupabaseConfigured()) {
    return getSupabaseFullQuizState();
  }
  if (!isCloudSqlConfigured()) {
    return {
      competition: { ...DEFAULT_COMPETITION },
      participants: [],
      recentEvents: [],
      serverTime: new Date().toISOString(),
    };
  }
  try {
    const ctx = await getDrizzleCtx();
    const competition = await ensureCompetitionRow(ctx, ctx.db);
    const [ranked, recent] = await Promise.all([
      getRankedParticipantsWithExecutor(ctx, ctx.db, competition.tie_breaker),
      getRecentEvents(100),
    ]);
    return {
      competition,
      participants: ranked,
      recentEvents: recent,
      serverTime: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Database query failed in getFullQuizState:', error);
    throw new Error('Impossible de charger l’état du quiz.', { cause: error });
  }
}

export interface RegisterInput {
  first_name: string;
  last_name: string;
  nickname?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
}

const MAX_AVATAR_URL_LENGTH = 450_000;

function sanitizeAvatarUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_AVATAR_URL_LENGTH) {
    throw new Error('INVALID_AVATAR');
  }
  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }
  throw new Error('INVALID_AVATAR');
}

export async function createParticipant(
  input: RegisterInput,
  options: { bypassRegistrationLock?: boolean } = {}
): Promise<RankedParticipant> {
  if (isSupabaseConfigured()) {
    return createSupabaseParticipant(input, options);
  }
  const firstName = String(input.first_name ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const lastName = String(input.last_name ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const nickname =
    typeof input.nickname === 'string'
      ? input.nickname.replace(/\s+/g, ' ').trim() || null
      : null;
  const phone =
    typeof input.phone === 'string' ? input.phone.replace(/\s+/g, ' ').trim() || null : null;
  const avatarUrl = sanitizeAvatarUrl(input.avatar_url);

  if (
    firstName.length < 2 ||
    lastName.length < 2 ||
    firstName.length > 80 ||
    lastName.length > 80
  ) {
    throw new Error('INVALID_NAME');
  }

  const ctx = await getDrizzleCtx();
  const { db, eq, participants } = ctx;

  try {
    return await db.transaction(async (tx) => {
      const comp = await ensureCompetitionRow(ctx, tx);
      if (!options.bypassRegistrationLock && !comp.registrations_open) {
        throw new Error('REGISTRATIONS_CLOSED');
      }

      if (!options.bypassRegistrationLock && comp.require_phone && !phone) {
        throw new Error('PHONE_REQUIRED');
      }

      const normalizedKey = normalizeParticipantKey(firstName, lastName);
      const existingByName = await tx
        .select({ id: participants.id })
        .from(participants)
        .where(eq(participants.normalizedKey, normalizedKey))
        .limit(1);

      if (existingByName[0]) {
        throw new Error('DUPLICATE_PARTICIPANT');
      }

      if (phone) {
        const cleanPhone = phone.replace(/\s+/g, '');
        const allParticipants = await tx
          .select({ id: participants.id, phone: participants.phone })
          .from(participants);
        const phoneMatch = allParticipants.find(
          (p) => p.phone && p.phone.replace(/\s+/g, '') === cleanPhone
        );
        if (phoneMatch) {
          throw new Error('DUPLICATE_PHONE');
        }
      }

      const now = new Date().toISOString();
      const id = `p_${crypto.randomBytes(8).toString('hex')}`;

      try {
        await tx.insert(participants).values({
          id,
          firstName,
          lastName,
          nickname,
          phone,
          avatarUrl,
          score: 0,
          status: 'ACTIVE',
          scoreUpdatedAt: now,
          createdAt: now,
          normalizedKey,
        });
      } catch (insertErr) {
        if (isPgUniqueViolation(insertErr)) {
          throw new Error('DUPLICATE_PARTICIPANT');
        }
        throw insertErr;
      }

      const ranked = await getRankedParticipantsWithExecutor(ctx, tx, comp.tie_breaker);
      const created = ranked.find((p) => p.id === id);
      if (!created) throw new Error('CREATE_FAILED');
      return created;
    });
  } catch (error) {
    if (error instanceof Error && [
      'DATABASE_NOT_CONFIGURED',
      'REGISTRATIONS_CLOSED',
      'PHONE_REQUIRED',
      'INVALID_NAME',
      'INVALID_AVATAR',
      'DUPLICATE_PARTICIPANT',
      'DUPLICATE_PHONE',
      'CREATE_FAILED',
    ].includes(error.message)) {
      throw error;
    }
    if (isPgUniqueViolation(error)) {
      throw new Error('DUPLICATE_PARTICIPANT');
    }
    console.error('Database query failed in createParticipant:', error);
    throw new Error("Erreur lors de l'enregistrement du participant.", { cause: error });
  }
}

export async function updateParticipantDetails(
  id: string,
  updates: Partial<{
    first_name: string;
    last_name: string;
    nickname: string | null;
    phone: string | null;
    avatar_url: string | null;
    status: ParticipantStatus;
  }>
): Promise<RankedParticipant> {
  if (isSupabaseConfigured()) {
    return updateSupabaseParticipantDetails(id, updates);
  }
  const ctx = await getDrizzleCtx();
  const { and, db, eq, ne, participants } = ctx;
  try {
    return await db.transaction(async (tx) => {
      const existingRows = await tx
        .select()
        .from(participants)
        .where(eq(participants.id, id))
        .limit(1);
      const existingRow = existingRows[0];
      if (!existingRow) throw new Error('NOT_FOUND');

      const firstName = (updates.first_name ?? existingRow.firstName).trim();
      const lastName = (updates.last_name ?? existingRow.lastName).trim();
      if (firstName.length < 2 || lastName.length < 2) {
        throw new Error('INVALID_NAME');
      }

      const normalizedKey = normalizeParticipantKey(firstName, lastName);
      const dup = await tx
        .select({ id: participants.id })
        .from(participants)
        .where(and(eq(participants.normalizedKey, normalizedKey), ne(participants.id, id)))
        .limit(1);
      if (dup[0]) throw new Error('DUPLICATE_PARTICIPANT');

      const nickname =
        updates.nickname !== undefined ? updates.nickname?.trim() || null : existingRow.nickname;
      const phone = updates.phone !== undefined ? updates.phone?.trim() || null : existingRow.phone;
      const avatarUrl =
        updates.avatar_url !== undefined
          ? sanitizeAvatarUrl(updates.avatar_url)
          : existingRow.avatarUrl;
      const status = updates.status ?? (existingRow.status as ParticipantStatus);

      await tx
        .update(participants)
        .set({
          firstName,
          lastName,
          nickname,
          phone,
          avatarUrl,
          status,
          normalizedKey,
        })
        .where(eq(participants.id, id));

      const updated = (await getRankedParticipantsWithExecutor(ctx, tx)).find((p) => p.id === id);
      if (!updated) throw new Error('NOT_FOUND');
      return updated;
    });
  } catch (error) {
    if (error instanceof Error && [
      'DATABASE_NOT_CONFIGURED',
      'NOT_FOUND',
      'INVALID_NAME',
      'INVALID_AVATAR',
      'DUPLICATE_PARTICIPANT',
    ].includes(error.message)) {
      throw error;
    }
    if (isPgUniqueViolation(error)) {
      throw new Error('DUPLICATE_PARTICIPANT');
    }
    console.error('Database query failed in updateParticipantDetails:', error);
    throw new Error('Impossible de mettre à jour le participant.', { cause: error });
  }
}

export async function deleteParticipant(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    return deleteSupabaseParticipant(id);
  }
  const { db, eq, participants } = await getDrizzleCtx();
  try {
    const deleted = await db
      .delete(participants)
      .where(eq(participants.id, id))
      .returning({ id: participants.id });
    if (deleted.length === 0) throw new Error('NOT_FOUND');
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      throw error;
    }
    console.error('Database query failed in deleteParticipant:', error);
    throw new Error('Impossible de supprimer le participant.', { cause: error });
  }
}

export async function applyScoreMutation(
  participantId: string,
  delta: number,
  reason: ScoreReason,
  adminName: string
): Promise<{
  event: ScoreEvent;
  participants: RankedParticipant[];
  previousLeaderId: string | null;
  newLeaderId: string | null;
}> {
  if (isSupabaseConfigured()) {
    return applySupabaseScoreMutation(participantId, delta, reason, adminName);
  }
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error('INVALID_DELTA');
  }

  const ctx = await getDrizzleCtx();
  const { db, eq, participants, scoreEvents } = ctx;

  try {
    return await db.transaction(async (tx) => {
      const comp = await ensureCompetitionRow(ctx, tx);
      const beforeRanked = await getRankedParticipantsWithExecutor(ctx, tx, comp.tie_breaker);
      const previousLeaderId = beforeRanked.find((p) => p.isLeader)?.id ?? null;

      const pRows = await tx
        .select()
        .from(participants)
        .where(eq(participants.id, participantId))
        .limit(1);
      const pRow = pRows[0];
      if (!pRow) throw new Error('NOT_FOUND');
      if (pRow.status === 'DISQUALIFIED') {
        throw new Error('PARTICIPANT_DISQUALIFIED');
      }

      const previousScore = pRow.score;
      const truncatedDelta = Math.trunc(delta);
      const newScore = previousScore + truncatedDelta;
      const now = new Date().toISOString();
      const participantName = `${pRow.firstName} ${pRow.lastName}`.trim();
      const eventId = `evt_${crypto.randomBytes(6).toString('hex')}`;

      await tx
        .update(participants)
        .set({ score: newScore, scoreUpdatedAt: now })
        .where(eq(participants.id, participantId));

      const insertedEvents = await tx
        .insert(scoreEvents)
        .values({
          id: eventId,
          participantId,
          participantName,
          delta: truncatedDelta,
          previousScore,
          newScore,
          reason,
          roundNumber: comp.current_round,
          adminName,
          reverted: false,
          createdAt: now,
        })
        .returning();

      const afterRanked = await getRankedParticipantsWithExecutor(ctx, tx, comp.tie_breaker);
      const newLeaderId = afterRanked.find((p) => p.isLeader)?.id ?? null;

      return {
        event: mapEventRow(insertedEvents[0]),
        participants: afterRanked,
        previousLeaderId,
        newLeaderId: newLeaderId !== previousLeaderId ? newLeaderId : null,
      };
    });
  } catch (error) {
    if (error instanceof Error && [
      'DATABASE_NOT_CONFIGURED',
      'INVALID_DELTA',
      'NOT_FOUND',
      'PARTICIPANT_DISQUALIFIED',
    ].includes(error.message)) {
      throw error;
    }
    console.error('Database query failed in applyScoreMutation:', error);
    throw new Error('Impossible de mettre à jour le score.', { cause: error });
  }
}

export async function resetSingleParticipantScore(
  participantId: string,
  adminName: string
): Promise<{
  event: ScoreEvent;
  participants: RankedParticipant[];
  previousLeaderId: string | null;
  newLeaderId: string | null;
}> {
  if (isSupabaseConfigured()) {
    return resetSupabaseSingleParticipantScore(participantId, adminName);
  }
  const ctx = await getDrizzleCtx();
  const { db, eq, participants, scoreEvents } = ctx;
  try {
    return await db.transaction(async (tx) => {
      const comp = await ensureCompetitionRow(ctx, tx);
      const beforeRanked = await getRankedParticipantsWithExecutor(ctx, tx, comp.tie_breaker);
      const previousLeaderId = beforeRanked.find((p) => p.isLeader)?.id ?? null;

      const pRows = await tx
        .select()
        .from(participants)
        .where(eq(participants.id, participantId))
        .limit(1);
      const pRow = pRows[0];
      if (!pRow) throw new Error('NOT_FOUND');

      const previousScore = pRow.score;
      const delta = -previousScore;
      const now = new Date().toISOString();
      const eventId = `evt_${crypto.randomBytes(6).toString('hex')}`;
      const participantName = `${pRow.firstName} ${pRow.lastName}`.trim();

      await tx
        .update(participants)
        .set({ score: 0, scoreUpdatedAt: now })
        .where(eq(participants.id, participantId));

      const insertedEvents = await tx
        .insert(scoreEvents)
        .values({
          id: eventId,
          participantId,
          participantName,
          delta,
          previousScore,
          newScore: 0,
          reason: 'RESET',
          roundNumber: comp.current_round,
          adminName,
          reverted: false,
          createdAt: now,
        })
        .returning();

      const afterRanked = await getRankedParticipantsWithExecutor(ctx, tx, comp.tie_breaker);
      const newLeaderId = afterRanked.find((p) => p.isLeader)?.id ?? null;

      return {
        event: mapEventRow(insertedEvents[0]),
        participants: afterRanked,
        previousLeaderId,
        newLeaderId: newLeaderId !== previousLeaderId ? newLeaderId : null,
      };
    });
  } catch (error) {
    if (error instanceof Error && ['DATABASE_NOT_CONFIGURED', 'NOT_FOUND'].includes(error.message)) {
      throw error;
    }
    console.error('Database query failed in resetSingleParticipantScore:', error);
    throw new Error('Impossible de réinitialiser le score.', { cause: error });
  }
}

export async function undoLastScoreOperation(adminName: string): Promise<{
  event: ScoreEvent;
  participants: RankedParticipant[];
  previousLeaderId: string | null;
  newLeaderId: string | null;
}> {
  if (isSupabaseConfigured()) {
    return undoSupabaseLastScoreOperation(adminName);
  }
  const ctx = await getDrizzleCtx();
  const { and, db, desc, eq, ne, participants, scoreEvents } = ctx;
  try {
    return await db.transaction(async (tx) => {
      const comp = await ensureCompetitionRow(ctx, tx);
      const beforeRanked = await getRankedParticipantsWithExecutor(ctx, tx, comp.tie_breaker);
      const previousLeaderId = beforeRanked.find((p) => p.isLeader)?.id ?? null;

      const lastEvents = await tx
        .select()
        .from(scoreEvents)
        .where(and(eq(scoreEvents.reverted, false), ne(scoreEvents.reason, 'UNDO')))
        .orderBy(desc(scoreEvents.createdAt))
        .limit(1);

      const lastEvent = lastEvents[0];
      if (!lastEvent) throw new Error('NOTHING_TO_UNDO');

      const pRows = await tx
        .select()
        .from(participants)
        .where(eq(participants.id, lastEvent.participantId))
        .limit(1);
      const pRow = pRows[0];
      if (!pRow) throw new Error('PARTICIPANT_NOT_FOUND');

      const currentScore = pRow.score;
      const targetScore = lastEvent.previousScore;
      const undoDelta = targetScore - currentScore;
      const now = new Date().toISOString();
      const undoEventId = `evt_${crypto.randomBytes(6).toString('hex')}`;

      await tx
        .update(scoreEvents)
        .set({ reverted: true })
        .where(eq(scoreEvents.id, lastEvent.id));

      await tx
        .update(participants)
        .set({ score: targetScore, scoreUpdatedAt: now })
        .where(eq(participants.id, lastEvent.participantId));

      const insertedEvents = await tx
        .insert(scoreEvents)
        .values({
          id: undoEventId,
          participantId: lastEvent.participantId,
          participantName: lastEvent.participantName,
          delta: undoDelta,
          previousScore: currentScore,
          newScore: targetScore,
          reason: 'UNDO',
          roundNumber: comp.current_round,
          adminName,
          reverted: false,
          createdAt: now,
        })
        .returning();

      const afterRanked = await getRankedParticipantsWithExecutor(ctx, tx, comp.tie_breaker);
      const newLeaderId = afterRanked.find((p) => p.isLeader)?.id ?? null;

      return {
        event: mapEventRow(insertedEvents[0]),
        participants: afterRanked,
        previousLeaderId,
        newLeaderId: newLeaderId !== previousLeaderId ? newLeaderId : null,
      };
    });
  } catch (error) {
    if (
      error instanceof Error &&
      ['DATABASE_NOT_CONFIGURED', 'NOTHING_TO_UNDO', 'PARTICIPANT_NOT_FOUND'].includes(
        error.message
      )
    ) {
      throw error;
    }
    console.error('Database query failed in undoLastScoreOperation:', error);
    throw new Error("Impossible d'annuler l'opération.", { cause: error });
  }
}

export async function updateCompetitionConfig(
  updates: Partial<{
    name: string;
    subtitle: string;
    status: CompetitionStatus;
    registrations_open: boolean;
    require_phone: boolean;
    confirm_large_delta: boolean;
    large_delta_threshold: number;
    tie_breaker: TieBreakerRule;
    points_correct: number;
    points_wrong: number;
    points_bonus: number;
    current_round: number;
    round_title: string;
    question_timer_seconds: number;
    question_timer_action: 'START' | 'PAUSE' | 'RESET';
  }>
): Promise<Competition> {
  if (isSupabaseConfigured()) {
    return updateSupabaseCompetitionConfig(updates);
  }
  const ctx = await getDrizzleCtx();
  const { competitions, db, eq } = ctx;
  try {
    return await db.transaction(async (tx) => {
      const current = await ensureCompetitionRow(ctx, tx);
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();

      const nextStatus = updates.status ?? current.status;
      let elapsedSeconds = current.elapsed_seconds;
      let resumedAt = current.resumed_at;
      let startedAt = current.started_at;

      if (updates.status && updates.status !== current.status) {
        if (current.status === 'LIVE' && current.resumed_at) {
          const segmentSec = Math.max(0, Math.floor((nowMs - Date.parse(current.resumed_at)) / 1000));
          elapsedSeconds += segmentSec;
        }

        if (nextStatus === 'LIVE') {
          if (!startedAt) startedAt = nowIso;
          resumedAt = nowIso;
        } else {
          resumedAt = null;
        }

        if (nextStatus === 'PREPARATION') {
          elapsedSeconds = 0;
          startedAt = null;
          resumedAt = null;
        }
      }

      let qTimerRunning = current.question_timer_running;
      let qTimerStartedAt = current.question_timer_started_at;
      const qTimerSeconds = updates.question_timer_seconds ?? current.question_timer_seconds;

      if (updates.question_timer_action === 'START') {
        qTimerRunning = true;
        qTimerStartedAt = nowIso;
      } else if (updates.question_timer_action === 'PAUSE') {
        qTimerRunning = false;
        qTimerStartedAt = null;
      } else if (updates.question_timer_action === 'RESET') {
        qTimerRunning = false;
        qTimerStartedAt = null;
      }

      const updatedRows = await tx
        .update(competitions)
        .set({
          name: (updates.name ?? current.name).trim() || current.name,
          subtitle: (updates.subtitle ?? current.subtitle).trim(),
          status: nextStatus,
          registrationsOpen: updates.registrations_open ?? current.registrations_open,
          requirePhone: updates.require_phone ?? current.require_phone,
          confirmLargeDelta: updates.confirm_large_delta ?? current.confirm_large_delta,
          largeDeltaThreshold: Math.max(
            1,
            Math.trunc(updates.large_delta_threshold ?? current.large_delta_threshold)
          ),
          tieBreaker: updates.tie_breaker ?? current.tie_breaker,
          pointsCorrect: Math.trunc(updates.points_correct ?? current.points_correct),
          pointsWrong: Math.trunc(updates.points_wrong ?? current.points_wrong),
          pointsBonus: Math.trunc(updates.points_bonus ?? current.points_bonus),
          currentRound: Math.max(1, Math.trunc(updates.current_round ?? current.current_round)),
          roundTitle: (updates.round_title ?? current.round_title).trim() || current.round_title,
          startedAt,
          elapsedSeconds,
          resumedAt,
          questionTimerSeconds: Math.max(5, Math.trunc(qTimerSeconds)),
          questionTimerRunning: qTimerRunning,
          questionTimerStartedAt: qTimerStartedAt,
        })
        .where(eq(competitions.id, 'main'))
        .returning();

      return mapCompetitionRow(updatedRows[0]);
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'DATABASE_NOT_CONFIGURED') {
      throw error;
    }
    console.error('Database query failed in updateCompetitionConfig:', error);
    throw new Error('Impossible de mettre à jour la compétition.', { cause: error });
  }
}

export async function resetCompetitionData(mode: 'scores' | 'full'): Promise<void> {
  if (isSupabaseConfigured()) {
    return resetSupabaseCompetitionData(mode);
  }
  const ctx = await getDrizzleCtx();
  const { competitions, db, eq, participants, scoreEvents } = ctx;
  const now = new Date().toISOString();
  try {
    await db.transaction(async (tx) => {
      await ensureCompetitionRow(ctx, tx);
      await tx.delete(scoreEvents);

      if (mode === 'full') {
        await tx.delete(participants);
        await tx
          .update(competitions)
          .set({
            status: 'PREPARATION',
            currentRound: 1,
            roundTitle: 'Manche 1',
            startedAt: null,
            elapsedSeconds: 0,
            resumedAt: null,
            questionTimerRunning: false,
            questionTimerStartedAt: null,
          })
          .where(eq(competitions.id, 'main'));
      } else {
        await tx.update(participants).set({ score: 0, scoreUpdatedAt: now });
        await tx
          .update(competitions)
          .set({
            status: 'PREPARATION',
            elapsedSeconds: 0,
            startedAt: null,
            resumedAt: null,
            questionTimerRunning: false,
            questionTimerStartedAt: null,
          })
          .where(eq(competitions.id, 'main'));
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'DATABASE_NOT_CONFIGURED') {
      throw error;
    }
    console.error('Database query failed in resetCompetitionData:', error);
    throw new Error('Impossible de réinitialiser la compétition.', { cause: error });
  }
}
