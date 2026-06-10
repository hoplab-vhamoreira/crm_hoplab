import { supabase } from './supabase'
import type { AuditLogInsert } from '../../packages/types'

/**
 * Regista uma ação sensível no audit_log.
 * Falha silenciosamente para não bloquear o fluxo do utilizador —
 * mas lança um erro de console para monitorização.
 */
export async function logAudit(entry: Omit<AuditLogInsert, 'actor_id'>) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.schema('tf').from('audit_log').insert({
    ...entry,
    actor_id: user?.id ?? null,
  })
  if (error) console.error('[audit]', error.message, entry)
}
