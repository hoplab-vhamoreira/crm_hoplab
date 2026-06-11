import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, tfFrom } from '../lib/supabase'
import { useAuth } from '../context/auth'
import { logAudit } from '../lib/audit'
import { Icon } from '../components/Icon'
import type { TfUser, TherapistPatientLink } from '@tf/types'

const UI_LABEL: Record<string, string> = { focus: 'Adulto', adventure: 'Criança', calm: 'Sénior' }

function DirectLinkBox({ link, compact = false }: { link: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
  }
  return (
    <div style={{ background: 'var(--primary-lt)', border: '1.5px solid var(--eira-ocean)', borderRadius: 'var(--radius-sm)', padding: compact ? '8px 10px' : '12px 14px', marginTop: 12 }}>
      {!compact && <p style={{ margin: '0 0 6px', fontSize: 'var(--font-xs)', color: 'var(--eira-ocean)', fontWeight: 600 }}>Link de acesso directo</p>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          readOnly value={link}
          style={{ flex: 1, fontSize: 11, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'white', overflow: 'hidden', textOverflow: 'ellipsis' }}
          onFocus={e => e.target.select()}
        />
        <button className="btn btn-ghost btn-sm" onClick={copy} style={{ whiteSpace: 'nowrap', gap: 4 }}>
          <Icon name={copied ? 'check' : 'copy'} size={14} />
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      {!compact && <p style={{ margin: '6px 0 0', fontSize: 'var(--font-xs)', color: 'var(--text-2)' }}>Envia este link ao utente. Expira em 24h.</p>}
    </div>
  )
}

export function PatientsPage() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [rows, setRows] = useState<(TherapistPatientLink & { patient: TfUser | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [patientEmail, setPatientEmail] = useState('')
  const [inviteSent, setInviteSent] = useState(false)
  const [creating, setCreating] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [resending, setResending] = useState<string | null>(null)
  const [resendMsg, setResendMsg] = useState<{ id: string; ok: boolean; text: string; directLink?: string } | null>(null)
  const [directLink, setDirectLink] = useState<string | null>(null)

  useEffect(() => { if (profile?.id) load(true) }, [profile?.id])

  async function load(showSpinner = false) {
    if (showSpinner) setLoading(true)
    const { data: links, error: linksErr } = await tfFrom('therapist_patient_links')
      .select('id, patient_id, patient_email, status, invite_code, created_at')
      .eq('therapist_id', profile!.id)
      .order('created_at', { ascending: false })
    if (linksErr) { if (showSpinner) setLoading(false); return }
    const patientIds = (links ?? []).map((l: any) => l.patient_id).filter(Boolean) as string[]
    let profileMap: Record<string, TfUser> = {}
    if (patientIds.length) {
      const { data: profiles } = await tfFrom('tf_users').select('id, full_name, role, ui_variant, created_at').in('id', patientIds)
      for (const p of profiles ?? []) profileMap[(p as any).id] = p as TfUser
    }
    setRows((links ?? []).map((l: any) => ({ ...l, patient: l.patient_id ? (profileMap[l.patient_id] ?? null) : null })) as any)
    if (showSpinner) setLoading(false)
  }

  async function invokeInvite(email: string): Promise<{ error?: string; directLink?: string; emailSent?: boolean }> {
    const { data: { session: sess }, error: sessErr } = await supabase.auth.refreshSession()
    if (!sess || sessErr) return { error: 'A sessão expirou. Por favor refresca a página (F5) e tenta novamente.' }
    const { data, error } = await supabase.functions.invoke('invite-patient', { body: { patient_email: email } })
    if (!data?.ok) return { error: data?.error ?? (error ? 'Erro de rede. Tenta novamente.' : 'Erro desconhecido.') }
    return { directLink: data.direct_link ?? null, emailSent: data.email_sent ?? false }
  }

  async function sendInvite() {
    if (!patientEmail.trim()) return
    setCreating(true); setInviteError(''); setDirectLink(null)
    const result = await invokeInvite(patientEmail.trim().toLowerCase())
    setCreating(false)
    if (result.error) { setInviteError(result.error); return }
    if (result.directLink) setDirectLink(result.directLink)
    await logAudit('invite.sent', 'therapist_patient_links')
    setInviteSent(true); load()
  }

  async function resendInvite(patientEmail: string, rowId: string) {
    setResending(rowId); setResendMsg(null)
    const result = await invokeInvite(patientEmail)
    setResending(null)
    if (result.error) {
      setResendMsg({ id: rowId, ok: false, text: result.error })
    } else {
      setResendMsg({ id: rowId, ok: true, text: result.directLink ? 'Novo link gerado!' : 'Convite reenviado!', directLink: result.directLink })
      if (!result.directLink) setTimeout(() => setResendMsg(null), 4000)
    }
  }

  function closeInvite() {
    setShowInvite(false); setPatientEmail(''); setInviteSent(false); setInviteError(''); setDirectLink(null)
  }

  if (loading) return <div className="empty-state"><span className="spinner" /></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12 }}>
        <div>
          <h1 className="page-title">Utentes</h1>
          <p className="page-sub">Gerir utentes e convites.</p>
        </div>
        <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={() => { setShowInvite(true); setInviteSent(false); setPatientEmail('') }}>
          <Icon name="plus" size={16} /> Convidar
        </button>
      </div>

      {/* Modal convite */}
      {showInvite && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 420, padding: 28 }}>
            {!inviteSent ? (
              <>
                <h2 style={{ margin: '0 0 8px', fontSize: 'var(--font-xl)' }}>Convidar utente</h2>
                <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)', marginBottom: 20 }}>
                  O utente recebe um email com link de acesso directo. Não precisa de criar password.
                </p>
                <div className="field">
                  <label>Email do utente *</label>
                  <input type="email" value={patientEmail} onChange={e => setPatientEmail(e.target.value)}
                    placeholder="utente@email.pt" autoFocus onKeyDown={e => e.key === 'Enter' && sendInvite()} />
                </div>
                {inviteError && <p style={{ color: 'var(--error)', fontSize: 'var(--font-sm)', marginBottom: 12 }}>{inviteError}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={closeInvite}>Cancelar</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={!patientEmail.trim() || creating} onClick={sendInvite}>
                    {creating ? <span className="spinner" /> : <><Icon name="send" size={15} /> Enviar</>}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', padding: '12px 0 16px' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--success-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Icon name="check" size={28} style={{ color: 'var(--success)' }} />
                  </div>
                  <h2 style={{ margin: '0 0 8px' }}>Convite criado!</h2>
                  <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)' }}>
                    {directLink
                      ? <>Copia o link abaixo e envia ao utente <strong>{patientEmail}</strong>.</>
                      : <>O utente <strong>{patientEmail}</strong> recebeu o email com o link.</>}
                  </p>
                </div>
                {directLink && <DirectLinkBox link={directLink} />}
                <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={closeInvite}>Fechar</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Lista de utentes — cards em vez de tabela */}
      {rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <Icon name="users" size={40} style={{ color: 'var(--eira-mist)', marginBottom: 12 }} />
          <p style={{ color: 'var(--text-2)' }}>Sem utentes ainda. Convida o primeiro!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(row => (
            <div key={row.id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Avatar inicial */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: row.status === 'active' ? 'var(--primary-lt)' : 'var(--eira-mist)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--eira-ocean)',
                }}>
                  {row.patient?.full_name?.charAt(0).toUpperCase() ?? '?'}
                </div>

                {/* Info principal */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--font-md)' }}>
                      {row.patient?.full_name ?? (row as any).patient_email ?? '—'}
                    </span>
                    <span className={`badge ${row.status === 'active' ? 'badge-green' : row.status === 'pending' ? 'badge-yellow' : 'badge-red'}`}>
                      {row.status === 'active' ? 'Activo' : row.status === 'pending' ? 'Convite enviado' : 'Revogado'}
                    </span>
                    {row.patient && (
                      <span className="badge badge-blue">{UI_LABEL[row.patient.ui_variant ?? ''] ?? '—'}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 2 }}>
                    {(row as any).patient_email ?? ''}
                  </div>
                </div>

                {/* Acção */}
                {row.status === 'active' && row.patient_id && (
                  <button className="btn btn-ghost btn-sm" onClick={() => nav(`/patients/${row.patient_id}`)}>
                    Ver <Icon name="chevron-right" size={14} />
                  </button>
                )}
                {row.status === 'pending' && (
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={resending === row.id}
                    onClick={() => resendInvite((row as any).patient_email, row.id)}
                  >
                    {resending === row.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <><Icon name="refresh" size={14} /> Reenviar</>}
                  </button>
                )}
              </div>

              {resendMsg?.id === row.id && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 'var(--font-xs)', color: resendMsg.ok ? 'var(--success)' : 'var(--error)' }}>
                    {resendMsg.text}
                  </span>
                  {resendMsg.directLink && <DirectLinkBox link={resendMsg.directLink} compact />}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
