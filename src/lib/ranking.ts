import type {
  Competition,
  Participant,
  RankedParticipant,
  ScoreEvent,
  TieBreakerRule,
} from '../types/quiz';

export function normalizeParticipantKey(firstName: string, lastName: string): string {
  return `${firstName.trim().toLowerCase().replace(/\s+/g, ' ')}|${lastName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')}`;
}

export function formatDisplayName(p: Pick<Participant, 'first_name' | 'last_name' | 'nickname'>): string {
  const full = `${p.first_name.trim()} ${p.last_name.trim()}`.trim();
  return p.nickname && p.nickname.trim().length > 0 ? `${full} (${p.nickname.trim()})` : full;
}

export function getInitials(firstName: string, lastName: string): string {
  const f = firstName.trim().charAt(0).toUpperCase();
  const l = lastName.trim().charAt(0).toUpperCase();
  return `${f}${l}` || 'QC';
}

export function rankParticipants(
  participants: Participant[],
  tieBreaker: TieBreakerRule = 'EARLIEST_REACHED'
): RankedParticipant[] {
  const activeOrPaused = participants.filter((p) => p.status !== 'DISQUALIFIED');
  const disqualified = participants.filter((p) => p.status === 'DISQUALIFIED');

  const compare = (a: Participant, b: Participant): number => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    if (tieBreaker === 'EARLIEST_REACHED') {
      const aTime = Date.parse(a.score_updated_at || a.created_at);
      const bTime = Date.parse(b.score_updated_at || b.created_at);
      if (aTime !== bTime) {
        return aTime - bTime;
      }
    }

    if (tieBreaker === 'JOIN_ORDER') {
      const aCreated = Date.parse(a.created_at);
      const bCreated = Date.parse(b.created_at);
      if (aCreated !== bCreated) {
        return aCreated - bCreated;
      }
    }

    const nameA = `${a.last_name} ${a.first_name}`.toLowerCase();
    const nameB = `${b.last_name} ${b.first_name}`.toLowerCase();
    return nameA.localeCompare(nameB, 'fr');
  };

  const sortedActive = [...activeOrPaused].sort(compare);
  const sortedDisqualified = [...disqualified].sort(compare);

  const rankedActive: RankedParticipant[] = sortedActive.map((p, index) => ({
    ...p,
    rank: index + 1,
    isLeader: index === 0 && p.status === 'ACTIVE',
    displayName: formatDisplayName(p),
  }));

  const rankedDisqualified: RankedParticipant[] = sortedDisqualified.map((p) => ({
    ...p,
    rank: null,
    isLeader: false,
    displayName: formatDisplayName(p),
  }));

  return [...rankedActive, ...rankedDisqualified];
}

export function computeElapsedSeconds(
  competition: Pick<Competition, 'status' | 'elapsed_seconds' | 'resumed_at'>,
  nowMs: number = Date.now()
): number {
  if (competition.status === 'LIVE' && competition.resumed_at) {
    const startedMs = Date.parse(competition.resumed_at);
    if (!Number.isNaN(startedMs)) {
      const deltaSec = Math.max(0, Math.floor((nowMs - startedMs) / 1000));
      return competition.elapsed_seconds + deltaSec;
    }
  }
  return competition.elapsed_seconds;
}

export function computeQuestionTimerRemaining(
  competition: Pick<
    Competition,
    'question_timer_seconds' | 'question_timer_running' | 'question_timer_started_at'
  >,
  nowMs: number = Date.now()
): number {
  if (!competition.question_timer_running || !competition.question_timer_started_at) {
    return competition.question_timer_seconds;
  }
  const startedMs = Date.parse(competition.question_timer_started_at);
  if (Number.isNaN(startedMs)) {
    return competition.question_timer_seconds;
  }
  const elapsed = Math.floor((nowMs - startedMs) / 1000);
  return Math.max(0, competition.question_timer_seconds - elapsed);
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function requiresLargeDeltaConfirmation(
  delta: number,
  confirmEnabled: boolean,
  threshold: number
): boolean {
  if (!confirmEnabled) return false;
  return Math.abs(delta) >= Math.max(1, threshold);
}

export function buildLeaderboardCsv(
  participants: RankedParticipant[],
  events: ScoreEvent[]
): string {
  const escapeCell = (val: string | number | null): string => {
    const str = val === null || val === undefined ? '' : String(val);
    if (/[",;\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    ['Rang', 'Prénom', 'Nom', 'Pseudonyme', 'Score', 'Statut', 'Opérations'].join(';'),
  ];

  for (const p of participants) {
    const opsCount = events.filter((e) => e.participant_id === p.id && !e.reverted).length;
    lines.push(
      [
        p.rank ?? 'DQ',
        p.first_name,
        p.last_name,
        p.nickname ?? '',
        p.score,
        p.status,
        opsCount,
      ]
        .map(escapeCell)
        .join(';')
    );
  }

  return lines.join('\n');
}
