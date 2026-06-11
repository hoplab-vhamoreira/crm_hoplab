import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: true, persistSession: true } }
)

/**
 * Mapeamento tabelas tf.* → views public.*
 * As views apontam para tf.*; RLS das tabelas base aplica-se.
 * Evita ter de expor o schema tf no PostgREST.
 */
const T: Record<string, string> = {
  'tf_users':                'tf_users',
  'consents':                'tf_consents',
  'therapist_patient_links': 'tf_links',
  'feedback_shortcuts':      'tf_feedback_sc',
  'audit_log':               'tf_audit_log',
  'exercises':               'tf_exercises',
  'treatment_plans':         'tf_plans',
  'plan_exercises':          'tf_plan_exercises',
  'adherence_logs':          'tf_adherence',
  'video_submissions':       'tf_submissions',
  'messages':                'tf_messages',
  'streaks':                 'tf_streaks',
  'badges':                  'tf_badges',
  'push_tokens':             'tf_push_tokens',
  'appointments':            'tf_appointments',
  'appointment_requests':    'tf_appt_requests',
  'plan_templates':          'tf_plan_templates',
}

/** Substituição de supabase.schema('tf').from(table) */
export const tf = () => supabase  // mantém a API idêntica — ver nota abaixo

/**
 * NOTA: como .schema('tf') não está exposto, usar tfFrom() em vez de
 * tf().from('table'). A API do Supabase JS é idêntica.
 *
 * Antes:  tf().from('tf_users').select(...)
 * Depois: tfFrom('tf_users').select(...)
 */
export const tfFrom = (table: string) => supabase.from(T[table] ?? table)
