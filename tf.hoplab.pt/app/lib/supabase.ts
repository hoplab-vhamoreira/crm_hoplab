import * as SecureStore from 'expo-secure-store'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

/** Mapeamento tabelas tf.* → views public.* (evita expor schema tf no PostgREST) */
const TF_TABLE_MAP: Record<string, string> = {
  'tf_users':                   'tf_users',
  'consents':                   'tf_consents',
  'therapist_patient_links':    'tf_links',
  'feedback_shortcuts':         'tf_feedback_sc',
  'audit_log':                  'tf_audit_log',
  'exercises':                  'tf_exercises',
  'treatment_plans':            'tf_plans',
  'plan_exercises':             'tf_plan_exercises',
  'adherence_logs':             'tf_adherence',
  'video_submissions':          'tf_submissions',
  'messages':                   'tf_messages',
  'streaks':                    'tf_streaks',
  'badges':                     'tf_badges',
  'push_tokens':                'tf_push_tokens',
}

export const tfFrom = (table: string) => supabase.from(TF_TABLE_MAP[table] ?? table)
