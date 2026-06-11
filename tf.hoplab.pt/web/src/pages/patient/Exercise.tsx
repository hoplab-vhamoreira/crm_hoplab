/**
 * Ecrã de exercício — fluxo em 4 passos (Eira spec §17).
 * NÃO avalia nem pontua clinicamente — só regista adesão.
 * Câmara = preview cru sem overlays nem análise.
 */
import { useEffect, useState, useRef, type CSSProperties } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, tfFrom } from '../../lib/supabase'
import { useAuth } from '../../context/auth'
import { logAudit } from '../../lib/audit'

type Step = 1 | 2 | 3 | 4

interface ExerciseDetail {
  id: string
  exercise_id: string
  plan_id: string
  title: string
  instructions: string | null
  duration_seconds: number | null
  sets: number | null
  reps: number | null
  therapist_id: string | null
  video_url: string | null
}

function ModelVideo({ url, compact = false }: { url: string; compact?: boolean }) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/)
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  const style: CSSProperties = {
    width: '100%', aspectRatio: '16/9', borderRadius: 'var(--radius)',
    border: 'none', background: '#000', display: 'block',
  }
  if (yt) return <iframe style={style} src={`https://www.youtube-nocookie.com/embed/${yt[1]}`} allow="encrypted-media; picture-in-picture" allowFullScreen title="Demonstração" />
  if (vimeo) return <iframe style={style} src={`https://player.vimeo.com/video/${vimeo[1]}?dnt=1`} allow="encrypted-media; picture-in-picture" allowFullScreen title="Demonstração" />
  return <video src={url} controls playsInline style={{ ...style, aspectRatio: undefined, maxHeight: compact ? 220 : 360 }} />
}

function fmt(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
}

/* ── Passo 1 — Preparação ───────────────────────────────────────────────── */
function StepPreparacao({
  detail, onNext, onBack,
}: { detail: ExerciseDetail; onNext: () => void; onBack: () => void }) {
  return (
    <div>
      <h1 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 8 }}>{detail.title}</h1>
      <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)', marginBottom: 20 }}>
        Leia as instruções antes de começar.
      </p>

      {(detail.sets || detail.duration_seconds || detail.reps) && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {detail.sets && (
            <div className="card" style={{ flex: 1, minWidth: 80, textAlign: 'center', padding: '14px 10px' }}>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)' }}>Séries</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-lg)' }}>{detail.sets}×</div>
            </div>
          )}
          {detail.duration_seconds && (
            <div className="card" style={{ flex: 1, minWidth: 80, textAlign: 'center', padding: '14px 10px' }}>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)' }}>Duração</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-lg)' }}>{fmt(detail.duration_seconds)}</div>
            </div>
          )}
          {detail.reps && (
            <div className="card" style={{ flex: 1, minWidth: 80, textAlign: 'center', padding: '14px 10px' }}>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)' }}>Repetições</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-lg)' }}>{detail.reps}×</div>
            </div>
          )}
        </div>
      )}

      {detail.instructions && (
        <div className="card" style={{ marginBottom: 20, background: 'var(--primary-lt)', border: '1.5px solid var(--eira-ocean)' }}>
          <div className="section-title">Instruções</div>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.7 }}>{detail.instructions}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={onBack}>← Voltar</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onNext}>
          {detail.video_url ? 'Ver demonstração →' : 'Iniciar prática →'}
        </button>
      </div>
    </div>
  )
}

/* ── Passo 2 — Modelagem ────────────────────────────────────────────────── */
function StepModelagem({
  detail, onNext, onBack,
}: { detail: ExerciseDetail; onNext: () => void; onBack: () => void }) {
  return (
    <div>
      <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 4 }}>Demonstração</h2>
      <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)', marginBottom: 16 }}>
        Observe com atenção antes de praticar. Pode pausar e repetir o vídeo.
      </p>

      {detail.video_url && (
        <div style={{ marginBottom: 20 }}>
          <ModelVideo url={detail.video_url} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-ghost" onClick={onBack}>← Instruções</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onNext}>
          Iniciar prática →
        </button>
      </div>
    </div>
  )
}

/* ── Passo 3 — Prática ──────────────────────────────────────────────────── */
function StepPratica({
  detail, onNext, onBack,
}: { detail: ExerciseDetail; onNext: (blob: Blob | null) => void; onBack: () => void }) {
  const [timer, setTimer]       = useState(0)
  const [running, setRunning]   = useState(false)
  const [repCount, setRepCount] = useState(0)
  const [bpm, setBpm]           = useState(60)
  const [metOn, setMetOn]       = useState(false)
  const [camOpen, setCamOpen]   = useState(false)
  const [recording, setRecording] = useState(false)
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [camError, setCamError]   = useState('')

  const videoRef    = useRef<HTMLVideoElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const metRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => () => {
    stopCamera()
    stopMetronome()
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [running])

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  async function openCamera() {
    setCamError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true })
      streamRef.current = stream
      setCamOpen(true)
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      }, 50)
    } catch {
      setCamError('Não foi possível aceder à câmara. Verifique as permissões.')
    }
  }

  function closeCamera() {
    stopCamera(); setCamOpen(false); setRecording(false); setVideoBlob(null)
  }

  function startRecording() {
    if (!streamRef.current) return
    chunksRef.current = []
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm'
    const rec = new MediaRecorder(streamRef.current, { mimeType: mime })
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    rec.onstop = () => setVideoBlob(new Blob(chunksRef.current, { type: 'video/webm' }))
    recorderRef.current = rec; rec.start(); setRecording(true)
  }

  function stopRecording() { recorderRef.current?.stop(); setRecording(false) }

  function tickMetronome() {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
      const ctx = audioCtxRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.08)
    } catch { /* sem permissão de áudio */ }
  }

  function startMetronome() {
    tickMetronome()
    metRef.current = setInterval(tickMetronome, (60 / bpm) * 1000)
    setMetOn(true)
  }

  function stopMetronome() {
    if (metRef.current) { clearInterval(metRef.current); metRef.current = null }
    setMetOn(false)
  }

  function toggleMetronome() { metOn ? stopMetronome() : startMetronome() }

  // re-sincroniza se bpm mudar enquanto ativo
  const prevBpmRef = useRef(bpm)
  useEffect(() => {
    if (metOn && bpm !== prevBpmRef.current) {
      stopMetronome(); startMetronome()
    }
    prevBpmRef.current = bpm
  }, [bpm])

  return (
    <div>
      <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 4 }}>Prática</h2>
      <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)', marginBottom: 16 }}>
        Use as ferramentas abaixo enquanto pratica.
      </p>

      {/* Câmara / espelho lado a lado */}
      {camOpen ? (
        <div style={{ marginBottom: 16 }}>
          {detail.video_url && !videoBlob ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <div className="section-title" style={{ marginBottom: 4 }}>Modelo</div>
                <ModelVideo url={detail.video_url} compact />
              </div>
              <div>
                <div className="section-title" style={{ marginBottom: 4 }}>Câmara</div>
                <video
                  ref={videoRef} muted playsInline autoPlay
                  style={{ width: '100%', borderRadius: 'var(--radius-sm)', background: '#000', display: 'block', transform: 'scaleX(-1)', maxHeight: 220, objectFit: 'cover' }}
                />
              </div>
            </div>
          ) : videoBlob ? (
            <video
              src={URL.createObjectURL(videoBlob)} controls playsInline
              style={{ width: '100%', borderRadius: 'var(--radius)', background: '#000', marginBottom: 8 }}
            />
          ) : (
            <video
              ref={videoRef} muted playsInline autoPlay
              style={{ width: '100%', borderRadius: 'var(--radius)', background: '#000', marginBottom: 8, transform: 'scaleX(-1)', maxHeight: 280 }}
            />
          )}

          {camError && <p style={{ color: 'var(--error)', fontSize: 'var(--font-sm)', margin: '4px 0 8px' }}>{camError}</p>}

          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {!videoBlob && !recording && <button className="btn btn-primary btn-sm" onClick={startRecording}>⏺ Gravar</button>}
            {recording && <button className="btn btn-danger btn-sm" onClick={stopRecording}>⏹ Parar</button>}
            {videoBlob && <button className="btn btn-ghost btn-sm" onClick={() => setVideoBlob(null)}>↺ Regravar</button>}
            <button className="btn btn-ghost btn-sm" onClick={closeCamera}>✕ Fechar</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16, width: '100%' }} onClick={openCamera}>
          🎥 Abrir câmara (espelho)
        </button>
      )}

      {/* Ferramentas neutras */}
      <div style={{ display: 'grid', gap: 12 }}>
        {detail.duration_seconds && (
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="section-title" style={{ textAlign: 'left' }}>Temporizador</div>
            <div style={{ fontSize: 44, fontWeight: 700, fontFamily: 'monospace', color: 'var(--eira-ocean)', marginBottom: 10 }}>
              {fmt(timer)}
              <span style={{ fontSize: 20, color: 'var(--text-2)', fontWeight: 400 }}> / {fmt(detail.duration_seconds)}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className={`btn ${running ? 'btn-danger' : 'btn-primary'}`} onClick={() => setRunning(r => !r)}>
                {running ? '⏸ Pausar' : timer > 0 ? '▶ Continuar' : '▶ Iniciar'}
              </button>
              {timer > 0 && !running && <button className="btn btn-ghost" onClick={() => setTimer(0)}>↺ Reset</button>}
            </div>
          </div>
        )}

        {detail.reps && (
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="section-title" style={{ textAlign: 'left' }}>Contador de repetições</div>
            <div style={{ fontSize: 44, fontWeight: 700, color: repCount >= detail.reps ? 'var(--success)' : 'var(--eira-ocean)', marginBottom: 10 }}>
              {repCount} <span style={{ fontSize: 20, color: 'var(--text-2)', fontWeight: 400 }}>/ {detail.reps}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn btn-primary" style={{ minWidth: 100, fontSize: 18 }} onClick={() => setRepCount(c => c + 1)}>+1</button>
              {repCount > 0 && <button className="btn btn-ghost" onClick={() => setRepCount(0)}>↺ Reset</button>}
            </div>
          </div>
        )}

        {/* Metrónomo — ferramenta neutra de ritmo */}
        <div className="card">
          <div className="section-title">Metrónomo</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setBpm(b => Math.max(20, b - 5))}>−</button>
              <div style={{ textAlign: 'center', minWidth: 56 }}>
                <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--eira-ocean)' }}>{bpm}</div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)' }}>BPM</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setBpm(b => Math.min(200, b + 5))}>+</button>
            </div>
            <input
              type="range" min={20} max={200} value={bpm}
              onChange={e => setBpm(Number(e.target.value))}
              style={{ flex: 1, minWidth: 100, cursor: 'pointer' }}
            />
            <button
              className={`btn btn-sm ${metOn ? 'btn-danger' : 'btn-primary'}`}
              style={{ minWidth: 88 }}
              onClick={toggleMetronome}
            >
              {metOn ? '⏹ Parar' : '▶ Iniciar'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button className="btn btn-ghost" onClick={() => { stopMetronome(); onBack() }}>
          ← {detail.video_url ? 'Modelo' : 'Instruções'}
        </button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { stopMetronome(); stopCamera(); onNext(videoBlob) }}>
          Concluir →
        </button>
      </div>
    </div>
  )
}

/* ── Passo 4 — Conclusão ────────────────────────────────────────────────── */
function StepConclusao({
  detail, videoBlob, profile, onDone,
}: {
  detail: ExerciseDetail
  videoBlob: Blob | null
  profile: { id: string } | null
  onDone: () => void
}) {
  const [selfRating, setSelfRating] = useState<'easy' | 'medium' | 'hard' | null>(null)
  const [note, setNote]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const [videoSent, setVideoSent] = useState(false)
  const [videoError, setVideoError] = useState('')
  const [done, setDone]         = useState(false)
  const today = new Date().toISOString().slice(0, 10)

  async function sendVideo() {
    if (!videoBlob || !detail.therapist_id || !profile) return
    setUploading(true); setVideoError('')
    const path = `${profile.id}/${Date.now()}.webm`
    const { error: upErr } = await supabase.storage.from('tf-videos').upload(path, videoBlob, { contentType: 'video/webm' })
    if (upErr) { setVideoError(`Erro no envio: ${upErr.message}`); setUploading(false); return }
    const { error: subErr } = await tfFrom('video_submissions').insert({
      patient_id: profile.id,
      therapist_id: detail.therapist_id,
      plan_exercise_id: detail.id,
      storage_path: path,
      patient_note: note.trim() || null,
      delete_after: new Date(Date.now() + 30 * 86400000).toISOString(),
    })
    if (subErr) { setVideoError(`Erro no registo: ${subErr.message}`); setUploading(false); return }
    await logAudit('video.submitted', 'video_submissions', path)
    setUploading(false); setVideoSent(true)
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
      notes: note.trim() || null,
    })
    await logAudit('exercise.completed', 'adherence_logs', detail.id)
    setSaving(false); setDone(true)
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontWeight: 700, marginBottom: 8, color: 'var(--eira-ink)' }}>Excelente!</h2>
        <p style={{ color: 'var(--text-2)', marginBottom: 28 }}>Exercício registado. Continue assim!</p>
        <button className="btn btn-primary" style={{ minWidth: 180 }} onClick={onDone}>
          Voltar ao início
        </button>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: 4 }}>Como correu?</h2>
      <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)', marginBottom: 20 }}>
        A sua percepção ajuda o terapeuta a ajustar o plano.
      </p>

      {/* Auto-avaliação — perceção de esforço, não qualidade clínica */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Perceção do esforço (opcional)</div>
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
                flex: 1, padding: '12px 0', borderRadius: 'var(--radius)',
                border: '1.5px solid',
                borderColor: selfRating === value ? 'var(--eira-ocean)' : 'var(--border)',
                background: selfRating === value ? 'var(--primary-lt)' : 'var(--surface)',
                color: selfRating === value ? 'var(--eira-ocean)' : 'var(--text)',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                fontFamily: 'Poppins, sans-serif', fontWeight: selfRating === value ? 600 : 400, fontSize: 14,
              }}
            >
              <span style={{ fontSize: 24 }}>{emoji}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 8, marginBottom: 0 }}>
          Esta avaliação é sobre a sua sensação de esforço, não sobre qualidade clínica.
        </p>
      </div>

      <div className="field" style={{ marginBottom: 16 }}>
        <label>Nota para o terapeuta (opcional)</label>
        <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Ex: senti dificuldade em…" />
      </div>

      {videoBlob && !videoSent && detail.therapist_id && (
        <div className="card" style={{ marginBottom: 16, background: 'var(--primary-lt)', border: '1.5px solid var(--eira-ocean)' }}>
          <div className="section-title">Vídeo gravado</div>
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-2)', marginBottom: 12 }}>
            Tem um vídeo da prática. Quer enviar ao seu terapeuta? Só ele o verá e é eliminado após revisão (máx. 30 dias).
          </p>
          {videoError && <p style={{ color: 'var(--error)', fontSize: 'var(--font-sm)', marginBottom: 8 }}>{videoError}</p>}
          <button className="btn btn-primary btn-sm" disabled={uploading} onClick={sendVideo}>
            {uploading ? <span className="spinner" /> : '📤 Enviar vídeo ao terapeuta'}
          </button>
        </div>
      )}

      {videoSent && (
        <div style={{ background: 'var(--success-lt)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 16, fontSize: 'var(--font-sm)', color: 'var(--success)', fontWeight: 600 }}>
          ✅ Vídeo enviado ao seu terapeuta.
        </div>
      )}

      <button className="btn btn-primary" style={{ width: '100%' }} disabled={saving} onClick={markDone}>
        {saving ? <span className="spinner" /> : '✓ Marcar como feito'}
      </button>
    </div>
  )
}

/* ── Componente principal ────────────────────────────────────────────────── */
export function PatientExercisePage() {
  const { exerciseId } = useParams<{ exerciseId: string }>()
  const { profile } = useAuth()
  const nav = useNavigate()
  const [detail, setDetail]         = useState<ExerciseDetail | null>(null)
  const [loading, setLoading]       = useState(true)
  const [step, setStep]             = useState<Step>(1)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)

  useEffect(() => { if (exerciseId) load() }, [exerciseId])

  async function load() {
    setLoading(true)
    const { data } = await tfFrom('plan_exercises')
      .select('id, exercise_id, plan_id, reps, sets, duration_seconds, exercises:tf_exercises(title, instructions, duration_seconds, video_url), treatment_plans:tf_plans(therapist_id)')
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
        instructions: ex?.instructions ?? null,
        duration_seconds: (data as any).duration_seconds ?? ex?.duration_seconds ?? null,
        sets: (data as any).sets ?? null,
        reps: (data as any).reps ?? null,
        therapist_id: plan?.therapist_id ?? null,
        video_url: ex?.video_url ?? null,
      })
    }
    setLoading(false)
  }

  if (loading) return <div className="empty-state"><span className="spinner" /></div>
  if (!detail) return <div className="empty-state">Exercício não encontrado.</div>

  const STEPS = [
    { n: 1 as Step, label: 'Preparação' },
    ...(detail.video_url ? [{ n: 2 as Step, label: 'Modelo' }] : []),
    { n: 3 as Step, label: 'Prática' },
    { n: 4 as Step, label: 'Conclusão' },
  ]

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => nav('/patient')} style={{ marginBottom: 16 }}>
        ← Sair do exercício
      </button>

      {/* Indicador de passos */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
        {STEPS.map((s, i) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'var(--font-xs)', fontWeight: 700,
                background: s.n < step ? 'var(--success)' : s.n === step ? 'var(--eira-ocean)' : 'var(--eira-mist)',
                color: s.n <= step ? '#fff' : 'var(--text-2)',
                transition: 'background .2s',
              }}>
                {s.n < step ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: 10, color: s.n === step ? 'var(--eira-ocean)' : 'var(--text-2)', marginTop: 3, fontWeight: s.n === step ? 700 : 400, whiteSpace: 'nowrap' }}>
                {s.label}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ height: 2, flex: 1, background: s.n < step ? 'var(--success)' : 'var(--eira-mist)', transition: 'background .2s', marginBottom: 16 }} />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <StepPreparacao
          detail={detail}
          onNext={() => setStep(detail.video_url ? 2 : 3)}
          onBack={() => nav('/patient')}
        />
      )}
      {step === 2 && detail.video_url && (
        <StepModelagem
          detail={detail}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <StepPratica
          detail={detail}
          onNext={(blob) => { setCapturedBlob(blob); setStep(4) }}
          onBack={() => setStep(detail.video_url ? 2 : 1)}
        />
      )}
      {step === 4 && (
        <StepConclusao
          detail={detail}
          videoBlob={capturedBlob}
          profile={profile}
          onDone={() => nav('/patient')}
        />
      )}
    </div>
  )
}
