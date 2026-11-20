import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  normalizeParticipantKey,
  rankParticipants,
} from '../src/lib/ranking';
import type {
  AdminUser,
  Competition,
  CompetitionStatus,
  FullQuizState,
  Participant,
  ParticipantStatus,
  RankedParticipant,
  ScoreEvent,
  ScoreReason,
  TieBreakerRule,
} from '../src/types/quiz';

function resolveDbPath(): string {
  const customPath = process.env.SQLITE_PATH?.trim();
  if (customPath) {
    const dir = path.dirname(customPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return customPath;
  }

  if (process.env.VERCEL) {
    return path.join('/tmp', 'quiz.sqlite');
  }

  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'quiz.sqlite');
}

const DB_PATH = resolveDbPath();
export const db = new Database(DB_PATH);
db.pragma('busy_timeout = 5000');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function hashPassword(password: string, salt?: string): string {
  const actualSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return `${actualSalt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

let dbInitialized = false;

export function initDatabase(): void {
  if (dbInitialized) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS competitions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PREPARATION',
      registrations_open INTEGER NOT NULL DEFAULT 1,
      require_phone INTEGER NOT NULL DEFAULT 0,
      confirm_large_delta INTEGER NOT NULL DEFAULT 1,
      large_delta_threshold INTEGER NOT NULL DEFAULT 20,
      tie_breaker TEXT NOT NULL DEFAULT 'EARLIEST_REACHED',
      points_correct INTEGER NOT NULL DEFAULT 10,
      points_wrong INTEGER NOT NULL DEFAULT -5,
      points_bonus INTEGER NOT NULL DEFAULT 20,
      current_round INTEGER NOT NULL DEFAULT 1,
      round_title TEXT NOT NULL DEFAULT 'Manche 1',
      started_at TEXT,
      elapsed_seconds INTEGER NOT NULL DEFAULT 0,
      resumed_at TEXT,
      question_timer_seconds INTEGER NOT NULL DEFAULT 30,
      question_timer_running INTEGER NOT NULL DEFAULT 0,
      question_timer_started_at TEXT
    );

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      nickname TEXT,
      phone TEXT,
      avatar_url TEXT,
      score INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      score_updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      normalized_key TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS score_events (
      id TEXT PRIMARY KEY,
      participant_id TEXT NOT NULL,
      participant_name TEXT NOT NULL,
      delta INTEGER NOT NULL,
      previous_score INTEGER NOT NULL,
      new_score INTEGER NOT NULL,
      reason TEXT NOT NULL,
      round_number INTEGER NOT NULL DEFAULT 1,
      admin_name TEXT NOT NULL,
      reverted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    );
  `);

  const now = new Date().toISOString();
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@quizchampion.live').trim();
  const adminName = (process.env.ADMIN_NAME || 'Régie Principale').trim();
  const adminPasscode = process.env.ADMIN_PASSCODE || 'CHAMPION2026';

  const bootstrap = db.transaction(() => {
    db.prepare(`
      INSERT OR IGNORE INTO competitions (
        id, name, subtitle, status, registrations_open, require_phone,
        confirm_large_delta, large_delta_threshold, tie_breaker,
        points_correct, points_wrong, points_bonus, current_round, round_title,
        started_at, elapsed_seconds, resumed_at, question_timer_seconds,
        question_timer_running, question_timer_started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'main',
      'QUIZ CHAMPION LIVE',
      'Compétition de culture générale',
      'PREPARATION',
      1,
      0,
      1,
      20,
      'EARLIEST_REACHED',
      10,
      -5,
      20,
      1,
      'Manche 1',
      null,
      0,
      null,
      30,
      0,
      null
    );

    const existingByEmail = db
      .prepare('SELECT id FROM admins WHERE lower(email) = lower(?)')
      .get(adminEmail) as { id: string } | undefined;

    if (!existingByEmail) {
      const existingById = db
        .prepare('SELECT id FROM admins WHERE id = ?')
        .get('adm_principal') as { id: string } | undefined;

      if (existingById) {
        db.prepare(`
          UPDATE admins
          SET email = ?, name = ?, password_hash = ?
          WHERE id = ?
        `).run(adminEmail, adminName, hashPassword(adminPasscode), 'adm_principal');
      } else {
        db.prepare(`
          INSERT OR IGNORE INTO admins (id, email, name, role, password_hash, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          'adm_principal',
          adminEmail,
          adminName,
          'SUPER_ADMIN',
          hashPassword(adminPasscode),
          now
        );
      }
    }
  });

  bootstrap.immediate();
  dbInitialized = true;
}

function mapCompetitionRow(row: Record<string, unknown>): Competition {
  return {
    id: String(row.id),
    name: String(row.name),
    subtitle: String(row.subtitle),
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
    round_title: String(row.round_title),
    started_at: row.started_at ? String(row.started_at) : null,
    elapsed_seconds: Number(row.elapsed_seconds),
    resumed_at: row.resumed_at ? String(row.resumed_at) : null,
    question_timer_seconds: Number(row.question_timer_seconds),
    question_timer_running: Boolean(row.question_timer_running),
    question_timer_started_at: row.question_timer_started_at
      ? String(row.question_timer_started_at)
      : null,
  };
}

function mapParticipantRow(row: Record<string, unknown>): Participant {
  return {
    id: String(row.id),
    first_name: String(row.first_name),
    last_name: String(row.last_name),
    nickname: row.nickname ? String(row.nickname) : null,
    phone: row.phone ? String(row.phone) : null,
    avatar_url: row.avatar_url ? String(row.avatar_url) : null,
    score: Number(row.score),
    status: row.status as ParticipantStatus,
    score_updated_at: String(row.score_updated_at),
    created_at: String(row.created_at),
  };
}

function mapEventRow(row: Record<string, unknown>): ScoreEvent {
  return {
    id: String(row.id),
    participant_id: String(row.participant_id),
    participant_name: String(row.participant_name),
    delta: Number(row.delta),
    previous_score: Number(row.previous_score),
    new_score: Number(row.new_score),
    reason: row.reason as ScoreReason,
    round_number: Number(row.round_number),
    admin_name: String(row.admin_name),
    reverted: Boolean(row.reverted),
    created_at: String(row.created_at),
  };
}

export function getCompetition(): Competition {
  initDatabase();
  const row = db.prepare('SELECT * FROM competitions WHERE id = ?').get('main') as Record<string, unknown>;
  return mapCompetitionRow(row);
}

export function getRankedParticipants(): RankedParticipant[] {
  initDatabase();
  const comp = getCompetition();
  const rows = db.prepare('SELECT * FROM participants').all() as Record<string, unknown>[];
  return rankParticipants(rows.map(mapParticipantRow), comp.tie_breaker);
}

export function getRecentEvents(limit = 100): ScoreEvent[] {
  initDatabase();
  const rows = db
    .prepare('SELECT * FROM score_events ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[];
  return rows.map(mapEventRow);
}

export function getFullQuizState(): FullQuizState {
  initDatabase();
  return {
    competition: getCompetition(),
    participants: getRankedParticipants(),
    recentEvents: getRecentEvents(100),
    serverTime: new Date().toISOString(),
  };
}

export function authenticateAdmin(
  email: string,
  passcode: string
): { token: string; admin: AdminUser } | null {
  initDatabase();
  const row = db
    .prepare('SELECT * FROM admins WHERE lower(email) = lower(?)')
    .get(email.trim()) as Record<string, unknown> | undefined;

  if (!row || !verifyPassword(passcode, String(row.password_hash))) {
    return null;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    'INSERT INTO admin_sessions (token, admin_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).run(token, String(row.id), expiresAt, now.toISOString());

  return {
    token,
    admin: {
      id: String(row.id),
      email: String(row.email),
      name: String(row.name),
      role: row.role as 'SUPER_ADMIN' | 'HOST',
    },
  };
}

export function getAdminByToken(token: string | undefined): AdminUser | null {
  initDatabase();
  if (!token) return null;
  const row = db
    .prepare(`
      SELECT a.id, a.email, a.name, a.role, s.expires_at
      FROM admin_sessions s
      JOIN admins a ON a.id = s.admin_id
      WHERE s.token = ?
    `)
    .get(token) as Record<string, unknown> | undefined;

  if (!row) return null;
  if (Date.parse(String(row.expires_at)) < Date.now()) {
    db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
    return null;
  }

  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: row.role as 'SUPER_ADMIN' | 'HOST',
  };
}

export function revokeAdminSession(token: string): void {
  initDatabase();
  db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
}

export interface RegisterInput {
  first_name: string;
  last_name: string;
  nickname?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
}

export function createParticipant(
  input: RegisterInput,
  options: { bypassRegistrationLock?: boolean } = {}
): RankedParticipant {
  initDatabase();
  const comp = getCompetition();
  if (!options.bypassRegistrationLock && !comp.registrations_open) {
    throw new Error('REGISTRATIONS_CLOSED');
  }

  const firstName = input.first_name.trim();
  const lastName = input.last_name.trim();
  const nickname = input.nickname?.trim() || null;
  const phone = input.phone?.trim() || null;
  const avatarUrl = input.avatar_url?.trim() || null;

  if (firstName.length < 2 || lastName.length < 2) {
    throw new Error('INVALID_NAME');
  }

  if (!options.bypassRegistrationLock && comp.require_phone && !phone) {
    throw new Error('PHONE_REQUIRED');
  }

  const normalizedKey = normalizeParticipantKey(firstName, lastName);
  const existingByName = db
    .prepare('SELECT id FROM participants WHERE normalized_key = ?')
    .get(normalizedKey);
  if (existingByName) {
    throw new Error('DUPLICATE_PARTICIPANT');
  }

  if (phone) {
    const cleanPhone = phone.replace(/\s+/g, '');
    const allPhones = db
      .prepare('SELECT id, phone FROM participants WHERE phone IS NOT NULL')
      .all() as { id: string; phone: string }[];
    const phoneMatch = allPhones.find((p) => p.phone.replace(/\s+/g, '') === cleanPhone);
    if (phoneMatch) {
      throw new Error('DUPLICATE_PHONE');
    }
  }

  const now = new Date().toISOString();
  const id = `p_${crypto.randomBytes(6).toString('hex')}`;

  db.prepare(`
    INSERT INTO participants (
      id, first_name, last_name, nickname, phone, avatar_url, score,
      status, score_updated_at, created_at, normalized_key
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 'ACTIVE', ?, ?, ?)
  `).run(id, firstName, lastName, nickname, phone, avatarUrl, now, now, normalizedKey);

  const ranked = getRankedParticipants();
  const created = ranked.find((p) => p.id === id);
  if (!created) throw new Error('CREATE_FAILED');
  return created;
}

export function updateParticipantDetails(
  id: string,
  updates: Partial<{
    first_name: string;
    last_name: string;
    nickname: string | null;
    phone: string | null;
    avatar_url: string | null;
    status: ParticipantStatus;
  }>
): RankedParticipant {
  initDatabase();
  const existingRow = db.prepare('SELECT * FROM participants WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!existingRow) throw new Error('NOT_FOUND');

  const firstName = (updates.first_name ?? String(existingRow.first_name)).trim();
  const lastName = (updates.last_name ?? String(existingRow.last_name)).trim();
  if (firstName.length < 2 || lastName.length < 2) {
    throw new Error('INVALID_NAME');
  }

  const normalizedKey = normalizeParticipantKey(firstName, lastName);
  const dup = db
    .prepare('SELECT id FROM participants WHERE normalized_key = ? AND id != ?')
    .get(normalizedKey, id);
  if (dup) throw new Error('DUPLICATE_PARTICIPANT');

  const nickname =
    updates.nickname !== undefined
      ? updates.nickname?.trim() || null
      : (existingRow.nickname as string | null);
  const phone =
    updates.phone !== undefined
      ? updates.phone?.trim() || null
      : (existingRow.phone as string | null);
  const avatarUrl =
    updates.avatar_url !== undefined
      ? updates.avatar_url?.trim() || null
      : (existingRow.avatar_url as string | null);
  const status = updates.status ?? (existingRow.status as ParticipantStatus);

  db.prepare(`
    UPDATE participants
    SET first_name = ?, last_name = ?, nickname = ?, phone = ?, avatar_url = ?, status = ?, normalized_key = ?
    WHERE id = ?
  `).run(firstName, lastName, nickname, phone, avatarUrl, status, normalizedKey, id);

  const updated = getRankedParticipants().find((p) => p.id === id);
  if (!updated) throw new Error('NOT_FOUND');
  return updated;
}

export function deleteParticipant(id: string): void {
  initDatabase();
  const res = db.prepare('DELETE FROM participants WHERE id = ?').run(id);
  if (res.changes === 0) throw new Error('NOT_FOUND');
}

export function applyScoreMutation(
  participantId: string,
  delta: number,
  reason: ScoreReason,
  adminName: string
): {
  event: ScoreEvent;
  participants: RankedParticipant[];
  previousLeaderId: string | null;
  newLeaderId: string | null;
} {
  initDatabase();
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error('INVALID_DELTA');
  }

  const tx = db.transaction(() => {
    const comp = getCompetition();
    const beforeRanked = getRankedParticipants();
    const previousLeaderId = beforeRanked.find((p) => p.isLeader)?.id ?? null;

    const pRow = db
      .prepare('SELECT * FROM participants WHERE id = ?')
      .get(participantId) as Record<string, unknown> | undefined;
    if (!pRow) throw new Error('NOT_FOUND');
    if (pRow.status === 'DISQUALIFIED') {
      throw new Error('PARTICIPANT_DISQUALIFIED');
    }

    const previousScore = Number(pRow.score);
    const newScore = previousScore + Math.trunc(delta);
    const now = new Date().toISOString();
    const participantName = `${pRow.first_name} ${pRow.last_name}`.trim();
    const eventId = `evt_${crypto.randomBytes(6).toString('hex')}`;

    db.prepare('UPDATE participants SET score = ?, score_updated_at = ? WHERE id = ?').run(
      newScore,
      now,
      participantId
    );

    db.prepare(`
      INSERT INTO score_events (
        id, participant_id, participant_name, delta, previous_score, new_score,
        reason, round_number, admin_name, reverted, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      eventId,
      participantId,
      participantName,
      Math.trunc(delta),
      previousScore,
      newScore,
      reason,
      comp.current_round,
      adminName,
      now
    );

    const afterRanked = getRankedParticipants();
    const newLeaderId = afterRanked.find((p) => p.isLeader)?.id ?? null;
    const eventRow = db.prepare('SELECT * FROM score_events WHERE id = ?').get(eventId) as Record<
      string,
      unknown
    >;

    return {
      event: mapEventRow(eventRow),
      participants: afterRanked,
      previousLeaderId,
      newLeaderId: newLeaderId !== previousLeaderId ? newLeaderId : null,
    };
  });

  return tx();
}

export function resetSingleParticipantScore(
  participantId: string,
  adminName: string
): {
  event: ScoreEvent;
  participants: RankedParticipant[];
  previousLeaderId: string | null;
  newLeaderId: string | null;
} {
  initDatabase();
  const tx = db.transaction(() => {
    const comp = getCompetition();
    const beforeRanked = getRankedParticipants();
    const previousLeaderId = beforeRanked.find((p) => p.isLeader)?.id ?? null;

    const pRow = db
      .prepare('SELECT * FROM participants WHERE id = ?')
      .get(participantId) as Record<string, unknown> | undefined;
    if (!pRow) throw new Error('NOT_FOUND');

    const previousScore = Number(pRow.score);
    const delta = -previousScore;
    const now = new Date().toISOString();
    const eventId = `evt_${crypto.randomBytes(6).toString('hex')}`;
    const participantName = `${pRow.first_name} ${pRow.last_name}`.trim();

    db.prepare('UPDATE participants SET score = 0, score_updated_at = ? WHERE id = ?').run(
      now,
      participantId
    );

    db.prepare(`
      INSERT INTO score_events (
        id, participant_id, participant_name, delta, previous_score, new_score,
        reason, round_number, admin_name, reverted, created_at
      ) VALUES (?, ?, ?, ?, ?, 0, 'RESET', ?, ?, 0, ?)
    `).run(eventId, participantId, participantName, delta, previousScore, comp.current_round, adminName, now);

    const afterRanked = getRankedParticipants();
    const newLeaderId = afterRanked.find((p) => p.isLeader)?.id ?? null;
    const eventRow = db.prepare('SELECT * FROM score_events WHERE id = ?').get(eventId) as Record<
      string,
      unknown
    >;

    return {
      event: mapEventRow(eventRow),
      participants: afterRanked,
      previousLeaderId,
      newLeaderId: newLeaderId !== previousLeaderId ? newLeaderId : null,
    };
  });

  return tx();
}

export function undoLastScoreOperation(adminName: string): {
  event: ScoreEvent;
  participants: RankedParticipant[];
  previousLeaderId: string | null;
  newLeaderId: string | null;
} {
  initDatabase();
  const tx = db.transaction(() => {
    const comp = getCompetition();
    const beforeRanked = getRankedParticipants();
    const previousLeaderId = beforeRanked.find((p) => p.isLeader)?.id ?? null;

    const lastEvent = db
      .prepare(`
        SELECT * FROM score_events
        WHERE reverted = 0 AND reason != 'UNDO'
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .get() as Record<string, unknown> | undefined;

    if (!lastEvent) throw new Error('NOTHING_TO_UNDO');

    const participantId = String(lastEvent.participant_id);
    const pRow = db
      .prepare('SELECT * FROM participants WHERE id = ?')
      .get(participantId) as Record<string, unknown> | undefined;

    if (!pRow) throw new Error('PARTICIPANT_NOT_FOUND');

    const currentScore = Number(pRow.score);
    const targetScore = Number(lastEvent.previous_score);
    const undoDelta = targetScore - currentScore;
    const now = new Date().toISOString();
    const undoEventId = `evt_${crypto.randomBytes(6).toString('hex')}`;

    db.prepare('UPDATE score_events SET reverted = 1 WHERE id = ?').run(String(lastEvent.id));
    db.prepare('UPDATE participants SET score = ?, score_updated_at = ? WHERE id = ?').run(
      targetScore,
      now,
      participantId
    );

    db.prepare(`
      INSERT INTO score_events (
        id, participant_id, participant_name, delta, previous_score, new_score,
        reason, round_number, admin_name, reverted, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'UNDO', ?, ?, 0, ?)
    `).run(
      undoEventId,
      participantId,
      String(lastEvent.participant_name),
      undoDelta,
      currentScore,
      targetScore,
      comp.current_round,
      adminName,
      now
    );

    const afterRanked = getRankedParticipants();
    const newLeaderId = afterRanked.find((p) => p.isLeader)?.id ?? null;
    const eventRow = db.prepare('SELECT * FROM score_events WHERE id = ?').get(undoEventId) as Record<
      string,
      unknown
    >;

    return {
      event: mapEventRow(eventRow),
      participants: afterRanked,
      previousLeaderId,
      newLeaderId: newLeaderId !== previousLeaderId ? newLeaderId : null,
    };
  });

  return tx();
}

export function updateCompetitionConfig(
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
): Competition {
  initDatabase();
  const tx = db.transaction(() => {
    const current = getCompetition();
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    let nextStatus = updates.status ?? current.status;
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
    let qTimerSeconds = updates.question_timer_seconds ?? current.question_timer_seconds;

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

    db.prepare(`
      UPDATE competitions SET
        name = ?,
        subtitle = ?,
        status = ?,
        registrations_open = ?,
        require_phone = ?,
        confirm_large_delta = ?,
        large_delta_threshold = ?,
        tie_breaker = ?,
        points_correct = ?,
        points_wrong = ?,
        points_bonus = ?,
        current_round = ?,
        round_title = ?,
        started_at = ?,
        elapsed_seconds = ?,
        resumed_at = ?,
        question_timer_seconds = ?,
        question_timer_running = ?,
        question_timer_started_at = ?
      WHERE id = 'main'
    `).run(
      (updates.name ?? current.name).trim() || current.name,
      (updates.subtitle ?? current.subtitle).trim(),
      nextStatus,
      (updates.registrations_open ?? current.registrations_open) ? 1 : 0,
      (updates.require_phone ?? current.require_phone) ? 1 : 0,
      (updates.confirm_large_delta ?? current.confirm_large_delta) ? 1 : 0,
      Math.max(1, Math.trunc(updates.large_delta_threshold ?? current.large_delta_threshold)),
      updates.tie_breaker ?? current.tie_breaker,
      Math.trunc(updates.points_correct ?? current.points_correct),
      Math.trunc(updates.points_wrong ?? current.points_wrong),
      Math.trunc(updates.points_bonus ?? current.points_bonus),
      Math.max(1, Math.trunc(updates.current_round ?? current.current_round)),
      (updates.round_title ?? current.round_title).trim() || current.round_title,
      startedAt,
      elapsedSeconds,
      resumedAt,
      Math.max(5, Math.trunc(qTimerSeconds)),
      qTimerRunning ? 1 : 0,
      qTimerStartedAt
    );

    return getCompetition();
  });

  return tx();
}

export function resetCompetitionData(mode: 'scores' | 'full'): void {
  initDatabase();
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM score_events').run();
    if (mode === 'full') {
      db.prepare('DELETE FROM participants').run();
      db.prepare(`
        UPDATE competitions SET
          status = 'PREPARATION',
          current_round = 1,
          round_title = 'Manche 1',
          started_at = NULL,
          elapsed_seconds = 0,
          resumed_at = NULL,
          question_timer_running = 0,
          question_timer_started_at = NULL
        WHERE id = 'main'
      `).run();
    } else {
      db.prepare(`UPDATE participants SET score = 0, score_updated_at = ?`).run(now);
      db.prepare(`
        UPDATE competitions SET
          status = 'PREPARATION',
          elapsed_seconds = 0,
          started_at = NULL,
          resumed_at = NULL,
          question_timer_running = 0,
          question_timer_started_at = NULL
        WHERE id = 'main'
      `).run();
    }
  });
  tx();
}
