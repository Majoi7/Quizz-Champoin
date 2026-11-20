import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { normalizeParticipantKey, rankParticipants } from '../src/lib/ranking.ts';
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

interface SupabaseCompetitionRow {
  id: string;
  name: string;
  subtitle: string;
  status: string;
  registrations_open: boolean;
  require_phone: boolean;
  confirm_large_delta: boolean;
  large_delta_threshold: number;
  tie_breaker: string;
  points_correct: number;
  points_wrong: number;
  points_bonus: number;
  current_round: number;
  round_title: string;
  started_at: string | null;
  elapsed_seconds: number;
  resumed_at: string | null;
  question_timer_seconds: number;
  question_timer_running: boolean;
  question_timer_started_at: string | null;
}

interface SupabaseParticipantRow {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  phone: string | null;
  avatar_url: string | null;
  score: number;
  status: string;
  score_updated_at: string;
  created_at: string;
  normalized_key?: string;
}

interface SupabaseScoreEventRow {
  id: string;
  participant_id: string;
  participant_name: string;
  delta: number;
  previous_score: number;
  new_score: number;
  reason: string;
  round_number: number;
  admin_name: string;
  reverted: boolean;
  created_at: string;
}

const DEFAULT_COMPETITION: Competition = {
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

export function getSupabaseConfig(): { url: string; key: string } | null {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();
  if (!url || !key) return null;
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

let cachedClient: SupabaseClient | null = null;
let cachedConfigSig = '';

function getClient(): SupabaseClient {
  const cfg = getSupabaseConfig();
  if (!cfg) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }
  const sig = `${cfg.url}|${cfg.key.slice(0, 12)}`;
  if (!cachedClient || cachedConfigSig !== sig) {
    cachedClient = createClient(cfg.url, cfg.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedConfigSig = sig;
  }
  return cachedClient;
}

export function isSupabaseMissingTableError(
  err: { code?: string; message?: string } | null | undefined
): boolean {
  if (!err) return false;
  return (
    err.code === 'PGRST205' ||
    err.code === '42P01' ||
    (typeof err.message === 'string' &&
      /could not find the table .* in the schema cache|relation .* does not exist/i.test(
        err.message
      ))
  );
}

export function isSupabaseMissingColumnError(
  err: { code?: string; message?: string } | null | undefined,
  columnName?: string
): boolean {
  if (!err) return false;
  const isMissingCol =
    err.code === 'PGRST204' ||
    err.code === '42703' ||
    (typeof err.message === 'string' &&
      /could not find the .* column .* in the schema cache|column .* does not exist/i.test(
        err.message
      ));
  if (!isMissingCol) return false;
  if (!columnName) return true;
  return typeof err.message === 'string' && err.message.includes(columnName);
}

export function isSupabaseRlsError(
  err: { code?: string; message?: string } | null | undefined
): boolean {
  if (!err) return false;
  return (
    err.code === '42501' ||
    (typeof err.message === 'string' && /row-level security policy/i.test(err.message))
  );
}

export function isSupabaseUniqueViolation(
  err: { code?: string; message?: string } | null | undefined
): boolean {
  if (!err) return false;
  return (
    err.code === '23505' ||
    (typeof err.message === 'string' && /duplicate key|unique constraint/i.test(err.message))
  );
}

function mapCompetition(row: SupabaseCompetitionRow): Competition {
  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle,
    status: row.status as CompetitionStatus,
    registrations_open: Boolean(row.registrations_open),
    require_phone: Boolean(row.require_phone),
    confirm_large_delta: Boolean(row.confirm_large_delta),
    large_delta_threshold: Number(row.large_delta_threshold),
    tie_breaker: row.tie_breaker as TieBreakerRule,
    points_correct: Number(row.points_correct),
    points_wrong: Number(row.points_wrong),
    points_bonus: Number(row.points_bonus),
    current_round: Number(row.current_round),
    round_title: row.round_title,
    started_at: row.started_at,
    elapsed_seconds: Number(row.elapsed_seconds),
    resumed_at: row.resumed_at,
    question_timer_seconds: Number(row.question_timer_seconds),
    question_timer_running: Boolean(row.question_timer_running),
    question_timer_started_at: row.question_timer_started_at,
  };
}

function mapParticipant(row: SupabaseParticipantRow): Participant {
  const now = new Date().toISOString();
  return {
    id: String(row.id),
    first_name: String(row.first_name),
    last_name: String(row.last_name),
    nickname: row.nickname ?? null,
    phone: row.phone ?? null,
    avatar_url: row.avatar_url ?? null,
    score: Number(row.score ?? 0),
    status: (row.status as ParticipantStatus) || 'ACTIVE',
    score_updated_at: row.score_updated_at || row.created_at || now,
    created_at: row.created_at || now,
  };
}

function mapScoreEvent(row: SupabaseScoreEventRow): ScoreEvent {
  return {
    id: row.id,
    participant_id: row.participant_id,
    participant_name: row.participant_name,
    delta: Number(row.delta),
    previous_score: Number(row.previous_score),
    new_score: Number(row.new_score),
    reason: row.reason as ScoreReason,
    round_number: Number(row.round_number),
    admin_name: row.admin_name,
    reverted: Boolean(row.reverted),
    created_at: row.created_at,
  };
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

export async function upsertSupabaseAdminUser(
  uid: string,
  email: string,
  name?: string
): Promise<{ uid: string; email: string; name: string; role: 'SUPER_ADMIN' | 'HOST' }> {
  const client = getClient();
  const cleanEmail = email.trim().toLowerCase();
  const displayName = (name && name.trim()) || cleanEmail.split('@')[0] || 'Régie';
  const configuredOwner = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

  const { count, error: countErr } = await client
    .from('users')
    .select('id', { count: 'exact', head: true });

  if (countErr && isSupabaseMissingTableError(countErr)) {
    return {
      uid,
      email: cleanEmail,
      name: displayName,
      role: !configuredOwner || cleanEmail === configuredOwner ? 'SUPER_ADMIN' : 'HOST',
    };
  }

  const assignedRole =
    (count ?? 0) === 0 || (configuredOwner && cleanEmail === configuredOwner)
      ? 'SUPER_ADMIN'
      : 'HOST';

  const { data, error } = await client
    .from('users')
    .upsert(
      {
        uid,
        email: cleanEmail,
        name: displayName,
        role: assignedRole,
      },
      { onConflict: 'uid' }
    )
    .select('uid, email, name, role')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error) || isSupabaseRlsError(error)) {
      return {
        uid,
        email: cleanEmail,
        name: displayName,
        role: assignedRole,
      };
    }
    throw new Error('Impossible de synchroniser le compte administrateur Supabase.', {
      cause: error,
    });
  }

  return {
    uid: String(data.uid),
    email: String(data.email),
    name: String(data.name),
    role: data.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'HOST',
  };
}

export async function getSupabaseCompetition(): Promise<Competition> {
  const client = getClient();
  const { data, error } = await client
    .from('competitions')
    .select('*')
    .eq('id', 'main')
    .maybeSingle();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      console.warn('[supabase] competitions table missing, using default competition settings.');
      return { ...DEFAULT_COMPETITION };
    }
    throw new Error(`Supabase competition read failed: ${error.message}`, { cause: error });
  }
  if (data) {
    return mapCompetition(data as SupabaseCompetitionRow);
  }

  const defaultRow: SupabaseCompetitionRow = {
    id: DEFAULT_COMPETITION.id,
    name: DEFAULT_COMPETITION.name,
    subtitle: DEFAULT_COMPETITION.subtitle,
    status: DEFAULT_COMPETITION.status,
    registrations_open: DEFAULT_COMPETITION.registrations_open,
    require_phone: DEFAULT_COMPETITION.require_phone,
    confirm_large_delta: DEFAULT_COMPETITION.confirm_large_delta,
    large_delta_threshold: DEFAULT_COMPETITION.large_delta_threshold,
    tie_breaker: DEFAULT_COMPETITION.tie_breaker,
    points_correct: DEFAULT_COMPETITION.points_correct,
    points_wrong: DEFAULT_COMPETITION.points_wrong,
    points_bonus: DEFAULT_COMPETITION.points_bonus,
    current_round: DEFAULT_COMPETITION.current_round,
    round_title: DEFAULT_COMPETITION.round_title,
    started_at: DEFAULT_COMPETITION.started_at,
    elapsed_seconds: DEFAULT_COMPETITION.elapsed_seconds,
    resumed_at: DEFAULT_COMPETITION.resumed_at,
    question_timer_seconds: DEFAULT_COMPETITION.question_timer_seconds,
    question_timer_running: DEFAULT_COMPETITION.question_timer_running,
    question_timer_started_at: DEFAULT_COMPETITION.question_timer_started_at,
  };

  const { error: upsertErr } = await client
    .from('competitions')
    .upsert(defaultRow, { onConflict: 'id', ignoreDuplicates: true });

  if (upsertErr && (isSupabaseMissingTableError(upsertErr) || isSupabaseRlsError(upsertErr))) {
    return { ...DEFAULT_COMPETITION };
  }

  const { data: created, error: retryErr } = await client
    .from('competitions')
    .select('*')
    .eq('id', 'main')
    .maybeSingle();

  if (retryErr || !created) {
    return { ...DEFAULT_COMPETITION };
  }
  return mapCompetition(created as SupabaseCompetitionRow);
}

export async function getSupabaseRankedParticipants(
  tieBreaker?: TieBreakerRule
): Promise<RankedParticipant[]> {
  const client = getClient();
  const resolvedTieBreaker = tieBreaker ?? (await getSupabaseCompetition()).tie_breaker;
  const { data, error } = await client.from('participants').select('*');
  if (error) {
    if (isSupabaseMissingTableError(error)) {
      console.warn('[supabase] participants table missing, returning empty list.');
      return [];
    }
    throw new Error(`Supabase participants read failed: ${error.message}`, { cause: error });
  }
  return rankParticipants((data as SupabaseParticipantRow[]).map(mapParticipant), resolvedTieBreaker);
}

export async function getSupabaseRecentEvents(limit = 100): Promise<ScoreEvent[]> {
  const client = getClient();
  const { data, error } = await client
    .from('score_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (isSupabaseMissingTableError(error)) {
      console.warn('[supabase] score_events table missing, returning empty events.');
      return [];
    }
    throw new Error(`Supabase score_events read failed: ${error.message}`, { cause: error });
  }
  return (data as SupabaseScoreEventRow[]).map(mapScoreEvent);
}

export async function getSupabaseFullQuizState(): Promise<FullQuizState> {
  const competition = await getSupabaseCompetition();
  const [participants, recentEvents] = await Promise.all([
    getSupabaseRankedParticipants(competition.tie_breaker),
    getSupabaseRecentEvents(100),
  ]);
  return {
    competition,
    participants,
    recentEvents,
    serverTime: new Date().toISOString(),
  };
}

export async function createSupabaseParticipant(
  input: {
    first_name: string;
    last_name: string;
    nickname?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
  },
  options: { bypassRegistrationLock?: boolean } = {}
): Promise<RankedParticipant> {
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

  const client = getClient();
  const comp = await getSupabaseCompetition();
  if (!options.bypassRegistrationLock && !comp.registrations_open) {
    throw new Error('REGISTRATIONS_CLOSED');
  }
  if (!options.bypassRegistrationLock && comp.require_phone && !phone) {
    throw new Error('PHONE_REQUIRED');
  }

  const normalizedKey = normalizeParticipantKey(firstName, lastName);

  const { data: dupName, error: dupNameErr } = await client
    .from('participants')
    .select('id')
    .eq('normalized_key', normalizedKey)
    .maybeSingle();

  if (dupNameErr) {
    if (isSupabaseMissingTableError(dupNameErr)) {
      throw new Error('SUPABASE_SCHEMA_MISSING');
    }
    if (isSupabaseMissingColumnError(dupNameErr, 'normalized_key')) {
      const { data: existingRows, error: listErr } = await client
        .from('participants')
        .select('id, first_name, last_name');
      if (listErr && isSupabaseMissingTableError(listErr)) {
        throw new Error('SUPABASE_SCHEMA_MISSING');
      }
      const match = (existingRows ?? []).find(
        (r) =>
          normalizeParticipantKey(String(r.first_name ?? ''), String(r.last_name ?? '')) ===
          normalizedKey
      );
      if (match) {
        throw new Error('DUPLICATE_PARTICIPANT');
      }
    }
  } else if (dupName) {
    throw new Error('DUPLICATE_PARTICIPANT');
  }

  if (phone) {
    const cleanPhone = phone.replace(/\s+/g, '');
    const { data: allPhones } = await client
      .from('participants')
      .select('id, phone')
      .not('phone', 'is', null);
    const phoneMatch = (allPhones ?? []).find(
      (row) => row.phone && String(row.phone).replace(/\s+/g, '') === cleanPhone
    );
    if (phoneMatch) {
      throw new Error('DUPLICATE_PHONE');
    }
  }

  const now = new Date().toISOString();
  const id = `p_${crypto.randomBytes(8).toString('hex')}`;

  const baseRecord = {
    id,
    first_name: firstName,
    last_name: lastName,
    nickname,
    phone,
    avatar_url: avatarUrl,
    score: 0,
    status: 'ACTIVE',
    score_updated_at: now,
    created_at: now,
  };

  let { error: insertErr } = await client.from('participants').insert({
    ...baseRecord,
    normalized_key: normalizedKey,
  });

  if (insertErr && isSupabaseMissingColumnError(insertErr, 'normalized_key')) {
    const retry = await client.from('participants').insert(baseRecord);
    insertErr = retry.error;
  }

  if (insertErr) {
    if (isSupabaseMissingTableError(insertErr)) {
      throw new Error('SUPABASE_SCHEMA_MISSING');
    }
    if (isSupabaseRlsError(insertErr)) {
      throw new Error('SUPABASE_RLS_BLOCKED');
    }
    if (isSupabaseUniqueViolation(insertErr)) {
      throw new Error('DUPLICATE_PARTICIPANT');
    }
    throw new Error(`Supabase insert failed: ${insertErr.message}`, { cause: insertErr });
  }

  const ranked = await getSupabaseRankedParticipants(comp.tie_breaker);
  const created = ranked.find((p) => p.id === id);
  if (created) return created;

  return {
    ...mapParticipant(baseRecord),
    rank: ranked.length + 1,
    isLeader: ranked.length === 0,
    displayName: nickname ? `${firstName} ${lastName} (${nickname})` : `${firstName} ${lastName}`,
  };
}

export async function updateSupabaseParticipantDetails(
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
  const client = getClient();
  const { data: existingRow, error: fetchErr } = await client
    .from('participants')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    if (isSupabaseMissingTableError(fetchErr)) {
      throw new Error('SUPABASE_SCHEMA_MISSING');
    }
    throw new Error(`Supabase fetch failed: ${fetchErr.message}`, { cause: fetchErr });
  }
  if (!existingRow) throw new Error('NOT_FOUND');

  const existing = existingRow as SupabaseParticipantRow;
  const firstName = (updates.first_name ?? existing.first_name).trim();
  const lastName = (updates.last_name ?? existing.last_name).trim();
  if (firstName.length < 2 || lastName.length < 2) {
    throw new Error('INVALID_NAME');
  }

  const normalizedKey = normalizeParticipantKey(firstName, lastName);
  const { data: dup } = await client
    .from('participants')
    .select('id')
    .eq('normalized_key', normalizedKey)
    .neq('id', id)
    .maybeSingle();

  if (dup) throw new Error('DUPLICATE_PARTICIPANT');

  const nickname =
    updates.nickname !== undefined ? updates.nickname?.trim() || null : existing.nickname;
  const phone = updates.phone !== undefined ? updates.phone?.trim() || null : existing.phone;
  const avatarUrl =
    updates.avatar_url !== undefined ? sanitizeAvatarUrl(updates.avatar_url) : existing.avatar_url;
  const status = updates.status ?? (existing.status as ParticipantStatus);

  const { error: updateErr } = await client
    .from('participants')
    .update({
      first_name: firstName,
      last_name: lastName,
      nickname,
      phone,
      avatar_url: avatarUrl,
      status,
      normalized_key: normalizedKey,
    })
    .eq('id', id);

  if (updateErr) {
    if (isSupabaseUniqueViolation(updateErr)) {
      throw new Error('DUPLICATE_PARTICIPANT');
    }
    throw new Error(`Supabase update failed: ${updateErr.message}`, { cause: updateErr });
  }

  const updated = (await getSupabaseRankedParticipants()).find((p) => p.id === id);
  if (!updated) throw new Error('NOT_FOUND');
  return updated;
}

export async function deleteSupabaseParticipant(id: string): Promise<void> {
  const client = getClient();
  const { data, error } = await client
    .from('participants')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      throw new Error('SUPABASE_SCHEMA_MISSING');
    }
    throw new Error(`Supabase delete failed: ${error.message}`, { cause: error });
  }
  if (!data || data.length === 0) throw new Error('NOT_FOUND');
}

export async function applySupabaseScoreMutation(
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
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error('INVALID_DELTA');
  }

  const client = getClient();
  const comp = await getSupabaseCompetition();
  const beforeRanked = await getSupabaseRankedParticipants(comp.tie_breaker);
  const previousLeaderId = beforeRanked.find((p) => p.isLeader)?.id ?? null;

  const { data: pRow, error: pErr } = await client
    .from('participants')
    .select('*')
    .eq('id', participantId)
    .maybeSingle();

  if (pErr) {
    if (isSupabaseMissingTableError(pErr)) {
      throw new Error('SUPABASE_SCHEMA_MISSING');
    }
    throw new Error(`Supabase participant fetch failed: ${pErr.message}`, { cause: pErr });
  }
  if (!pRow) throw new Error('NOT_FOUND');

  const p = pRow as SupabaseParticipantRow;
  if (p.status === 'DISQUALIFIED') {
    throw new Error('PARTICIPANT_DISQUALIFIED');
  }

  const previousScore = Number(p.score);
  const truncatedDelta = Math.trunc(delta);
  const newScore = previousScore + truncatedDelta;
  const now = new Date().toISOString();
  const participantName = `${p.first_name} ${p.last_name}`.trim();
  const eventId = `evt_${crypto.randomBytes(6).toString('hex')}`;

  const { error: updErr } = await client
    .from('participants')
    .update({ score: newScore, score_updated_at: now })
    .eq('id', participantId);

  if (updErr) {
    throw new Error(`Supabase score update failed: ${updErr.message}`, { cause: updErr });
  }

  const eventPayload: SupabaseScoreEventRow = {
    id: eventId,
    participant_id: participantId,
    participant_name: participantName,
    delta: truncatedDelta,
    previous_score: previousScore,
    new_score: newScore,
    reason,
    round_number: comp.current_round,
    admin_name: adminName,
    reverted: false,
    created_at: now,
  };

  const { data: insertedEvent, error: evtErr } = await client
    .from('score_events')
    .insert(eventPayload)
    .select('*')
    .single();

  if (evtErr && !isSupabaseMissingTableError(evtErr)) {
    throw new Error(`Supabase score_events insert failed: ${evtErr.message}`);
  }

  const afterRanked = await getSupabaseRankedParticipants(comp.tie_breaker);
  const newLeaderId = afterRanked.find((item) => item.isLeader)?.id ?? null;

  return {
    event: mapScoreEvent((insertedEvent as SupabaseScoreEventRow) ?? eventPayload),
    participants: afterRanked,
    previousLeaderId,
    newLeaderId: newLeaderId !== previousLeaderId ? newLeaderId : null,
  };
}

export async function resetSupabaseSingleParticipantScore(
  participantId: string,
  adminName: string
): Promise<{
  event: ScoreEvent;
  participants: RankedParticipant[];
  previousLeaderId: string | null;
  newLeaderId: string | null;
}> {
  const client = getClient();
  const comp = await getSupabaseCompetition();
  const beforeRanked = await getSupabaseRankedParticipants(comp.tie_breaker);
  const previousLeaderId = beforeRanked.find((p) => p.isLeader)?.id ?? null;

  const { data: pRow } = await client
    .from('participants')
    .select('*')
    .eq('id', participantId)
    .maybeSingle();

  if (!pRow) throw new Error('NOT_FOUND');
  const p = pRow as SupabaseParticipantRow;

  const previousScore = Number(p.score);
  const delta = -previousScore;
  const now = new Date().toISOString();
  const eventId = `evt_${crypto.randomBytes(6).toString('hex')}`;
  const participantName = `${p.first_name} ${p.last_name}`.trim();

  await client
    .from('participants')
    .update({ score: 0, score_updated_at: now })
    .eq('id', participantId);

  const eventPayload: SupabaseScoreEventRow = {
    id: eventId,
    participant_id: participantId,
    participant_name: participantName,
    delta,
    previous_score: previousScore,
    new_score: 0,
    reason: 'RESET',
    round_number: comp.current_round,
    admin_name: adminName,
    reverted: false,
    created_at: now,
  };

  const { data: insertedEvent, error: evtErr } = await client
    .from('score_events')
    .insert(eventPayload)
    .select('*')
    .single();

  if (evtErr && !isSupabaseMissingTableError(evtErr)) {
    throw new Error(`Supabase score reset failed: ${evtErr.message}`);
  }

  const afterRanked = await getSupabaseRankedParticipants(comp.tie_breaker);
  const newLeaderId = afterRanked.find((item) => item.isLeader)?.id ?? null;

  return {
    event: mapScoreEvent((insertedEvent as SupabaseScoreEventRow) ?? eventPayload),
    participants: afterRanked,
    previousLeaderId,
    newLeaderId: newLeaderId !== previousLeaderId ? newLeaderId : null,
  };
}

export async function undoSupabaseLastScoreOperation(adminName: string): Promise<{
  event: ScoreEvent;
  participants: RankedParticipant[];
  previousLeaderId: string | null;
  newLeaderId: string | null;
}> {
  const client = getClient();
  const comp = await getSupabaseCompetition();
  const beforeRanked = await getSupabaseRankedParticipants(comp.tie_breaker);
  const previousLeaderId = beforeRanked.find((p) => p.isLeader)?.id ?? null;

  const { data: lastEvents, error: lastErr } = await client
    .from('score_events')
    .select('*')
    .eq('reverted', false)
    .neq('reason', 'UNDO')
    .order('created_at', { ascending: false })
    .limit(1);

  if (lastErr && isSupabaseMissingTableError(lastErr)) {
    throw new Error('NOTHING_TO_UNDO');
  }

  const lastEvent = (lastEvents as SupabaseScoreEventRow[] | null)?.[0];
  if (!lastEvent) throw new Error('NOTHING_TO_UNDO');

  const { data: pRow } = await client
    .from('participants')
    .select('*')
    .eq('id', lastEvent.participant_id)
    .maybeSingle();

  if (!pRow) throw new Error('PARTICIPANT_NOT_FOUND');

  const p = pRow as SupabaseParticipantRow;
  const currentScore = Number(p.score);
  const targetScore = Number(lastEvent.previous_score);
  const undoDelta = targetScore - currentScore;
  const now = new Date().toISOString();
  const undoEventId = `evt_${crypto.randomBytes(6).toString('hex')}`;

  await client.from('score_events').update({ reverted: true }).eq('id', lastEvent.id);
  await client
    .from('participants')
    .update({ score: targetScore, score_updated_at: now })
    .eq('id', lastEvent.participant_id);

  const { data: insertedEvent, error: evtErr } = await client
    .from('score_events')
    .insert({
      id: undoEventId,
      participant_id: lastEvent.participant_id,
      participant_name: lastEvent.participant_name,
      delta: undoDelta,
      previous_score: currentScore,
      new_score: targetScore,
      reason: 'UNDO',
      round_number: comp.current_round,
      admin_name: adminName,
      reverted: false,
      created_at: now,
    })
    .select('*')
    .single();

  if (evtErr || !insertedEvent) {
    throw new Error(`Supabase undo failed: ${evtErr?.message ?? 'unknown'}`);
  }

  const afterRanked = await getSupabaseRankedParticipants(comp.tie_breaker);
  const newLeaderId = afterRanked.find((item) => item.isLeader)?.id ?? null;

  return {
    event: mapScoreEvent(insertedEvent as SupabaseScoreEventRow),
    participants: afterRanked,
    previousLeaderId,
    newLeaderId: newLeaderId !== previousLeaderId ? newLeaderId : null,
  };
}

export async function updateSupabaseCompetitionConfig(
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
  const client = getClient();
  const current = await getSupabaseCompetition();
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

  const nextPayload: SupabaseCompetitionRow = {
    id: 'main',
    name: (updates.name ?? current.name).trim() || current.name,
    subtitle: (updates.subtitle ?? current.subtitle).trim(),
    status: nextStatus,
    registrations_open: updates.registrations_open ?? current.registrations_open,
    require_phone: updates.require_phone ?? current.require_phone,
    confirm_large_delta: updates.confirm_large_delta ?? current.confirm_large_delta,
    large_delta_threshold: Math.max(
      1,
      Math.trunc(updates.large_delta_threshold ?? current.large_delta_threshold)
    ),
    tie_breaker: updates.tie_breaker ?? current.tie_breaker,
    points_correct: Math.trunc(updates.points_correct ?? current.points_correct),
    points_wrong: Math.trunc(updates.points_wrong ?? current.points_wrong),
    points_bonus: Math.trunc(updates.points_bonus ?? current.points_bonus),
    current_round: Math.max(1, Math.trunc(updates.current_round ?? current.current_round)),
    round_title: (updates.round_title ?? current.round_title).trim() || current.round_title,
    started_at: startedAt,
    elapsed_seconds: elapsedSeconds,
    resumed_at: resumedAt,
    question_timer_seconds: Math.max(5, Math.trunc(qTimerSeconds)),
    question_timer_running: qTimerRunning,
    question_timer_started_at: qTimerStartedAt,
  };

  const { data, error } = await client
    .from('competitions')
    .upsert(nextPayload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    if (isSupabaseMissingTableError(error)) {
      throw new Error('SUPABASE_SCHEMA_MISSING');
    }
    throw new Error(`Supabase competition update failed: ${error.message}`);
  }
  return mapCompetition((data as SupabaseCompetitionRow) ?? nextPayload);
}

export async function resetSupabaseCompetitionData(mode: 'scores' | 'full'): Promise<void> {
  const client = getClient();
  const now = new Date().toISOString();

  await client.from('score_events').delete().neq('id', '');

  if (mode === 'full') {
    await client.from('participants').delete().neq('id', '');
    await client
      .from('competitions')
      .update({
        status: 'PREPARATION',
        current_round: 1,
        round_title: 'Manche 1',
        started_at: null,
        elapsed_seconds: 0,
        resumed_at: null,
        question_timer_running: false,
        question_timer_started_at: null,
      })
      .eq('id', 'main');
  } else {
    await client
      .from('participants')
      .update({ score: 0, score_updated_at: now })
      .neq('id', '');
    await client
      .from('competitions')
      .update({
        status: 'PREPARATION',
        elapsed_seconds: 0,
        started_at: null,
        resumed_at: null,
        question_timer_running: false,
        question_timer_started_at: null,
      })
      .eq('id', 'main');
  }
}
