-- ============================================================
-- SpeechCraft — Fase 0: Fundação de conformidade
-- Schema isolado "tf" para dados de saúde (RGPD Art. 9)
-- Aplicado em: crm_hoplab (bocwqacwalzshjkhjzwi) eu-west-1
-- ============================================================

CREATE SCHEMA IF NOT EXISTS tf;

-- ------------------------------------------------------------
-- ENUM TYPES
-- ------------------------------------------------------------
CREATE TYPE tf.user_role AS ENUM (
  'patient_adult',
  'patient_senior',
  'parent',
  'caregiver',
  'therapist',
  'clinic_admin'
);

CREATE TYPE tf.ui_variant AS ENUM ('focus', 'adventure', 'calm');

CREATE TYPE tf.clinical_area AS ENUM (
  'respiracao', 'ressonancia', 'articulacao',
  'tom', 'voz', 'mof', 'linguagem', 'gaguez'
);

CREATE TYPE tf.consent_scope AS ENUM (
  'health_data_processing',
  'video_recording',
  'video_sharing_with_therapist',
  'push_notifications'
);

CREATE TYPE tf.link_status AS ENUM ('pending', 'active', 'revoked');

-- ------------------------------------------------------------
-- tf_users — perfis de utilizador (ligados a auth.users)
-- ------------------------------------------------------------
CREATE TABLE tf.tf_users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          tf.user_role NOT NULL,
  ui_variant    tf.ui_variant NOT NULL,
  full_name     TEXT,
  -- Para terapeutas
  license_number TEXT,                    -- cédula profissional ACSS
  -- Para crianças: quem é o responsável legal
  guardian_id   UUID REFERENCES tf.tf_users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- consents — consentimento granular (RGPD Art. 7 + 9)
-- Imutável: cada versão de consentimento fica registada
-- ------------------------------------------------------------
CREATE TABLE tf.consents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES tf.tf_users(id) ON DELETE CASCADE,
  scope         tf.consent_scope NOT NULL,
  granted       BOOLEAN NOT NULL,
  policy_version TEXT NOT NULL,           -- ex: "1.0", "1.1"
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ,
  ip_hash       TEXT,                     -- hash do IP no momento do consentimento
  UNIQUE (user_id, scope, policy_version)
);

-- ------------------------------------------------------------
-- therapist_patient_links — ligação TF ↔ utente (via código)
-- ------------------------------------------------------------
CREATE TABLE tf.therapist_patient_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id   UUID NOT NULL REFERENCES tf.tf_users(id) ON DELETE CASCADE,
  patient_id     UUID REFERENCES tf.tf_users(id) ON DELETE SET NULL,
  invite_code    TEXT NOT NULL UNIQUE DEFAULT upper(substring(gen_random_uuid()::text, 1, 8)),
  status         tf.link_status NOT NULL DEFAULT 'pending',
  linked_at      TIMESTAMPTZ,
  revoked_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- feedback_shortcuts — atalhos do TF (conjunto fixo, curado
-- antecipadamente — NUNCA filtrado pela app com base em vídeo)
-- ------------------------------------------------------------
CREATE TABLE tf.feedback_shortcuts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id  UUID NOT NULL REFERENCES tf.tf_users(id) ON DELETE CASCADE,
  category      tf.clinical_area NOT NULL,
  label         TEXT NOT NULL,
  body          TEXT NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- audit_log — registo imutável de acessos e ações sensíveis
-- (RGPD Art. 30 + segurança — INSERT only via RLS)
-- ------------------------------------------------------------
CREATE TABLE tf.audit_log (
  id            BIGSERIAL PRIMARY KEY,
  actor_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,            -- ex: 'video.viewed', 'plan.updated'
  resource_type TEXT NOT NULL,            -- ex: 'video', 'plan', 'consent'
  resource_id   TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------
CREATE INDEX ON tf.consents (user_id, scope);
CREATE INDEX ON tf.therapist_patient_links (therapist_id);
CREATE INDEX ON tf.therapist_patient_links (patient_id);
CREATE INDEX ON tf.therapist_patient_links (invite_code);
CREATE INDEX ON tf.feedback_shortcuts (therapist_id, category);
CREATE INDEX ON tf.audit_log (actor_id);
CREATE INDEX ON tf.audit_log (created_at);
CREATE INDEX ON tf.audit_log (resource_type, resource_id);

-- ------------------------------------------------------------
-- updated_at automático
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION tf.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tf_users_updated_at
  BEFORE UPDATE ON tf.tf_users
  FOR EACH ROW EXECUTE FUNCTION tf.set_updated_at();

CREATE TRIGGER trg_feedback_shortcuts_updated_at
  BEFORE UPDATE ON tf.feedback_shortcuts
  FOR EACH ROW EXECUTE FUNCTION tf.set_updated_at();

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
ALTER TABLE tf.tf_users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tf.consents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tf.therapist_patient_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE tf.feedback_shortcuts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tf.audit_log          ENABLE ROW LEVEL SECURITY;

-- Helper: verifica se o utilizador atual é terapeuta do patient_id
CREATE OR REPLACE FUNCTION tf.is_therapist_of(patient_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM tf.therapist_patient_links
    WHERE therapist_id = auth.uid()
      AND patient_id = $1
      AND status = 'active'
  );
$$;

-- tf_users
CREATE POLICY "user_sees_own_profile"
  ON tf.tf_users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "therapist_sees_patients"
  ON tf.tf_users FOR SELECT
  USING (tf.is_therapist_of(id));

CREATE POLICY "user_inserts_own_profile"
  ON tf.tf_users FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "user_updates_own_profile"
  ON tf.tf_users FOR UPDATE
  USING (id = auth.uid());

-- consents
CREATE POLICY "user_sees_own_consents"
  ON tf.consents FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "therapist_sees_patient_consents"
  ON tf.consents FOR SELECT
  USING (tf.is_therapist_of(user_id));

CREATE POLICY "user_inserts_own_consent"
  ON tf.consents FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Consentimento não se apaga — só se revoga (UPDATE revoked_at)
CREATE POLICY "user_revokes_own_consent"
  ON tf.consents FOR UPDATE
  USING (user_id = auth.uid());

-- therapist_patient_links
CREATE POLICY "therapist_sees_own_links"
  ON tf.therapist_patient_links FOR SELECT
  USING (therapist_id = auth.uid() OR patient_id = auth.uid());

CREATE POLICY "therapist_creates_links"
  ON tf.therapist_patient_links FOR INSERT
  WITH CHECK (therapist_id = auth.uid());

CREATE POLICY "therapist_updates_links"
  ON tf.therapist_patient_links FOR UPDATE
  USING (therapist_id = auth.uid() OR patient_id = auth.uid());

-- feedback_shortcuts (só o próprio terapeuta)
CREATE POLICY "therapist_owns_shortcuts"
  ON tf.feedback_shortcuts FOR ALL
  USING (therapist_id = auth.uid())
  WITH CHECK (therapist_id = auth.uid());

-- audit_log: qualquer autenticado pode INSERT; ninguém faz SELECT via RLS
CREATE POLICY "authenticated_inserts_audit"
  ON tf.audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
