-- ============================================================================
-- QUIZ CHAMPION LIVE — Schéma Supabase PostgreSQL & Realtime
-- Exécutez ce script dans Supabase -> SQL Editor -> New query
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'HOST',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.competitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PREPARATION',
  registrations_open BOOLEAN NOT NULL DEFAULT TRUE,
  require_phone BOOLEAN NOT NULL DEFAULT FALSE,
  confirm_large_delta BOOLEAN NOT NULL DEFAULT TRUE,
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
  question_timer_running BOOLEAN NOT NULL DEFAULT FALSE,
  question_timer_started_at TEXT
);

CREATE TABLE IF NOT EXISTS public.participants (
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

CREATE TABLE IF NOT EXISTS public.score_events (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  participant_name TEXT NOT NULL,
  delta INTEGER NOT NULL,
  previous_score INTEGER NOT NULL,
  new_score INTEGER NOT NULL,
  reason TEXT NOT NULL,
  round_number INTEGER NOT NULL DEFAULT 1,
  admin_name TEXT NOT NULL,
  reverted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_score_events_created_at
  ON public.score_events (created_at DESC);

-- Ligne compétition par défaut
INSERT INTO public.competitions (
  id, name, subtitle, status, registrations_open, require_phone,
  confirm_large_delta, large_delta_threshold, tie_breaker,
  points_correct, points_wrong, points_bonus, current_round, round_title,
  elapsed_seconds, question_timer_seconds, question_timer_running
) VALUES (
  'main', 'QUIZ CHAMPION LIVE', 'Compétition de culture générale',
  'PREPARATION', TRUE, FALSE, TRUE, 20, 'EARLIEST_REACHED',
  10, -5, 20, 1, 'Manche 1', 0, 30, FALSE
)
ON CONFLICT (id) DO NOTHING;

-- Activation de Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;

-- Lecture publique pour l'Écran Live, le Classement et Supabase Realtime
DROP POLICY IF EXISTS "Public read competitions" ON public.competitions;
CREATE POLICY "Public read competitions"
  ON public.competitions FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Public read participants" ON public.participants;
CREATE POLICY "Public read participants"
  ON public.participants FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Public read score_events" ON public.score_events;
CREATE POLICY "Public read score_events"
  ON public.score_events FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- Active Supabase Realtime sur les tables temps réel
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'competitions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.competitions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'score_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.score_events;
  END IF;
END $$;
