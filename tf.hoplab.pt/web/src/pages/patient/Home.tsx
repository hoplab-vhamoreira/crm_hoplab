/**
 * Ecrã principal do paciente — exercícios de hoje + streak.
 * NÃO mostra pontuação clínica — só hábito e adesão.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tfFrom } from '../../lib/supabase'
import { useAuth } from '../../context/auth'
import { Icon } from '../../components/Icon'
import { VideoCall } from '../../components/VideoCall'
import { Fox, Confetti } from '../../components/Fox'

interface TodayItem {
  plan_exercise_id: string
  exercise_id: string
  title: string
  duration_seconds: number | null
  reps: number | null
  done: boolean
}

interface StreakData { current_streak: number; longest_streak: number }
interface FeedbackItem { id: string; therapist_feedback: string; reviewed_at: string }
interface Appointment { id: string; kind: 'presencial' | 'online'; starts_at: string; location_or_link: string | null; status: string }

export function PatientHomePage() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [items, setItems]             = useState<TodayItem[]>([])
  const [streak, setStreak]           = useState<StreakData | null>(null)
  const [feedback, setFeedback]       = useState<FeedbackItem[]>([])
  const [nextAppt, setNextAppt]       = useState<Appointment | null>(null)
  const [therapistId, setTherapistId] = useState<string | null>(null)
  const [requestPending, setRequestPending] = useState(false)
  const [requesting, setRequesting]   = useState(false)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [callUrl, setCallUrl] = useState<string | null>(null)
  const [showParents, setShowParents] = useState(false)
  const [ttsOn, setTtsOn] = useState(() => localStorage.getItem('eira-tts') !== 'off')
  const [speaking, setSpeaking] = useState(false)
  const [prefDays, setPrefDays]       = useState<Set<string>>(new Set())
  const [prefPeriod, setPrefPeriod]   = useState('')
  const [prefNote, setPrefNote]       = useState('')
  const [loading, setLoading]         = useState(true)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => { if (profile?.id) load() }, [profile?.id])

  async function load() {
    setLoading(true)
    const { data: link } = await tfFrom('therapist_patient_links')
      .select('id, therapist_id').eq('patient_id', profile!.id).eq('status', 'active').single()
    if (!link) { setLoading(false); return }
    setTherapistId(link.therapist_id)

    const { data: plan } = await tfFrom('treatment_plans')
      .select('id').eq('patient_id', profile!.id).eq('is_active', true).maybeSingle()
    if (plan) {
      const { data: planExercises } = await tfFrom('plan_exercises')
        .select('id, exercise_id, reps, sets, duration_seconds, exercises:tf_exercises(title, instructions, duration_seconds)')
        .eq('plan_id', plan.id).order('sort_order')
      const { data: logs } = await tfFrom('adherence_logs')
        .select('plan_exercise_id').eq('patient_id', profile!.id).eq('session_date', today)
      const donePeIds = new Set((logs ?? []).map(l => l.plan_exercise_id))
      setItems((planExercises ?? []).map((pe: any) => ({
        plan_exercise_id: pe.id,
        exercise_id: pe.exercise_id,
        title: pe.exercises?.title ?? 'Exercício',
        duration_seconds: pe.duration_seconds ?? pe.exercises?.duration_seconds ?? null,
        reps: pe.reps ?? null,
        done: donePeIds.has(pe.id),
      })))
    }

    const { data: s } = await tfFrom('streaks').select('current_streak, longest_streak').eq('patient_id', profile!.id).maybeSingle()
    setStreak(s ?? null)

    const { data: fb } = await tfFrom('video_submissions')
      .select('id, therapist_feedback, reviewed_at').eq('patient_id', profile!.id).eq('status', 'reviewed')
      .not('therapist_feedback', 'is', null)
      .gte('reviewed_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .order('reviewed_at', { ascending: false }).limit(3)
    setFeedback((fb ?? []) as FeedbackItem[])

    // Mostra consultas a partir do início de HOJE — uma consulta marcada para
    // há minutos atrás continua visível até ao fim do dia.
    const { data: appts } = await tfFrom('appointments')
      .select('id, kind, starts_at, location_or_link, status')
      .eq('patient_id', profile!.id).in('status', ['proposta', 'confirmada'])
      .gte('starts_at', `${today}T00:00:00`).order('starts_at').limit(1)
    setNextAppt((appts?.[0] as Appointment) ?? null)

    const { data: reqs } = await tfFrom('appointment_requests')
      .select('id').eq('patient_id', profile!.id).eq('status', 'pendente').limit(1)
    setRequestPending(!!reqs?.length)
    setLoading(false)
  }

  const DAYS = ['2ª', '3ª', '4ª', '5ª', '6ª', 'Sábado'] as const
  const PERIODS = ['Manhã', 'Tarde', 'Fim do dia'] as const

  function toggleDay(d: string) {
    setPrefDays(prev => {
      const next = new Set(prev); next.has(d) ? next.delete(d) : next.add(d); return next
    })
  }

  async function requestAppointment() {
    if (!therapistId || !profile) return
    setRequesting(true)
    const parts: string[] = []
    if (prefDays.size) parts.push(`Dias: ${DAYS.filter(d => prefDays.has(d)).join(', ')}`)
    if (prefPeriod) parts.push(`Período: ${prefPeriod}`)
    if (prefNote.trim()) parts.push(prefNote.trim())
    const { error } = await tfFrom('appointment_requests').insert({
      patient_id: profile.id, therapist_id: therapistId,
      message: parts.length ? parts.join(' · ') : null,
    })
    if (!error) { setRequestPending(true); setShowRequestForm(false) }
    setRequesting(false)
  }

  const doneCount  = items.filter(i => i.done).length
  const totalCount = items.length
  const isAdventure = profile?.ui_variant === 'adventure'
  const isCalm      = profile?.ui_variant === 'calm'

  // Leitura em voz alta (variante Calma) — Web Speech API, voz pt-PT
  function speakSummary() {
    if (!('speechSynthesis' in window)) return
    const parts: string[] = [`Olá, ${profile?.full_name?.split(' ')[0] ?? ''}.`]
    if (nextAppt) {
      parts.push(`A sua próxima consulta é ${new Date(nextAppt.starts_at).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })} às ${new Date(nextAppt.starts_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}.`)
    }
    if (totalCount > 0) {
      parts.push(doneCount === totalCount
        ? `Já fez os exercícios de hoje. Muito bem.`
        : `Tem ${totalCount - doneCount} exercício${totalCount - doneCount > 1 ? 's' : ''} para fazer hoje.`)
    }
    const u = new SpeechSynthesisUtterance(parts.join(' '))
    u.lang = 'pt-PT'
    u.rate = 0.92
    u.onend = () => setSpeaking(false)
    speechSynthesis.cancel()
    speechSynthesis.speak(u)
    setSpeaking(true)
  }

  function toggleSpeak() {
    if (speaking) { speechSynthesis.cancel(); setSpeaking(false); return }
    speakSummary()
  }

  // Ler automaticamente ao abrir (se ativo); parar ao sair da página
  useEffect(() => {
    if (isCalm && !loading && ttsOn) speakSummary()
    return () => { if ('speechSynthesis' in window) speechSynthesis.cancel() }
  }, [loading])

  if (loading) return <div className="empty-state"><span className="spinner" /></div>

  // Bloco de consulta + feedback — na variante Aventura vai para a "Área dos pais"
  // (o conteúdo clínico do terapeuta é para o responsável; a criança vê só celebração).
  const appointmentAndFeedback = (
    <>
      {/* Próxima consulta / pedir consulta */}
      {nextAppt ? (
        <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name={nextAppt.kind === 'online' ? 'video' : 'location'} size={18} style={{ color: 'var(--eira-ocean)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}>
              {nextAppt.status === 'confirmada' ? 'Próxima consulta' : 'Consulta proposta'}
            </div>
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-2)' }}>
              {new Date(nextAppt.starts_at).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
              {nextAppt.kind === 'presencial' && nextAppt.location_or_link ? ` · ${nextAppt.location_or_link}` : ''}
            </div>
          </div>
          {nextAppt.kind === 'online' && nextAppt.location_or_link && (
            <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={() => setCallUrl(nextAppt.location_or_link)}>
              <Icon name="video" size={14} /> Entrar
            </button>
          )}
        </div>
      ) : therapistId && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--eira-mist)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="calendar" size={18} style={{ color: 'var(--eira-ocean)' }} />
            </div>
            <div style={{ flex: 1, fontSize: 'var(--font-sm)', color: 'var(--text-2)' }}>
              {requestPending ? 'Pedido enviado — o terapeuta vai confirmar a data.' : 'Sem consulta marcada.'}
            </div>
            {!requestPending && !showRequestForm && (
              <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={() => setShowRequestForm(true)}>
                Marcar
              </button>
            )}
          </div>

          {/* Preferências de horário — o terapeuta decide a data final */}
          {showRequestForm && !requestPending && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, marginBottom: 8 }}>Dias que dão mais jeito (opcional)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {DAYS.map(d => (
                  <button key={d} onClick={() => toggleDay(d)} style={{
                    padding: '7px 14px', borderRadius: 999, fontSize: 'var(--font-sm)', cursor: 'pointer',
                    fontFamily: 'Poppins, sans-serif',
                    border: '1.5px solid', borderColor: prefDays.has(d) ? 'var(--eira-ocean)' : 'var(--border)',
                    background: prefDays.has(d) ? 'var(--primary-lt)' : 'var(--surface)',
                    color: prefDays.has(d) ? 'var(--eira-ocean)' : 'var(--text)',
                    fontWeight: prefDays.has(d) ? 600 : 400,
                  }}>{d}</button>
                ))}
              </div>
              <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, marginBottom: 8 }}>Período preferido (opcional)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {PERIODS.map(p => (
                  <button key={p} onClick={() => setPrefPeriod(prefPeriod === p ? '' : p)} style={{
                    padding: '7px 14px', borderRadius: 999, fontSize: 'var(--font-sm)', cursor: 'pointer',
                    fontFamily: 'Poppins, sans-serif',
                    border: '1.5px solid', borderColor: prefPeriod === p ? 'var(--eira-ocean)' : 'var(--border)',
                    background: prefPeriod === p ? 'var(--primary-lt)' : 'var(--surface)',
                    color: prefPeriod === p ? 'var(--eira-ocean)' : 'var(--text)',
                    fontWeight: prefPeriod === p ? 600 : 400,
                  }}>{p}</button>
                ))}
              </div>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>Nota (opcional)</label>
                <input value={prefNote} onChange={e => setPrefNote(e.target.value)} placeholder="Ex: só depois das 17h30" />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowRequestForm(false)}>Cancelar</button>
                <button className="btn btn-primary btn-sm" disabled={requesting} onClick={requestAppointment}>
                  {requesting ? <span className="spinner" /> : 'Enviar pedido'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feedback do terapeuta */}
      {feedback.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Icon name="chat" size={16} style={{ color: 'var(--eira-ocean)' }} />
            <span className="section-title" style={{ margin: 0 }}>Feedback do seu terapeuta</span>
          </div>
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
    </>
  )

  return (
    <div>
      {/* Cabeçalho */}
      {isAdventure ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <Fox size={84} mood={doneCount === totalCount && totalCount > 0 ? 'cheer' : 'happy'} />
          <div>
            <h1 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, margin: 0 }}>
              Olá, {profile?.full_name?.split(' ')[0]}!
            </h1>
            <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)', marginTop: 4 }}>
              {doneCount === totalCount && totalCount > 0
                ? 'Missão de hoje cumprida! O Raposo está orgulhoso.'
                : totalCount > 0
                  ? 'O Raposo tem uma missão para ti!'
                  : 'O Raposo está à espera de novas missões.'}
            </p>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, margin: 0 }}>
            Olá, {profile?.full_name?.split(' ')[0]}
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)', marginTop: 4 }}>
            {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          {isCalm && 'speechSynthesis' in window && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={toggleSpeak}>
                <Icon name={speaking ? 'pause' : 'play'} size={16} /> {speaking ? 'Parar leitura' : 'Ler em voz alta'}
              </button>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-sm)', color: 'var(--text-2)', cursor: 'pointer', margin: 0 }}>
                <input type="checkbox" checked={ttsOn} style={{ width: 20, height: 20 }}
                  onChange={e => { setTtsOn(e.target.checked); localStorage.setItem('eira-tts', e.target.checked ? 'on' : 'off'); if (!e.target.checked) { speechSynthesis.cancel(); setSpeaking(false) } }} />
                Ler automaticamente
              </label>
            </div>
          )}
        </div>
      )}

      {/* Streak — na Calma é reforço verbal gentil, sem pontos nem fogo */}
      {streak && streak.current_streak > 0 && (
        isCalm ? (
          <div className="card" style={{ marginBottom: 20 }}>
            <p style={{ margin: 0, fontSize: 'var(--font-md)' }}>
              Tem praticado {streak.current_streak} dia{streak.current_streak > 1 ? 's' : ''} seguido{streak.current_streak > 1 ? 's' : ''}. Muito bem.
            </p>
          </div>
        ) : (
          <div className="card" style={{ background: 'var(--warning-lt)', border: '1.5px solid var(--eira-sun)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--eira-sun)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={isAdventure ? 'star' : 'flame'} size={22} style={{ color: '#fff' }} fill />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--warning)' }}>
                {isAdventure ? `${streak.current_streak} dias de missões!` : `${streak.current_streak} dias seguidos!`}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)' }}>Recorde: {streak.longest_streak} dias</div>
            </div>
          </div>
        )
      )}

      {/* Consulta + feedback — visível directamente, excepto na Aventura (vai para a área dos pais) */}
      {!isAdventure && appointmentAndFeedback}

      {/* Progresso do dia */}
      {totalCount > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600 }}>{isAdventure ? 'Missões de hoje' : 'Hoje'}</span>
            <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {isAdventure && <Icon name="star" size={14} style={{ color: 'var(--eira-sun)' }} fill />}
              {doneCount}/{totalCount}
            </span>
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: 'var(--primary)', borderRadius: 4,
              width: `${totalCount ? (doneCount / totalCount) * 100 : 0}%`, transition: 'width .3s',
            }} />
          </div>
        </div>
      )}

      {/* Lista de exercícios */}
      {totalCount === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <Icon name="book" size={40} style={{ color: 'var(--eira-mist)', marginBottom: 12 }} />
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
                opacity: item.done ? 0.65 : 1,
                border: item.done ? 'var(--hairline)' : '1.5px solid var(--eira-ocean)',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: item.done ? 'var(--success-lt)' : 'var(--primary-lt)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon
                  name={isAdventure ? 'star' : item.done ? 'check' : 'play'}
                  size={18}
                  style={{ color: item.done ? (isAdventure ? 'var(--eira-sun)' : 'var(--success)') : 'var(--eira-ocean)' }}
                  fill={isAdventure && item.done}
                />
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
              {!item.done && <Icon name="chevron-right" size={18} style={{ color: 'var(--eira-ocean)', flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      )}

      {doneCount === totalCount && totalCount > 0 && (
        isAdventure ? (
          <div className="card" style={{ position: 'relative', textAlign: 'center', padding: 28, marginTop: 20, background: 'var(--warning-lt)', border: '1.5px solid var(--eira-sun)', overflow: 'hidden' }}>
            <Confetti />
            <Fox size={72} mood="cheer" />
            <div style={{ fontWeight: 700, fontSize: 'var(--font-lg)', color: 'var(--warning)', marginTop: 8 }}>
              Missão cumprida!
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 8 }}>
              {Array.from({ length: totalCount }, (_, i) => (
                <Icon key={i} name="star" size={22} style={{ color: 'var(--eira-sun)' }} fill />
              ))}
            </div>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-2)', marginTop: 8, marginBottom: 0 }}>
              Ganhaste {totalCount} estrela{totalCount > 1 ? 's' : ''} hoje. Até amanhã!
            </p>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: 24, marginTop: 20, background: 'var(--success-lt)', border: '1.5px solid var(--success)' }}>
            <Icon name="star" size={32} style={{ color: 'var(--success)', marginBottom: 8 }} fill />
            <div style={{ fontWeight: 700, color: 'var(--success)' }}>Sessão completa! Excelente trabalho.</div>
          </div>
        )
      )}

      {/* Área dos pais — variante Aventura: consultas e feedback clínico ficam aqui */}
      {isAdventure && (
        <div style={{ marginTop: 28 }}>
          <button
            onClick={() => setShowParents(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--surface)', border: 'var(--hairline)', borderRadius: 'var(--radius)',
              padding: '14px 16px', cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
              fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text)',
            }}
          >
            <Icon name="lock" size={16} style={{ color: 'var(--text-2)' }} />
            Área dos pais
            <span style={{ marginLeft: 'auto', transform: showParents ? 'rotate(90deg)' : 'none', transition: 'transform .15s', display: 'inline-flex' }}>
              <Icon name="chevron-right" size={16} style={{ color: 'var(--text-2)' }} />
            </span>
          </button>
          {showParents && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', margin: '0 0 12px' }}>
                Consultas e indicações do terapeuta — para o responsável.
              </p>
              {appointmentAndFeedback}
            </div>
          )}
        </div>
      )}

      {/* Chamada de vídeo embebida */}
      {callUrl && <VideoCall url={callUrl} onClose={() => setCallUrl(null)} />}
    </div>
  )
}
