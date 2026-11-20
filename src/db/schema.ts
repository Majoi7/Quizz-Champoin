import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('HOST'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const competitions = pgTable('competitions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  subtitle: text('subtitle').notNull(),
  status: text('status').notNull().default('PREPARATION'),
  registrationsOpen: boolean('registrations_open').notNull().default(true),
  requirePhone: boolean('require_phone').notNull().default(false),
  confirmLargeDelta: boolean('confirm_large_delta').notNull().default(true),
  largeDeltaThreshold: integer('large_delta_threshold').notNull().default(20),
  tieBreaker: text('tie_breaker').notNull().default('EARLIEST_REACHED'),
  pointsCorrect: integer('points_correct').notNull().default(10),
  pointsWrong: integer('points_wrong').notNull().default(-5),
  pointsBonus: integer('points_bonus').notNull().default(20),
  currentRound: integer('current_round').notNull().default(1),
  roundTitle: text('round_title').notNull().default('Manche 1'),
  startedAt: text('started_at'),
  elapsedSeconds: integer('elapsed_seconds').notNull().default(0),
  resumedAt: text('resumed_at'),
  questionTimerSeconds: integer('question_timer_seconds').notNull().default(30),
  questionTimerRunning: boolean('question_timer_running').notNull().default(false),
  questionTimerStartedAt: text('question_timer_started_at'),
});

export const participants = pgTable('participants', {
  id: text('id').primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  nickname: text('nickname'),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  score: integer('score').notNull().default(0),
  status: text('status').notNull().default('ACTIVE'),
  scoreUpdatedAt: text('score_updated_at').notNull(),
  createdAt: text('created_at').notNull(),
  normalizedKey: text('normalized_key').notNull().unique(),
});

export const scoreEvents = pgTable('score_events', {
  id: text('id').primaryKey(),
  participantId: text('participant_id').notNull(),
  participantName: text('participant_name').notNull(),
  delta: integer('delta').notNull(),
  previousScore: integer('previous_score').notNull(),
  newScore: integer('new_score').notNull(),
  reason: text('reason').notNull(),
  roundNumber: integer('round_number').notNull().default(1),
  adminName: text('admin_name').notNull(),
  reverted: boolean('reverted').notNull().default(false),
  createdAt: text('created_at').notNull(),
});
