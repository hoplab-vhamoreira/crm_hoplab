-- ============================================================
-- SpeechCraft — Fase 1: Planos, exercícios, adesão, vídeos
-- Aplicado em: crm_hoplab (bocwqacwalzshjkhjzwi) eu-west-1
-- ============================================================

CREATE TYPE tf.self_rating AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE tf.submission_status AS ENUM ('pending_review', 'reviewed', 'archived');

CREATE TABLE tf.exercises (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id    UUID NOT NULL REFERENCES tf.tf_users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  instructions    TEXT,
  video_url       TEXT,
  clinical_area   tf.clinical_area NOT NULL,
  duration_seconds INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tf.treatment_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id    UUID NOT NULL REFERENCES tf.tf_users(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES tf.tf_users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  total_weeks     INT NOT NULL DEFAULT 6,
  current_week    INT NOT NULL DEFAULT 1,
  starts_on       DATE NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tf.plan_exercises (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES tf.treatment_plans(id) ON DELETE CASCADE,
  exercise_id     UUID NOT NULL REFERENCES tf.exercises(id) ON DELETE RESTRICT,
  week_number     INT NOT NULL,
  sets            INT NOT NULL DEFAULT 1,
  reps            INT,
  duration_seconds INT,
  day_of_week     INT[],
  sort_order      INT NOT NULL DEFAULT 0,
  therapist_notes TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tf.adherence_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES tf.tf_users(id) ON DELETE CASCADE,
  plan_exercise_id UUID NOT NULL REFERENCES tf.plan_exercises(id) ON DELETE CASCADE,
  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  completed       BOOLEAN NOT NULL DEFAULT false,
  self_rating     tf.self_rating,
  sets_done       INT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, plan_exercise_id, session_date)
);

CREATE TABLE tf.video_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES tf.tf_users(id) ON DELETE CASCADE,
  therapist_id    UUID NOT NULL REFERENCES tf.tf_users(id) ON DELETE CASCADE,
  plan_exercise_id UUID REFERENCES tf.plan_exercises(id) ON DELETE SET NULL,
  storage_path    TEXT NOT NULL,
  status          tf.submission_status NOT NULL DEFAULT 'pending_review',
  patient_note    TEXT,
  therapist_feedback TEXT,
  shortcut_ids    UUID[],
  reviewed_at     TIMESTAMPTZ,
  delete_after    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON tf.exercises (therapist_id, clinical_area);
CREATE INDEX ON tf.treatment_plans (patient_id, is_active);
CREATE INDEX ON tf.treatment_plans (therapist_id);
CREATE INDEX ON tf.plan_exercises (plan_id, week_number, sort_order);
CREATE INDEX ON tf.adherence_logs (patient_id, session_date);
CREATE INDEX ON tf.adherence_logs (plan_exercise_id);
CREATE INDEX ON tf.video_submissions (patient_id, status);
CREATE INDEX ON tf.video_submissions (therapist_id, status);
CREATE INDEX ON tf.video_submissions (delete_after) WHERE status != 'archived';

CREATE TRIGGER trg_exercises_updated_at
  BEFORE UPDATE ON tf.exercises
  FOR EACH ROW EXECUTE FUNCTION tf.set_updated_at();

CREATE TRIGGER trg_treatment_plans_updated_at
  BEFORE UPDATE ON tf.treatment_plans
  FOR EACH ROW EXECUTE FUNCTION tf.set_updated_at();

ALTER TABLE tf.exercises         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tf.treatment_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tf.plan_exercises    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tf.adherence_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tf.video_submissions ENABLE ROW LEVEL SECURITY;

-- (políticas — ver migration aplicada no Supabase)
