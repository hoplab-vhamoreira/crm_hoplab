import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { tfFrom } from '../lib/supabase'
import { useAuth } from '../context/auth'
import { Icon } from '../components/Icon'
import type { TfUser, TreatmentPlan, Streak, Consent } from '@tf/types'

interface Appt {
  id: string
  kind: 'presencial' | 'online'
  starts_at: string
  location_or_link: string | null
  status: 'proposta' | 'confirmada' | 'realizada' | 'cancelada'
}

export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const { profile } = useAuth()
  const nav = useNavigate()
  const [patient, setPatient] = useState<TfUser | null>(null)
  const [plans, setPlans] = useState<TreatmentPlan[]>([])
  const [streak, setStreak] = useState<Streak | null>(null)
  const [consents, setConsents] = useState<Consent[]>([])
  const [appts, setAppts] = useState<Appt[]>([])
  const [pendingRequests, setPendingRequests] = useState<{ id: string; created_at: string; message: string | null }[]>([])
  const [newAppt, setNewAppt] = useState<{ starts_at: string; kind: 'presencial' | 'online'; location: string } | null>(null)
  const [cancelling, setCancelling] = useState<Appt | null>(null)
  const [cancellingBusy, setCancellingBusy] = useState(false)
  const [savingAppt, setSavingAppt] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (patientId) load() }, [patientId])

  async function load() {
    setLoading(true)
    const [p, pl, st, co, ap, rq] = await Promise.all([
      tfFrom('tf_users').select('*').eq('id', patientId!).single(),
      tfFrom('treatment_plans').select('*').eq('patient_id', patientId!).order('created_at', { ascending: false }),
      tfFrom('streaks').select('*').eq('patient_id', patientId!).single(),
      tfFrom('consents').select('*').eq('user_id', patientId!).order('granted_at', { ascending: false }),
      tfFrom('appointments').select('id, kind, starts_at, location_or_link, status').eq('patient_id', patientId!).gte('starts_at', new Date(Date.now() - 86400000).toISOString()).order('starts_at'),
      tfFrom('appointment_requests').select('id, created_at, message').eq('patient_id', patientId!).eq('status', 'pendente'),
    ])
    setPatient(p.data); setPlans(pl.data ?? []); setStreak(st.data); setConsents(co.data ?? [])
    setAppts((ap.data ?? []) as Appt[]); setPendingRequests(rq.data ?? [])
    setLoading(false)
  }

  async function saveAppointment() {
    if (!newAppt?.starts_at || !profile) return
    setSavingAppt(true)
    await tfFrom('appointments').insert({
      therapist_id: profile.id,
      patient_id: patientId!,
      kind: newAppt.kind,
      starts_at: new Date(newAppt.starts_at).toISOString(),
      location_or_link: newAppt.location.trim() || null,
      status: 'confirmada',
      created_by: profile.id,
    })
    // Marca pedidos pendentes como aceites
    if (pendingRequests.length) {
      await tfFrom('appointment_requests').update({ status: 'aceite' }).eq('patient_id', patientId!).eq('status', 'pendente')
    }
    setSavingAppt(false); setNewAppt(null); load()
  }

  async function setApptStatus(id: string, status: Appt['status']) {
    await tfFrom('appointments').update({ status }).eq('id', id)
    load()
  }

  async function confirmCancel() {
    if (!cancelling) return
    setCancellingBusy(true)
    await setApptStatus(cancelling.id, 'cancelada')
    setCancellingBusy(false)
    setCancelling(null)
  }

  if (loading) return <div className="empty-state"><span className="spinner" /></div>
  if (!patient) return <div className="empty-state">Utente não encontrado.</div>

  const activePlan = plans.find(p => p.is_active)

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => nav('/patients')}>← Utentes</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">{patient.full_name ?? 'Utente sem nome'}</h1>
          <p className="page-sub">{patient.role} · variante {patient.ui_variant}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => nav(`/messages/${patientId}`)}><Icon name="chat" size={15} /> Mensagens</button>
          <button className="btn btn-primary" onClick={() => nav(`/patients/${patientId}/plan/new`)}>+ Novo plano</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20, marginBottom: 20 }}>
        {/* Adesão factual */}
        <div className="card">
          <div className="section-title">Adesão (factual)</div>
          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', fontStyle: 'italic', marginBottom: 12 }}>
            Dados descritivos — a interpretação clínica é exclusivamente do terapeuta.
          </p>
          <div style={{ display: 'flex', gap: 24 }}>
            {[
              { label: 'Dias seguidos', value: streak?.current_streak ?? 0 },
              { label: 'Melhor sequência', value: streak?.longest_streak ?? 0 },
              { label: 'Total sessões', value: streak?.total_sessions ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700 }}>{value}</div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Consentimentos */}
        <div className="card">
          <div className="section-title">Consentimentos</div>
          {consents.length === 0
            ? <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)' }}>Sem registos.</p>
            : consents.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-sm)', padding: '4px 0' }}>
                <span>{c.scope}</span>
                <span className={`badge ${c.granted && !c.revoked_at ? 'badge-green' : 'badge-red'}`}>
                  {c.granted && !c.revoked_at ? 'Activo' : 'Revogado'}
                </span>
              </div>
            ))
          }
        </div>
      </div>

      {/* Consultas */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="section-title" style={{ margin: 0 }}>Consultas</div>
          {!newAppt && (
            <button className="btn btn-primary btn-sm" onClick={() => setNewAppt({ starts_at: '', kind: 'presencial', location: '' })}>+ Marcar</button>
          )}
        </div>

        {pendingRequests.length > 0 && (
          <div style={{ background: 'var(--primary-lt)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 12, fontSize: 'var(--font-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="calendar" size={15} style={{ color: 'var(--eira-ocean)', flexShrink: 0 }} />
              O utente pediu uma consulta ({new Date(pendingRequests[0].created_at).toLocaleDateString('pt-PT')}). Marque uma data para aceitar.
            </div>
            {pendingRequests[0].message && (
              <div style={{ marginTop: 6, paddingLeft: 23, fontWeight: 600, color: 'var(--eira-ocean)' }}>
                Preferência do utente: {pendingRequests[0].message}
              </div>
            )}
          </div>
        )}

        {newAppt && (
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Data e hora *</label>
                <input type="datetime-local" value={newAppt.starts_at} onChange={e => setNewAppt(v => ({ ...v!, starts_at: e.target.value }))} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Tipo</label>
                <select value={newAppt.kind} onChange={e => setNewAppt(v => ({ ...v!, kind: e.target.value as 'presencial' | 'online' }))}>
                  <option value="presencial">Presencial</option>
                  <option value="online">Online</option>
                </select>
              </div>
            </div>
            <div className="field" style={{ marginTop: 10, marginBottom: 10 }}>
              <label>{newAppt.kind === 'online' ? 'Link da chamada' : 'Local'}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newAppt.location} onChange={e => setNewAppt(v => ({ ...v!, location: e.target.value }))}
                  placeholder={newAppt.kind === 'online' ? 'https://…' : 'Ex: Clínica X, Gabinete 2'} style={{ flex: 1 }} />
                {newAppt.kind === 'online' && (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                    onClick={() => setNewAppt(v => ({ ...v!, location: `https://meet.jit.si/eira-${crypto.randomUUID().slice(0, 12)}` }))}>
                    <Icon name="video" size={14} /> Gerar link
                  </button>
                )}
              </div>
              {newAppt.kind === 'online' && (
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 6, marginBottom: 0 }}>
                  "Gerar link" cria uma sala Jitsi Meet (gratuito, open-source, sem conta). O utente entra com um clique.
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setNewAppt(null)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" disabled={!newAppt.starts_at || savingAppt} onClick={saveAppointment}>
                {savingAppt ? <span className="spinner" /> : 'Confirmar consulta'}
              </button>
            </div>
          </div>
        )}

        {appts.length === 0 && !newAppt
          ? <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)', margin: 0 }}>Sem consultas futuras.</p>
          : appts.map(a => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={a.kind === 'online' ? 'video' : 'location'} size={15} style={{ color: 'var(--eira-ocean)' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>
                    {new Date(a.starts_at).toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {a.location_or_link && <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.location_or_link}</div>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                {a.kind === 'online' && a.location_or_link && (a.status === 'proposta' || a.status === 'confirmada') && (
                  <a className="btn btn-primary btn-sm" href={a.location_or_link} target="_blank" rel="noreferrer">
                    <Icon name="video" size={14} /> Entrar
                  </a>
                )}
                <span className={`badge ${a.status === 'confirmada' ? 'badge-green' : a.status === 'cancelada' ? 'badge-red' : 'badge-blue'}`}>{a.status}</span>
                {(a.status === 'proposta' || a.status === 'confirmada') && (
                  <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => setCancelling(a)} title="Cancelar consulta">
                    <Icon name="close" size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        }
      </div>

      {/* Planos */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title" style={{ margin: 0 }}>Planos de tratamento</div>
        </div>
        {plans.length === 0
          ? <p className="empty-state">Sem planos. Crie o primeiro.</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {plans.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.title}</div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)' }}>
                      Semana {p.current_week}/{p.total_weeks}
                      {p.starts_on ? ` · início ${p.starts_on}` : ''}
                    </div>
                  </div>
                  <span className={`badge ${p.is_active ? 'badge-green' : 'badge-blue'}`} style={{ flexShrink: 0 }}>
                    {p.is_active ? 'Activo' : 'Concluído'}
                  </span>
                  <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={() => nav(`/patients/${patientId}/plan/${p.id}`)}>
                    <Icon name="edit" size={14} />
                  </button>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Modal: confirmar cancelamento de consulta */}
      {cancelling && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 400, padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--error-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="warning" size={18} style={{ color: 'var(--eira-danger)' }} />
              </div>
              <h2 style={{ margin: 0, fontSize: 'var(--font-lg)' }}>Cancelar consulta?</h2>
            </div>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-2)', marginBottom: 20 }}>
              {new Date(cancelling.starts_at).toLocaleString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
              {cancelling.kind === 'online' ? ' · online' : cancelling.location_or_link ? ` · ${cancelling.location_or_link}` : ''}
              <br />O utente deixa de ver esta consulta como marcada.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setCancelling(null)} disabled={cancellingBusy}>
                Manter
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmCancel} disabled={cancellingBusy}>
                {cancellingBusy ? <span className="spinner" /> : 'Cancelar consulta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
