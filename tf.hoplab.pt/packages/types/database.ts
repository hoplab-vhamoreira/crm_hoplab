/**
 * Tipos gerados manualmente a partir do schema `tf` no Supabase.
 * Sincronizar com infra/migrations sempre que o schema mudar.
 *
 * NÃO adicionar lógica clínica aqui — ver docs/compliance.md.
 */

// ------------------------------------------------------------------
// ENUMs (espelham os CREATE TYPE tf.* da migration 001)
// ------------------------------------------------------------------

export type UserRole =
  | 'patient_adult'
  | 'patient_senior'
  | 'parent'
  | 'caregiver'
  | 'therapist'
  | 'clinic_admin'

export type UIVariant = 'focus' | 'adventure' | 'calm'

export type ClinicalArea =
  | 'respiracao'
  | 'ressonancia'
  | 'articulacao'
  | 'tom'
  | 'voz'
  | 'mof'
  | 'linguagem'
  | 'gaguez'

export type ConsentScope =
  | 'health_data_processing'
  | 'video_recording'
  | 'video_sharing_with_therapist'
  | 'push_notifications'

export type LinkStatus = 'pending' | 'active' | 'revoked'

export type SelfRating = 1 | 2 | 3 | 4 | 5

// ------------------------------------------------------------------
// ROW TYPES (espelham colunas das tabelas)
// ------------------------------------------------------------------

export interface TfUser {
  id: string                   // UUID — corresponde a auth.users.id
  role: UserRole
  ui_variant: UIVariant
  full_name: string | null
  license_number: string | null  // cédula ACSS — só terapeutas
  guardian_id: string | null     // responsável legal — só menores
  created_at: string             // ISO 8601
  updated_at: string
}

export interface Consent {
  id: string
  user_id: string
  scope: ConsentScope
  granted: boolean
  policy_version: string         // ex: "1.0"
  granted_at: string
  revoked_at: string | null
  ip_hash: string | null
}

export interface TherapistPatientLink {
  id: string
  therapist_id: string
  patient_id: string | null
  invite_code: string
  status: LinkStatus
  linked_at: string | null
  revoked_at: string | null
  created_at: string
}

export interface FeedbackShortcut {
  id: string
  therapist_id: string
  category: ClinicalArea
  label: string
  body: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: number
  actor_id: string | null
  action: string                 // ex: 'video.viewed', 'plan.updated'
  resource_type: string          // ex: 'video', 'plan', 'consent'
  resource_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// ------------------------------------------------------------------
// INSERT TYPES (campos opcionais com defaults no DB)
// ------------------------------------------------------------------

export type TfUserInsert = Omit<TfUser, 'created_at' | 'updated_at'>

export type ConsentInsert = Omit<Consent, 'id' | 'granted_at'>

export type TherapistPatientLinkInsert = Pick<
  TherapistPatientLink,
  'therapist_id'
> & Partial<Pick<TherapistPatientLink, 'patient_id'>>

export type FeedbackShortcutInsert = Omit<
  FeedbackShortcut,
  'id' | 'created_at' | 'updated_at'
>

export type AuditLogInsert = Omit<AuditLog, 'id' | 'created_at'>

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------

/** Deriva a variante de UI a partir do papel do utilizador */
export function uiVariantForRole(role: UserRole): UIVariant {
  if (role === 'patient_senior') return 'calm'
  if (role === 'parent') return 'adventure'
  return 'focus'
}

/** Verifica se todos os scopes obrigatórios estão concedidos */
export function hasRequiredConsents(
  consents: Consent[],
  policyVersion: string
): boolean {
  const required: ConsentScope[] = ['health_data_processing']
  const active = new Set(
    consents
      .filter(c => c.granted && !c.revoked_at && c.policy_version === policyVersion)
      .map(c => c.scope)
  )
  return required.every(s => active.has(s))
}
