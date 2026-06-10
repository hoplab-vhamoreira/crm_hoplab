import { supabase, tfFrom } from './supabase'

export async function logAudit(action: string, resourceType: string, resourceId?: string, metadata?: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser()
  await tfFrom('audit_log').insert({
    actor_id: user?.id ?? null,
    action,
    resource_type: resourceType,
    resource_id: resourceId ?? null,
    metadata: metadata ?? null,
  })
}
