/**
 * Ecrã principal do paciente — exercícios de hoje + streak.
 * NÃO mostra pontuação clínica — só hábito e adesão.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tfFrom } from '../../lib/supabase'
import { useAuth } from '../../context/auth'

interface TodayItem {
  plan_exercise_id: string
  exercise_id: string
  title: string
  description: string | null
  duration_seconds: number | null
  reps: number | null
  done: boolean
}

interface StreakData {
  current_streak: number
  longest_streak: number
}

interface FeedbackItem {
  id: string
  therapist_feedback: string
  reviewed_at: string
}

interface Appointment {
  id: string
  kind: 'presencial' | 'online'
  starts_at: string
  location_or_link: string | null
  status: string
}

export function PatientHomePage() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [items, setItems] = useState<TodayItem[]>([])
  const [streak, setStreak] = useState<StreakData | null>(null)
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [nextAppt, setNextAppt] = useState<Appointment | null>(null)
  const [therapistId, setTherapistId] = useState<string | null>(null)
  const [requestPending, setRequestPending] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => { if (profile?.id) load() }, [profile?.id])

  async function load() {
    setLoading(true)

    // Plano activo
    const { data: link } = await tfFrom('therapist_patient_links')
      .select('id, therapist_id')
      .eq('patient_id', profile!.id)
      .eq('status', 'active')
      .single()

    if (!link) { setLoading(false); return }
    setTherapistId(link.therapist_id)

    const { data: plan } = await tfFrom('treatment_plans')
      .select('id')
      .eq('patient_id', profile!.id)
      .eq('is_active', true)
      .maybeSingle()

    if (plan) {
      const { data: planExercises } = await tfFrom('plan_exercises')
        .select('id, exercise_id, reps, sets, duration_seconds, exercises:exercise_id(title, instructions, duration_seconds)')
        .eq('plan_id', plan.id)
        .order('sort_order')

      const { data: logs } = await tfFrom('adherence_logs')
        .select('plan_exercise_id')
        .eq('patient_id', profile!.id)
        .eq('session_date', today)

      const donePeIds = new Set((logs ?? []).map(l => l.plan_exercise_id))

      setItems((planExercises ?? []).map((pe: any) => ({
        plan_exercise_id: pe.id,
        exercise_id: pe.exercise_id,
        title: pe.exercises?.title ?? 'Exercício',
        description: null,
        duration_seconds: pe.duration_seconds ?? pe.exercises?.duration_seconds ?? null,
        reps: pe.reps ?? null,
        done: donePeIds.has(pe.id),
      })))
    }

    // Streak
    const { data: s } = await tfFrom('streaks')
      .select('current_streak, longest_streak')
      .eq('patient_id', profile!.id)
      .maybeSingle()
    setStreak(s ?? null)

    // Feedback do terapeuta (últimos 7 dias) — escrito por humano, nunca pela app
    const { data: fb } = await tfFrom('video_submissions')
      .select('id, therapist_feedback, reviewed_at')
      .eq('patient_id', profile!.id)
      .eq('status', 'reviewed')
      .not('therapist_feedback', 'is', null)
      .gte('reviewed_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .order('reviewed_at', { ascending: false })
      .limit(3)
    setFeedback((fb ?? []) as FeedbackItem[])

    // W4: próxima consulta confirmada
    const { data: appts } = await tfFrom('appointments')
      .select('id, kind, starts_at, location_or_link, status')
      .eq('patient_id', profile!.id)
      .in('status', ['proposta', 'confirmada'])
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
      .limit(1)
    setNextAppt((appts?.[0] as Appointment) ?? null)

    // W5: já há pedido pendente?
    const { data: reqs } = await tfFrom('appointment_requests')
      .select('id')
      .eq('patient_id', profile!.id)
      .eq('status', 'pendente')
      .limit(1)
    setRequestPending(!!reqs?.length)

    setLoading(false)
  }

  const doneCount = items.filter(i => i.done).length
  const totalCount = items.length

  // W5: pedir consulta — cria um PEDIDO que o TF confirma; a app nunca agenda sozinha
  async function requestAppointment() {
    if (!therapistId || !profile) return
    setRequesting(true)
    const { error } = await tfFrom('appointment_requests').insert({
      patient_id: profile.id,
      therapist_id: therapistId,
    })
    if (!error) setRequestPending(true)
    setRequesting(false)
  }

  if (loading) return <div className="empty-state"><span className="spinner" /></div>

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, margin: 0 }}>
          Olá, {profile?.full_name?.split(' ')[0]} 👋
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)', marginTop: 4 }}>
          {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Streak */}
      {streak && streak.current_streak > 0 && (
        <div className="card" style={{ background: 'var(--primary-lt)', border: '1px solid var(--primary)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 36 }}>🔥</div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{streak.current_streak} dias seguidos!</div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)' }}>Recorde: {streak.longest_streak} dias</div>
          </div>
        </div>
      )}

      {/* W4: próxima consulta / W5: pedir consulta */}
      {nextAppt ? (
        <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 28 }}>{nextAppt.kind === 'online' ? '💻' : '📍'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>
              {nextAppt.status === 'confirmada' ? 'Próxima consulta' : 'Consulta proposta'}
            </div>
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-2)' }}>
              {new Date(nextAppt.starts_at).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
              {nextAppt.kind === 'presencial' && nextAppt.location_or_link ? ` · ${nextAppt.location_or_link}` : ''}
            </div>
          </div>
          {nextAppt.kind === 'online' && nextAppt.location_or_link && (
            <a className="btn btn-primary btn-sm" href={nextAppt.location_or_link} target="_blank" rel="noreferrer">Entrar</a>
          )}
        </div>
      ) : therapistId && (
        <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 28 }}>🗓️</div>
          <div style={{ flex: 1, fontSize: 'var(--font-sm)', color: 'var(--text-2)' }}>
            {requestPending ? 'Pedido de consulta enviado — o seu terapeuta vai confirmar a data.' : 'Sem consulta marcada.'}
          </div>
          {!requestPending && (
            <button className="btn btn-primary btn-sm" disabled={requesting} onClick={requestAppointment}>
              {requesting ? <span className="spinner" /> : 'Marcar consulta'}
            </button>
          )}
        </div>
      )}

      {/* Feedback do terapeuta */}
      {feedback.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title">💬 Feedback do seu terapeuta</div>
          {feedback.map(f => (
            <div key={f.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <p style={{ margin: 0, fontSize: 'var(--font-sm)', whiteSpace: 'pre-wrap' }}>{f.therapist_feedback}</p>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 4 }}>
                {new Date(f.reviewed_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Progresso do dia */}
      {totalCount > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600 }}>Hoje</span>
            <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-2)' }}>{doneCount}/{totalCount}</span>
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: 'var(--primary)', borderRadius: 4,
              width: `${totalCount ? (doneCount / totalCount) * 100 : 0}%`,
              transition: 'width .3s',
            }} />
          </div>
        </div>
      )}

      {/* Lista de exercícios */}
      {totalCount === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p style={{ color: 'var(--text-2)' }}>Ainda não tem exercícios para hoje.<br />O seu terapeuta vai preparar o plano em breve.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(item => (
            <div
              key={item.plan_exercise_id}
              onClick={() => !item.done && nav(`/patient/exercise/${item.plan_exercise_id}`)}
              className="card"
              style={{
                display: 'flex', alignItems: 'center', gap: 16, cursor: item.done ? 'default' : 'pointer',
                opacity: item.done ? 0.6 : 1,
                border: item.done ? '1px solid var(--border)' : '1px solid var(--primary)',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: item.done ? 'var(--success, #22c55e)' : 'var(--primary-lt)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}>
                {item.done ? '✓' : '▶'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{item.title}</div>
                {(item.duration_seconds || item.reps) && (
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 2 }}>
                    {item.duration_seconds ? `${item.duration_seconds}s` : ''}
                    {item.duration_seconds && item.reps ? ' · ' : ''}
                    {item.reps ? `${item.reps} reps` : ''}
                  </div>
                )}
              </div>
              {!item.done && <span style={{ color: 'var(--primary)', fontSize: 18 }}>›</span>}
            </div>
          ))}
        </div>
      )}

      {doneCount === totalCount && totalCount > 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 24, marginTop: 20, background: 'var(--primary-lt)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
          <div style={{ fontWeight: 700, color: 'var(--primary)' }}>Sessão completa! Excelente trabalho.</div>
        </div>
      )}
    </div>
  )
}
