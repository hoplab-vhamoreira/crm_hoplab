/**
 * Histórico de adesão do paciente.
 * Mostra hábito e consistência — nunca métricas clínicas.
 */
import { useEffect, useState } from 'react'
import { tfFrom } from '../../lib/supabase'
import { useAuth } from '../../context/auth'

interface LogRow {
  id: string
  session_date: string
  plan_exercise_id: string
  self_rating: 'easy' | 'medium' | 'hard' | null
  notes: string | null
  exercise_title?: string
}

export function PatientHistoryPage() {
  const { profile } = useAuth()
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile?.id) load() }, [profile?.id])

  async function load() {
    setLoading(true)
    const { data } = await tfFrom('adherence_logs')
      .select('id, session_date, plan_exercise_id, self_rating, notes, plan_exercises:tf_plan_exercises(exercises:tf_exercises(title))')
      .eq('patient_id', profile!.id)
      .order('session_date', { ascending: false })
      .limit(60)

    setLogs((data ?? []).map((l: any) => ({
      id: l.id,
      session_date: l.session_date,
      plan_exercise_id: l.plan_exercise_id,
      self_rating: l.self_rating,
      notes: l.notes,
      exercise_title: l.plan_exercises?.exercises?.title ?? 'Exercício',
    })))
    setLoading(false)
  }

  // Agrupar por data
  const byDate: Record<string, LogRow[]> = {}
  logs.forEach(l => { (byDate[l.session_date] ??= []).push(l) })

  const ratingEmoji = (r: 'easy' | 'medium' | 'hard' | null) =>
    r === 'easy' ? '😊' : r === 'medium' ? '😐' : r === 'hard' ? '😓' : null

  if (loading) return <div className="empty-state"><span className="spinner" /></div>

  return (
    <div>
      <h1 className="page-title">Histórico</h1>
      <p className="page-sub">Os seus exercícios dos últimos 60 registos.</p>

      {Object.keys(byDate).length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p style={{ color: 'var(--text-2)' }}>Ainda não tem exercícios registados.</p>
        </div>
      )}

      {Object.entries(byDate).map(([date, items]) => (
        <div key={date} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>
            {new Date(date + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(item => (
              <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-lt)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
                }}>✓</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{item.exercise_title}</div>
                  {item.notes && (
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 2 }}>{item.notes}</div>
                  )}
                </div>
                {ratingEmoji(item.self_rating) && (
                  <span style={{ fontSize: 20 }}>{ratingEmoji(item.self_rating)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
