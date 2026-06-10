import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, tfFrom } from '../lib/supabase'
import { useAuth } from '../context/auth'
import { logAudit } from '../lib/audit'
import type { TfUser, TherapistPatientLink } from '@tf/types'

const UI_LABEL: Record<string, string> = { focus: 'Adulto', adventure: 'Criança', calm: 'Sénior' }

function DirectLinkBox({ link, compact = false }: { link: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
  }
  return (
    <div style={{ background: 'var(--bg-2, #f5f5f5)', border: '1px solid var(--border)', borderRadius: 8, padding: compact ? '8px 10px' : '12px 14px', marginTop: 12 }}>
      {!compact && <p style={{ margin: '0 0 6px', fontSize: 'var(--font-xs)', color: 'var(--text-2)', fontWeight: 600 }}>🔗 Link de acesso directo</p>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          readOnly
          value={link}
          style={{ flex: 1, fontSize: 11, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'white', overflow: 'hidden', textOverflow: 'ellipsis' }}
          onFocus={e => e.target.select()}
        />
        <button className="btn btn-ghost btn-sm" onClick={copy} style={{ whiteSpace: 'nowrap', minWidth: 70 }}>
          {copied ? '✅ Copiado' : '📋 Copiar'}
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

    if (linksErr) {
      console.error('load links error:', linksErr)
      if (showSpinner) setLoading(false)
      return
    }

    // Buscar perfis dos pacientes activos (patient_id não nulo)
    const patientIds = (links ?? []).map((l: any) => l.patient_id).filter(Boolean) as string[]
    let profileMap: Record<string, TfUser> = {}
    if (patientIds.length) {
      const { data: profiles } = await tfFrom('tf_users')
        .select('id, full_name, role, ui_variant, created_at')
        .in('id', patientIds)
      for (const p of profiles ?? []) profileMap[(p as any).id] = p as TfUser
    }

    setRows((links ?? []).map((l: any) => ({ ...l, patient: l.patient_id ? (profileMap[l.patient_id] ?? null) : null })) as any)
    if (showSpinner) setLoading(false)
  }

  async function invokeInvite(email: string): Promise<{ error?: string; directLink?: string; emailSent?: boolean }> {
    const { data: { session: sess }, error: sessErr } = await supabase.auth.refreshSession()
    if (!sess || sessErr) return { error: 'A sessão expirou. Por favor refresca a página (F5) e tenta novamente.' }
    const { data, error } = await supabase.functions.invoke('invite-patient', {
      body: { patient_email: email },
    })
    if (!data?.ok) return { error: data?.error ?? (error ? 'Erro de rede. Tenta novamente.' : 'Erro desconhecido.') }
    return {
      directLink: data.direct_link ?? null,
      emailSent: data.email_sent ?? false,
    }
  }

  async function sendInvite() {
    if (!patientEmail.trim()) return
    setCreating(true); setInviteError(''); setDirectLink(null)
    const result = await invokeInvite(patientEmail.trim().toLowerCase())
    setCreating(false)
    if (result.error) { setInviteError(result.error); return }
    if (result.directLink) setDirectLink(result.directLink)
    await logAudit('invite.sent', 'therapist_patient_links')
    setInviteSent(true)
    load()
  }

  async function resendInvite(patientEmail: string, rowId: string) {
    setResending(rowId)
    setResendMsg(null)
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Utentes</h1>
          <p className="page-sub">Gerir utentes e convites.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowInvite(true); setInviteSent(false); setPatientEmail('') }}>
          + Convidar utente
        </button>
      </div>

      {/* Modal de convite */}
      {showInvite && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: 420, padding: 32 }}>
            {!inviteSent ? (
              <>
                <h2 style={{ margin: '0 0 8px', fontSize: 'var(--font-xl)' }}>Convidar utente</h2>
                <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)', marginBottom: 20 }}>
                  O utente recebe um email com um link de acesso directo. Não precisa de criar password — pode defini-la depois do primeiro acesso.
                </p>
                <div className="field">
                  <label>Email do utente *</label>
                  <input
                    type="email"
                    value={patientEmail}
                    onChange={e => setPatientEmail(e.target.value)}
                    placeholder="utente@email.pt"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && sendInvite()}
                  />
                </div>
                {inviteError && <p style={{ color: 'var(--error)', fontSize: 'var(--font-sm)', marginBottom: 12 }}>{inviteError}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={closeInvite}>Cancelar</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={!patientEmail.trim() || creating} onClick={sendInvite}>
                    {creating ? <span className="spinner" /> : '✉️ Enviar convite'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                  <h2 style={{ margin: '0 0 8px' }}>Convite criado!</h2>
                  <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)' }}>
                    {directLink
                      ? <>Copia o link abaixo e envia directamente ao utente <strong>{patientEmail}</strong>.</>
                      : <>O utente <strong>{patientEmail}</strong> recebeu um email com o link de acesso.</>
                    }
                  </p>
                </div>
                {directLink && (
                  <DirectLinkBox link={directLink} />
                )}
                <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={closeInvite}>
                  Fechar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>Utente</th><th>Email</th><th>Perfil</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-2)', padding: 40 }}>
                Sem utentes ainda. Convida o primeiro!
              </td></tr>
            )}
            {rows.map(row => (
              <tr key={row.id}>
                <td style={{ fontWeight: 600 }}>{row.patient?.full_name ?? '—'}</td>
                <td style={{ fontSize: 'var(--font-sm)', color: 'var(--text-2)' }}>{(row as any).patient_email ?? '—'}</td>
                <td>
                  {row.patient ? (
                    <span className="badge badge-blue">{UI_LABEL[row.patient.ui_variant ?? ''] ?? '—'}</span>
                  ) : '—'}
                </td>
                <td>
                  <span className={`badge ${row.status === 'active' ? 'badge-green' : row.status === 'pending' ? 'badge-yellow' : 'badge-red'}`}>
                    {row.status === 'active' ? 'Activo' : row.status === 'pending' ? 'Convite enviado' : 'Revogado'}
                  </span>
                </td>
                <td>
                  {row.status === 'active' && row.patient_id && (
                    <button className="btn btn-ghost btn-sm" onClick={() => nav(`/patients/${row.patient_id}`)}>Ver</button>
                  )}
                  {row.status === 'pending' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={resending === row.id}
                        onClick={() => resendInvite((row as any).patient_email, row.id)}
                      >
                        {resending === row.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '↩ Reenviar'}
                      </button>
                      {resendMsg?.id === row.id && (
                        <>
                          <span style={{ fontSize: 'var(--font-xs)', color: resendMsg.ok ? 'var(--success, green)' : 'var(--error)' }}>
                            {resendMsg.text}
                          </span>
                          {resendMsg.directLink && <DirectLinkBox link={resendMsg.directLink} compact />}
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
