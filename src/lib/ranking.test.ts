import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLeaderboardCsv,
  computeElapsedSeconds,
  computeQuestionTimerRemaining,
  formatDisplayName,
  formatDuration,
  normalizeParticipantKey,
  rankParticipants,
  requiresLargeDeltaConfirmation,
} from './ranking';
import type { Participant } from '../types/quiz';

const baseParticipants: Participant[] = [
  {
    id: 'p1',
    first_name: 'Jean',
    last_name: 'Kouassi',
    nickname: 'Le Stratège',
    phone: null,
    avatar_url: null,
    score: 100,
    status: 'ACTIVE',
    score_updated_at: '2026-11-19T20:05:00.000Z',
    created_at: '2026-11-19T19:00:00.000Z',
  },
  {
    id: 'p2',
    first_name: 'Marie',
    last_name: 'Adjovi',
    nickname: null,
    phone: null,
    avatar_url: null,
    score: 100,
    status: 'ACTIVE',
    score_updated_at: '2026-11-19T20:02:00.000Z',
    created_at: '2026-11-19T19:05:00.000Z',
  },
  {
    id: 'p3',
    first_name: 'Paul',
    last_name: 'Hounkpatin',
    nickname: null,
    phone: null,
    avatar_url: null,
    score: 120,
    status: 'DISQUALIFIED',
    score_updated_at: '2026-11-19T20:01:00.000Z',
    created_at: '2026-11-19T18:55:00.000Z',
  },
  {
    id: 'p4',
    first_name: 'Sarah',
    last_name: 'Mensah',
    nickname: null,
    phone: null,
    avatar_url: null,
    score: 70,
    status: 'PAUSED',
    score_updated_at: '2026-11-19T20:03:00.000Z',
    created_at: '2026-11-19T19:10:00.000Z',
  },
];

test('rankParticipants sorts descending and breaks ties by earliest reached', () => {
  const ranked = rankParticipants(baseParticipants, 'EARLIEST_REACHED');
  assert.equal(ranked[0].id, 'p2');
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[0].isLeader, true);
  assert.equal(ranked[1].id, 'p1');
  assert.equal(ranked[1].rank, 2);
  assert.equal(ranked[2].id, 'p4');
  assert.equal(ranked[2].rank, 3);
  assert.equal(ranked[3].id, 'p3');
  assert.equal(ranked[3].rank, null);
  assert.equal(ranked[3].isLeader, false);
});

test('rankParticipants supports alphabetical tie-breaking', () => {
  const ranked = rankParticipants(baseParticipants, 'ALPHABETICAL');
  assert.equal(ranked[0].id, 'p2'); // Adjovi before Kouassi
  assert.equal(ranked[1].id, 'p1');
});

test('rankParticipants supports join order tie-breaking', () => {
  const ranked = rankParticipants(baseParticipants, 'JOIN_ORDER');
  assert.equal(ranked[0].id, 'p1'); // p1 joined at 19:00 before p2 at 19:05
  assert.equal(ranked[1].id, 'p2');
});

test('normalizeParticipantKey trims and lowercases spacing', () => {
  assert.equal(
    normalizeParticipantKey('  Jean   Luc ', ' KOUASSI '),
    'jean luc|kouassi'
  );
  assert.equal(
    formatDisplayName({ first_name: 'Jean', last_name: 'Kouassi', nickname: 'JK' }),
    'Jean Kouassi (JK)'
  );
});

test('timer calculations compute accurate live durations', () => {
  const elapsed = computeElapsedSeconds(
    {
      status: 'LIVE',
      elapsed_seconds: 120,
      resumed_at: '2026-11-19T20:00:00.000Z',
    },
    Date.parse('2026-11-19T20:01:15.000Z')
  );
  assert.equal(elapsed, 195);
  assert.equal(formatDuration(195), '03:15');
  assert.equal(formatDuration(3665), '01:01:05');

  const qRem = computeQuestionTimerRemaining(
    {
      question_timer_seconds: 30,
      question_timer_running: true,
      question_timer_started_at: '2026-11-19T20:00:00.000Z',
    },
    Date.parse('2026-11-19T20:00:12.000Z')
  );
  assert.equal(qRem, 18);
});

test('large delta confirmation and CSV generation', () => {
  assert.equal(requiresLargeDeltaConfirmation(20, true, 20), true);
  assert.equal(requiresLargeDeltaConfirmation(-25, true, 20), true);
  assert.equal(requiresLargeDeltaConfirmation(10, true, 20), false);
  assert.equal(requiresLargeDeltaConfirmation(50, false, 20), false);

  const ranked = rankParticipants(baseParticipants, 'EARLIEST_REACHED');
  const csv = buildLeaderboardCsv(ranked, []);
  assert.ok(csv.includes('Rang;Prénom;Nom;Pseudonyme;Score;Statut;Opérations'));
  assert.ok(csv.includes('1;Marie;Adjovi;;100;ACTIVE;0'));
});
