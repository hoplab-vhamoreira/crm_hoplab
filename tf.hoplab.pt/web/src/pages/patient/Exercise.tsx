/**
 * Ecrã de exercício — instruções + marcar como feito + enviar nota/vídeo.
 * NÃO avalia nem pontua clinicamente — só regista adesão.
 */
import { useEffect, useState, useRef, type CSSProperties } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, tfFrom } from '../../lib/supabase'
import { useAuth } from '../../context/auth'
import { logAudit } from '../../lib/audit'

interface ExerciseDetail {
  id: string
  exercise_id: string
  plan_id: string
  title: string
  description: string | null
  instructions: string | null
  duration_seconds: number | null
  reps: number | null
  therapist_id: string | null
  video_url: string | null
}

/**
 * Player de modelagem — vídeo "como fazer" da biblioteca do TF.
 * Pré-visualização crua, sem overlays nem análise (secção 17.1 Passo 3).
 */
function ModelVideo({ url, compact = false }: { url: string; compact?: boolean }) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/)
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  const style: CSSProperties = { width: '100%', aspectRatio: '16/9', borderRadius: 'var(--radius)', border: 'none', background: '#000', display: 'block' }
  if (yt) return <iframe style={style} src={`https://www.youtube-nocookie.com/embed/${yt[1]}`} allow="encrypted-media; picture-in-picture" allowFullScreen title="Demonstração" />
  if (vimeo) return <iframe style={style} src={`https://player.vimeo.com/video/${vimeo[1]}?dnt=1`} allow="encrypted-media; picture-in-picture" allowFullScreen title="Demonstração" />
  return <video src={url} controls playsInline style={{ ...style, aspectRatio: undefined, maxHeight: compact ? 220 : 360 }} />
}

export function PatientExercisePage() {
  const { exerciseId } = useParams<{ exerciseId: string }>() // plan_exercise_id
  const { profile } = useAuth()
  const nav = useNavigate()
  const [detail, setDetail] = useState<ExerciseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const [selfRating, setSelfRating] = useState<'easy' | 'medium' | 'hard' | null>(null)
  const [done, setDone] = useState(false)
  const [timer, setTimer] = useState(0)
  const [running, setRunning] = useState(false)
  const [repCount, setRepCount] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const today = new Date().toISOString().slice(0, 10)

  // Gravação de vídeo — câmara como espelho + gravar + rever + enviar.
  // A app NUNCA analisa o conteúdo; só capta e transmite ao TF (revisão humana).
  const [camOpen, setCamOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [uploading, setUploading] = useState(false)
  const [videoSent, setVideoSent] = useState(false)
  const [camError, setCamError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => () => stopCamera(), [])  // limpar câmara ao sair

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  async function openCamera() {
    setCamError(''); setVideoBlob(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true })
      streamRef.current = stream
      setCamOpen(true)
      // esperar o <video> montar
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      }, 50)
    } catch {
      setCamError('Não foi possível aceder à câmara/microfone. Verifique as permissões do browser.')
    }
  }

  function startRecording() {
    if (!streamRef.current) return
    chunksRef.current = []
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm'
    const rec = new MediaRecorder(streamRef.current, { mimeType: mime })
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    rec.onstop = () => setVideoBlob(new Blob(chunksRef.current, { type: 'video/webm' }))
    recorderRef.current = rec
    rec.start()
    setRecording(true)
  }

  function stopRecording() {
    recorderRef.current?.stop()
    setRecording(false)
  }

  function discardVideo() {
    setVideoBlob(null)
  }

  function closeCamera() {
    stopCamera()
    setCamOpen(false); setRecording(false); setVideoBlob(null)
  }

  async function sendVideo() {
    if (!videoBlob || !detail?.therapist_id || !profile) return
    setUploading(true)
    const path = `${profile.id}/${Date.now()}.webm`

    const { error: upErr } = await supabase.storage.from('tf-videos').upload(path, videoBlob, { contentType: 'video/webm' })
    if (upErr) { setCamError(`Erro no envio: ${upErr.message}`); setUploading(false); return }

    const { error: subErr } = await tfFrom('video_submissions').insert({
      patient_id: profile.id,
      therapist_id: detail.therapist_id,
      plan_exercise_id: detail.id,
      storage_path: path,
      patient_note: note.trim() || null,
      delete_after: new Date(Date.now() + 30 * 86400000).toISOString(), // retenção 30 dias (RGPD)
    })
    if (subErr) { setCamError(`Erro no registo: ${subErr.message}`); setUploading(false); return }

    await logAudit('video.submitted', 'video_submissions', path)
    setUploading(false); setVideoSent(true)
    closeCamera()
  }

  useEffect(() => { if (exerciseId) load() }, [exerciseId])

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [running])

  async function load() {
    setLoading(true)
    const { data } = await tfFrom('plan_exercises')
      .select('id, exercise_id, plan_id, reps, sets, duration_seconds, exercises:exercise_id(title, instructions, duration_seconds, video_url), treatment_plans:plan_id(therapist_id)')
      .eq('id', exerciseId!)
      .single()

    if (data) {
      const ex = (data as any).exercises
      const plan = (data as any).treatment_plans
      setDetail({
        id: data.id,
        exercise_id: data.exercise_id,
        plan_id: data.plan_id,
        title: ex?.title ?? 'Exercício',
        description: null,
        instructions: ex?.instructions ?? null,
        duration_seconds: (data as any).duration_seconds ?? ex?.duration_seconds ?? null,
        reps: (data as any).reps ?? null,
        therapist_id: plan?.therapist_id ?? null,
        video_url: ex?.video_url ?? null,
      })
    }
    setLoading(false)
  }

  async function markDone() {
    if (!detail || !profile) return
    setSaving(true)

    await tfFrom('adherence_logs').insert({
      patient_id: profile.id,
      plan_exercise_id: detail.id,
      session_date: today,
      completed: true,
      self_rating: selfRating,
      sets_done: repCount > 0 ? repCount : null,
      notes: note.trim() || null,
    })

    await logAudit('exercise.completed', 'adherence_logs', detail.id)
    setDone(true)
    setSaving(false)
  }

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  if (loading) return <div className="empty-state"><span className="spinner" /></div>
  if (!detail) return <div className="empty-state">Exercício não encontrado.</div>

  if (done) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 60, marginBottom: 16 }}>✅</div>
      <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Feito!</h2>
      <p style={{ color: 'var(--text-2)', marginBottom: 24 }}>Exercício registado com sucesso.</p>
      <button className="btn btn-primary" onClick={() => nav('/patient')}>Voltar ao início</button>
    </div>
  )

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={() => nav('/patient')} style={{ marginBottom: 16 }}>
        ← Voltar
      </button>

      <h1 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 8 }}>{detail.title}</h1>

      {detail.description && (
        <p style={{ color: 'var(--text-2)', marginBottom: 20 }}>{detail.description}</p>
      )}

      {/* Instruções */}
      {detail.instructions && (
        <div className="card" style={{ marginBottom: 20, background: 'var(--primary-lt)', border: '1px solid var(--primary)' }}>
          <div className="section-title">Instruções</div>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{detail.instructions}</p>
        </div>
      )}

      {/* Vídeo de modelagem — "como fazer" (Passo 2) */}
      {detail.video_url && (
        <div className="card" style={{ marginBottom: 20, padding: 12 }}>
          <div className="section-title">🎬 Demonstração</div>
          <ModelVideo url={detail.video_url} />
        </div>
      )}

      {/* Info duração / reps */}
      {(detail.duration_seconds || detail.reps) && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {detail.duration_seconds && (
            <div className="card" style={{ flex: 1, textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)' }}>Duração</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-lg)' }}>{fmt(detail.duration_seconds)}</div>
            </div>
          )}
          {detail.reps && (
            <div className="card" style={{ flex: 1, textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)' }}>Repetições</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-lg)' }}>{detail.reps}x</div>
            </div>
          )}
        </div>
      )}

      {/* Timer */}
      {detail.duration_seconds && (
        <div className="card" style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 48, fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)', marginBottom: 12 }}>
            {fmt(timer)}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className={`btn ${running ? 'btn-danger' : 'btn-primary'}`} onClick={() => setRunning(r => !r)}>
              {running ? '⏸ Pausar' : timer > 0 ? '▶ Continuar' : '▶ Iniciar'}
            </button>
            {timer > 0 && !running && (
              <button className="btn btn-ghost" onClick={() => setTimer(0)}>↺ Reset</button>
            )}
          </div>
        </div>
      )}

      {/* Contador de repetições — ferramenta neutra: conta toques, nunca qualidade */}
      {detail.reps && (
        <div className="card" style={{ textAlign: 'center', marginBottom: 20 }}>
          <div className="section-title" style={{ textAlign: 'left' }}>Contador de repetições</div>
          <div style={{ fontSize: 48, fontWeight: 700, color: repCount >= detail.reps ? 'var(--success, #22c55e)' : 'var(--primary)', marginBottom: 12 }}>
            {repCount} <span style={{ fontSize: 20, color: 'var(--text-2)', fontWeight: 400 }}>/ {detail.reps}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-primary" style={{ minWidth: 120, fontSize: 18 }} onClick={() => setRepCount(c => c + 1)}>+1</button>
            {repCount > 0 && <button className="btn btn-ghost" onClick={() => setRepCount(0)}>↺ Reset</button>}
          </div>
        </div>
      )}

      {/* Gravação de vídeo — espelho + gravar + rever + enviar ao TF (revisão humana) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">📹 Gravar para o terapeuta (opcional)</div>
        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginBottom: 12 }}>
          Grave o exercício, reveja e decida se envia. Só o seu terapeuta vê o vídeo; é eliminado após a revisão.
        </p>

        {videoSent && (
          <div style={{ background: 'var(--primary-lt)', borderRadius: 'var(--radius)', padding: 12, fontSize: 'var(--font-sm)', color: 'var(--primary)', fontWeight: 600 }}>
            ✅ Vídeo enviado ao seu terapeuta.
          </div>
        )}

        {camError && <p style={{ color: 'var(--error)', fontSize: 'var(--font-sm)', marginBottom: 8 }}>{camError}</p>}

        {!camOpen && !videoSent && (
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={openCamera}>🎥 Abrir câmara</button>
        )}

        {camOpen && (
          <div>
            {/* Espelho lado a lado: modelagem + câmara (quem compara é o utente) */}
            {!videoBlob && detail.video_url && (
              <div style={{ marginBottom: 10 }}>
                <ModelVideo url={detail.video_url} compact />
              </div>
            )}

            {/* Espelho (preview) ou revisão da gravação */}
            {videoBlob ? (
              <video
                src={URL.createObjectURL(videoBlob)}
                controls playsInline
                style={{ width: '100%', borderRadius: 'var(--radius)', background: '#000', marginBottom: 10 }}
              />
            ) : (
              <video
                ref={videoRef}
                muted playsInline autoPlay
                style={{ width: '100%', borderRadius: 'var(--radius)', background: '#000', marginBottom: 10, transform: 'scaleX(-1)' }}
              />
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {!videoBlob && !recording && (
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={startRecording}>⏺ Gravar</button>
              )}
              {recording && (
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={stopRecording}>⏹ Parar</button>
              )}
              {videoBlob && (
                <>
                  <button className="btn btn-primary" style={{ flex: 2 }} disabled={uploading} onClick={sendVideo}>
                    {uploading ? <span className="spinner" /> : '📤 Enviar ao terapeuta'}
                  </button>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={discardVideo}>↺ Regravar</button>
                </>
              )}
              <button className="btn btn-ghost" onClick={closeCamera}>✕</button>
            </div>
          </div>
        )}
      </div>

      {/* Auto-avaliação (hábito, não clínica) */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Como correu? (opcional)</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {([
            { value: 'hard',   emoji: '😓', label: 'Difícil' },
            { value: 'medium', emoji: '😐', label: 'Médio'   },
            { value: 'easy',   emoji: '😊', label: 'Fácil'   },
          ] as const).map(({ value, emoji, label }) => (
            <button
              key={value}
              onClick={() => setSelfRating(selfRating === value ? null : value)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                background: selfRating === value ? 'var(--primary)' : 'var(--surface)',
                color: selfRating === value ? '#fff' : 'var(--text)',
                cursor: 'pointer', fontSize: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}
            >
              <span style={{ fontSize: 22 }}>{emoji}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 8 }}>
          Esta avaliação é sobre como se sentiu a fazer o exercício, não sobre qualidade clínica.
        </p>
      </div>

      {/* Nota para terapeuta */}
      <div className="field" style={{ marginBottom: 20 }}>
        <label>Nota para o terapeuta (opcional)</label>
        <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Ex: senti dificuldade em…" />
      </div>

      <button
        className="btn btn-primary"
        style={{ width: '100%' }}
        disabled={saving}
        onClick={markDone}
      >
        {saving ? <span className="spinner" /> : '✓ Marcar como feito'}
      </button>
    </div>
  )
}
