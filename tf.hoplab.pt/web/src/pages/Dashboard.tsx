import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tfFrom } from '../lib/supabase'
import { useAuth } from '../context/auth'

interface PendingReview { id: string; patient_id: string; created_at: string; patient_name?: string }
interface UnreadMsg    { link_id: string; count: number; patient_name?: string; patient_id?: string }

export function DashboardPage() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [reviews, setReviews] = useState<PendingReview[]>([])
  const [unread,  setUnread]  = useState<UnreadMsg[]>([])
  const [lowAdherence, setLowAdherence] = useState<{ id: string; full_name: string | null; days: number }[]>([])
  const [apptRequests, setApptRequests] = useState<{ id: string; patient_id: string; created_at: string; patient_name?: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile?.id) load() }, [profile?.id])

  async function load() {
    setLoading(true)

    // Revisões pendentes
    const { data: revData } = await tfFrom('video_submissions')
      .select('id, patient_id, created_at')
      .eq('therapist_id', profile!.id)
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true })
      .limit(20)

    // Utentes com baixa adesão (sem actividade nos últimos 3 dias)
    const { data: streakData } = await tfFrom('streaks')
      .select('patient_id, last_active_date')
      .lte('last_active_date', new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10))

    // Pedidos de consulta pendentes
    const { data: reqData } = await tfFrom('appointment_requests')
      .select('id, patient_id, created_at')
      .eq('therapist_id', profile!.id)
      .eq('status', 'pendente')
      .order('created_at', { ascending: true })

    // Nomes dos utentes
    const patientIds = [
      ...new Set([...(revData ?? []).map(r => r.patient_id), ...(streakData ?? []).map(s => s.patient_id), ...(reqData ?? []).map(r => r.patient_id)])
    ]
    const { data: patients } = patientIds.length
      ? await tfFrom('tf_users').select('id, full_name').in('id', patientIds)
      : { data: [] }

    const nameMap = new Map((patients ?? []).map(p => [p.id, p.full_name]))

    setReviews((revData ?? []).map(r => ({ ...r, patient_name: nameMap.get(r.patient_id) ?? 'Utente' })))
    setApptRequests((reqData ?? []).map(r => ({ ...r, patient_name: nameMap.get(r.patient_id) ?? 'Utente' })))

    setLowAdherence((streakData ?? []).map(s => {
      const days = s.last_active_date
        ? Math.floor((Date.now() - new Date(s.last_active_date).getTime()) / 86400000)
        : 999
      return { id: s.patient_id, full_name: nameMap.get(s.patient_id) ?? null, days }
    }))

    setLoading(false)
  }

  if (loading) return <div className="empty-state"><span className="spinner" /></div>

  return (
    <div>
      <h1 className="page-title">Painel</h1>
      <p className="page-sub">Bom dia — aqui está o resumo do dia.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>

        {/* Revisões pendentes */}
        <div className="card">
          <div className="section-title">📹 Revisões pendentes</div>
          {reviews.length === 0
            ? <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)' }}>Nenhuma pendente. ✅</p>
            : reviews.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.patient_name}</div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)' }}>{formatDate(r.created_at)}</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => nav('/reviews')}>Rever</button>
              </div>
            ))
          }
        </div>

        {/* Pedidos de consulta */}
        {apptRequests.length > 0 && (
          <div className="card">
            <div className="section-title">🗓️ Pedidos de consulta</div>
            {apptRequests.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.patient_name}</div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)' }}>{formatDate(r.created_at)}</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => nav(`/patients/${r.patient_id}`)}>Marcar</button>
              </div>
            ))}
          </div>
        )}

        {/* Baixa adesão */}
        <div className="card">
          <div className="section-title">⚠️ Baixa adesão (factual)</div>
          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginBottom: 12, fontStyle: 'italic' }}>
            Dias sem actividade registada — sem interpretação clínica.
          </p>
          {lowAdherence.length === 0
            ? <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)' }}>Todos activos recentemente. ✅</p>
            : lowAdherence.map(u => (
              <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600 }}>{u.full_name ?? 'Utente'}</div>
                <span className="badge badge-yellow">{u.days} dias</span>
              </div>
            ))
          }
        </div>

        {/* Atalhos rápidos */}
        <div className="card">
          <div className="section-title">⚡ Ações rápidas</div>
          {[
            { label: '+ Novo utente',       action: () => nav('/patients') },
            { label: '+ Novo exercício',    action: () => nav('/exercises') },
            { label: 'Gerir atalhos',       action: () => nav('/shortcuts') },
            { label: 'Registos conformidade', action: () => nav('/compliance') },
          ].map(({ label, action }) => (
            <button key={label} className="btn btn-ghost btn-sm" style={{ width: '100%', marginBottom: 8, justifyContent: 'flex-start' }} onClick={action}>
              {label}
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
