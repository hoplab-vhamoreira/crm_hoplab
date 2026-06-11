/**
 * Conformidade e administração — RGPD Art. 30
 * Ver registos de consentimento, audit log, tratar pedidos de apagamento.
 */
import { useEffect, useState } from 'react'
import { tfFrom } from '../lib/supabase'
import { useAuth } from '../context/auth'
import { logAudit } from '../lib/audit'

interface ConsentRow { id: string; user_id: string; scope: string; granted: boolean; policy_version: string; granted_at: string; revoked_at: string | null; patient_name?: string }
interface AuditRow   { id: number; actor_id: string | null; action: string; resource_type: string; resource_id: string | null; created_at: string }

export function CompliancePage() {
  const { profile } = useAuth()
  const [consents, setConsents]     = useState<ConsentRow[]>([])
  const [auditLog, setAuditLog]     = useState<AuditRow[]>([])
  const [tab, setTab]               = useState<'consents' | 'audit' | 'deletion'>('consents')
  const [loading, setLoading]       = useState(true)
  const [deletionId, setDeletionId] = useState('')
  const [deleting, setDeleting]     = useState(false)

  useEffect(() => { if (profile?.id) load() }, [profile?.id, tab])

  async function load() {
    setLoading(true)
    if (tab === 'consents') {
      // Consentimentos dos utentes do terapeuta
      const { data: links } = await tfFrom('therapist_patient_links').select('patient_id').eq('therapist_id', profile!.id).eq('status', 'active')
      const pids = (links ?? []).map(l => l.patient_id).filter(Boolean)
      if (!pids.length) { setConsents([]); setLoading(false); return }
      const { data: co } = await tfFrom('consents').select('*').in('user_id', pids).order('granted_at', { ascending: false })
      const { data: pts } = await tfFrom('tf_users').select('id, full_name').in('id', pids)
      const nameMap = new Map((pts ?? []).map(p => [p.id, p.full_name]))
      setConsents((co ?? []).map(c => ({ ...c, patient_name: nameMap.get(c.user_id) ?? 'Utente' })))
    } else if (tab === 'audit') {
      const { data } = await tfFrom('audit_log').select('id, actor_id, action, resource_type, resource_id, created_at').order('created_at', { ascending: false }).limit(100)
      setAuditLog(data ?? [])
    }
    setLoading(false)
  }

  async function handleDeletion() {
    if (!deletionId.trim()) return
    if (!confirm(`Confirma o apagamento de todos os dados do utilizador ${deletionId}? Esta ação é irreversível.`)) return
    setDeleting(true)
    // Em produção: chamar Edge Function com SECURITY DEFINER que elimina dados de saúde + auth.users
    await logAudit('data.deletion_requested', 'tf_users', deletionId)
    alert(`Pedido de apagamento registado para ${deletionId}.\nImplementar Edge Function de eliminação segura.`)
    setDeleting(false); setDeletionId('')
  }

  return (
    <div>
      <h1 className="page-title">Conformidade RGPD</h1>
      <p className="page-sub">Registos de consentimento, audit log e direitos dos titulares de dados.</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {([['consents', 'Consentimentos'], ['audit', 'Audit log'], ['deletion', 'Apagamento']] as const).map(([key, label]) => (
          <button key={key} className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {loading && tab !== 'deletion' ? <div className="empty-state"><span className="spinner" /></div> : (
        <>
          {/* Consentimentos */}
          {tab === 'consents' && (
            consents.length === 0
              ? <div className="empty-state">Sem registos.</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {consents.map(c => (
                    <div key={c.id} className="card" style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, marginBottom: 2 }}>{c.patient_name}</div>
                          <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-xs)', color: 'var(--text-2)' }}>{c.scope} · v{c.policy_version}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          <span className={`badge ${c.granted && !c.revoked_at ? 'badge-green' : 'badge-red'}`}>
                            {c.granted && !c.revoked_at ? 'Activo' : 'Revogado'}
                          </span>
                          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)' }}>
                            {new Date(c.granted_at).toLocaleDateString('pt-PT')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
          )}

          {/* Audit log */}
          {tab === 'audit' && (
            auditLog.length === 0
              ? <div className="empty-state">Sem registos.</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {auditLog.map(a => (
                    <div key={a.id} className="card" style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-sm)', fontWeight: 600 }}>{a.action}</span>
                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                          {new Date(a.created_at).toLocaleString('pt-PT')}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 2 }}>
                        {a.resource_type}{a.resource_id ? ` · ${a.resource_id}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
          )}

          {/* Apagamento */}
          {tab === 'deletion' && (
            <div className="card" style={{ maxWidth: 480 }}>
              <div className="section-title">Direito ao apagamento (Art. 17 RGPD)</div>
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-2)', marginBottom: 20 }}>
                Introduza o ID do utilizador para registar e processar o pedido de apagamento completo de dados.
                Esta ação elimina todos os dados de saúde, consentimentos, logs e a conta de autenticação.
              </p>
              <div className="field">
                <label>ID do utilizador (UUID)</label>
                <input value={deletionId} onChange={e => setDeletionId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              </div>
              <button className="btn btn-danger" disabled={!deletionId.trim() || deleting} onClick={handleDeletion}>
                {deleting ? <span className="spinner" /> : 'Solicitar apagamento'}
              </button>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 12 }}>
                Requer implementação de Edge Function com SECURITY DEFINER para eliminação segura em cascata.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
