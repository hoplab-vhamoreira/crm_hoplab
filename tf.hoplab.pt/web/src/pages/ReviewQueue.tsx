/**
 * Fila de revisão — NÚCLEO DE COMPLIANCE
 *
 * Regra inviolável (docs/compliance.md §5.3):
 * Os atalhos apresentados são SEMPRE o conjunto fixo do terapeuta.
 * A app NUNCA filtra, ordena, destaca ou pré-seleciona atalhos com
 * base no conteúdo do vídeo. Quem avalia e escolhe é o terapeuta.
 */
import { useEffect, useRef, useState } from 'react'
import { supabase, tfFrom } from '../lib/supabase'
import { useAuth } from '../context/auth'
import { logAudit } from '../lib/audit'
import { Icon } from '../components/Icon'
import type { FeedbackShortcut, ClinicalArea } from '@tf/types'

interface Submission {
  id: string
  patient_id: string
  storage_path: string
  patient_note: string | null
  created_at: string
  plan_exercise_id: string | null
  patient_name?: string
}

const AREA_LABELS: Record<ClinicalArea, string> = {
  respiracao: 'Respiração', ressonancia: 'Ressonância', articulacao: 'Articulação',
  tom: 'Tom', voz: 'Voz', mof: 'MOF', linguagem: 'Linguagem', gaguez: 'Gaguez',
}

export function ReviewQueuePage() {
  const { profile } = useAuth()
  const [queue, setQueue]                       = useState<Submission[]>([])
  const [active, setActive]                     = useState<Submission | null>(null)
  const [shortcuts, setShortcuts]               = useState<FeedbackShortcut[]>([])
  const [selectedShortcuts, setSelectedShortcuts] = useState<Set<string>>(new Set())
  const [freeText, setFreeText]                 = useState('')
  const [sending, setSending]                   = useState(false)
  const [loading, setLoading]                   = useState(true)
  const [videoUrl, setVideoUrl]                 = useState<string | null>(null)
  const [videoError, setVideoError]             = useState('')

  // Áudio de resposta
  const [audioMode, setAudioMode]       = useState<'idle' | 'recording' | 'recorded'>('idle')
  const [audioBlob, setAudioBlob]       = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl]         = useState<string | null>(null)
  const [recSeconds, setRecSeconds]     = useState(0)
  const mediaRef   = useRef<MediaRecorder | null>(null)
  const chunksRef  = useRef<BlobPart[]>([])
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { if (profile?.id) load() }, [profile?.id])

  async function load() {
    setLoading(true)
    const { data: subs } = await tfFrom('video_submissions')
      .select('id, patient_id, storage_path, patient_note, created_at, plan_exercise_id')
      .eq('therapist_id', profile!.id)
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true })

    const pids = [...new Set((subs ?? []).map(s => s.patient_id))]
    const { data: patients } = pids.length
      ? await tfFrom('tf_users').select('id, full_name').in('id', pids)
      : { data: [] }
    const nameMap = new Map((patients ?? []).map(p => [p.id, p.full_name]))
    setQueue((subs ?? []).map(s => ({ ...s, patient_name: nameMap.get(s.patient_id) ?? 'Utente' })))

    // Atalhos do terapeuta — lista FIXA, ordenação neutra (categoria + sort_order)
    // NUNCA filtrada/ordenada pelo conteúdo do vídeo — ver compliance.md §5.3
    const { data: sc } = await tfFrom('feedback_shortcuts')
      .select('*')
      .eq('therapist_id', profile!.id)
      .order('category')
      .order('sort_order')
    setShortcuts(sc ?? [])
    setLoading(false)
  }

  async function openReview(sub: Submission) {
    setActive(sub)
    setSelectedShortcuts(new Set())
    setFreeText('')
    setVideoUrl(null); setVideoError('')
    resetAudio()
    logAudit('video.viewed', 'video_submissions', sub.id)

    const { data, error } = await supabase.storage.from('tf-videos').createSignedUrl(sub.storage_path, 900)
    if (error || !data?.signedUrl) setVideoError('Não foi possível carregar o vídeo. Pode já ter sido eliminado (retenção RGPD).')
    else setVideoUrl(data.signedUrl)
  }

  function resetAudio() {
    stopRecording()
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null); setAudioUrl(null); setAudioMode('idle'); setRecSeconds(0)
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url  = URL.createObjectURL(blob)
        setAudioBlob(blob); setAudioUrl(url); setAudioMode('recorded')
        if (timerRef.current) clearInterval(timerRef.current)
      }
      mr.start()
      mediaRef.current = mr
      setAudioMode('recording'); setRecSeconds(0)
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000)
    } catch {
      alert('Não foi possível aceder ao microfone.')
    }
  }

  function stopRecording() {
    if (mediaRef.current?.state === 'recording') mediaRef.current.stop()
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  function toggleShortcut(id: string) {
    setSelectedShortcuts(prev => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
    })
  }

  async function sendFeedback() {
    if (!active) return
    const textBody = [
      ...[...selectedShortcuts].map(id => shortcuts.find(s => s.id === id)?.body ?? ''),
      freeText.trim(),
    ].filter(Boolean).join('\n\n')

    if (!textBody && !audioBlob) { alert('Escreva, seleccione atalho, ou grave áudio antes de enviar.'); return }

    setSending(true)

    // Upload do áudio de resposta (se existir)
    let audioPath: string | null = null
    if (audioBlob) {
      const ext  = 'webm'
      audioPath  = `audio-feedback/${active.id}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('tf-videos')
        .upload(audioPath, audioBlob, { contentType: 'audio/webm', upsert: false })
      if (upErr) { alert('Erro ao enviar áudio: ' + upErr.message); setSending(false); return }
    }

    await tfFrom('video_submissions').update({
      status: 'reviewed',
      therapist_feedback: textBody || null,
      audio_feedback_path: audioPath,
      shortcut_ids: [...selectedShortcuts],
      reviewed_at: new Date().toISOString(),
    }).eq('id', active.id)

    await logAudit('video.reviewed', 'video_submissions', active.id, {
      shortcuts_used: selectedShortcuts.size,
      free_text: !!freeText.trim(),
      audio: !!audioBlob,
    })

    setSending(false); setActive(null); resetAudio(); load()
  }

  // Agrupa atalhos por categoria — ordem FIXA, sem filtro por conteúdo
  const byCategory = shortcuts.reduce<Record<string, FeedbackShortcut[]>>((acc, s) => {
    const k = AREA_LABELS[s.category as ClinicalArea] ?? s.category
    ;(acc[k] ??= []).push(s)
    return acc
  }, {})

  if (loading) return <div className="empty-state"><span className="spinner" /></div>

  const hasContent = selectedShortcuts.size > 0 || freeText.trim() || audioBlob

  return (
    <div>
      <h1 className="page-title">Fila de revisão</h1>
      <p className="page-sub">{queue.length} vídeo{queue.length !== 1 ? 's' : ''} por rever.</p>

      <div style={{ display: 'grid', gridTemplateColumns: active ? '280px 1fr' : '1fr', gap: 20 }}>
        {/* Lista */}
        <div className="card" style={{ padding: 0, alignSelf: 'start' }}>
          {queue.length === 0 && <p className="empty-state" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Icon name="check" size={16} style={{ color: 'var(--success)' }} /> Sem vídeos pendentes.</p>}
          {queue.map(s => (
            <div
              key={s.id}
              onClick={() => openReview(s)}
              style={{
                padding: '14px 16px', cursor: 'pointer', borderBottom: 'var(--hairline)',
                background: active?.id === s.id ? 'var(--primary-lt)' : 'transparent',
              }}
            >
              <div style={{ fontWeight: 600 }}>{s.patient_name}</div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)' }}>{formatDate(s.created_at)}</div>
              {s.patient_note && <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 4, fontStyle: 'italic' }}>"{s.patient_note}"</div>}
            </div>
          ))}
        </div>

        {/* Painel de revisão */}
        {active && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-lg)' }}>{active.patient_name}</div>
                <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-2)' }}>{formatDate(active.created_at)}</div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => setActive(null)}><Icon name="close" size={15} /></button>
            </div>

            {/* Vídeo — URL assinado de expiração curta (15 min) */}
            {videoUrl ? (
              <video
                src={videoUrl} controls playsInline
                style={{ width: '100%', borderRadius: 'var(--radius)', background: '#000', marginBottom: 20, maxHeight: 420 }}
              />
            ) : (
              <div style={{ background: '#000', borderRadius: 'var(--radius)', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                {videoError
                  ? <p style={{ color: '#f87171', fontSize: 'var(--font-sm)', textAlign: 'center', padding: 20 }}>{videoError}</p>
                  : <span className="spinner" />}
              </div>
            )}

            {/* ATALHOS FIXOS — regra de compliance §5.3
                Lista sempre igual, sempre na mesma ordem neutra.
                A app NÃO sabe o que está no vídeo. O TF avalia e escolhe. */}
            <div className="section-title">Atalhos de feedback (conjunto fixo)</div>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', fontStyle: 'italic', marginBottom: 12 }}>
              Estes atalhos são sempre os mesmos, independentemente do vídeo — a app não os filtra nem sugere.
            </p>

            {Object.keys(byCategory).length === 0 && (
              <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)', marginBottom: 12 }}>
                Sem atalhos ainda. Crie em <a href="/shortcuts" style={{ color: 'var(--primary)' }}>Atalhos</a>.
              </p>
            )}

            {Object.entries(byCategory).map(([cat, list]) => (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>{cat}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {list.map(sc => (
                    <button
                      key={sc.id}
                      onClick={() => toggleShortcut(sc.id)}
                      style={{
                        padding: '6px 12px', borderRadius: 999, fontSize: 'var(--font-sm)',
                        cursor: 'pointer', border: '1.5px solid',
                        borderColor: selectedShortcuts.has(sc.id) ? 'var(--eira-ocean)' : 'var(--border)',
                        background: selectedShortcuts.has(sc.id) ? 'var(--primary-lt)' : 'var(--surface)',
                        color: selectedShortcuts.has(sc.id) ? 'var(--eira-ocean)' : 'var(--text)',
                        fontWeight: selectedShortcuts.has(sc.id) ? 600 : 400,
                      }}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="divider" />

            {/* Texto adicional */}
            <div className="field">
              <label>Texto adicional (opcional)</label>
              <textarea rows={3} value={freeText} onChange={e => setFreeText(e.target.value)}
                placeholder="Escreva o seu feedback personalizado…" />
            </div>

            {/* ── Resposta por áudio ───────────────────────────── */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>Resposta por áudio (opcional)</label>

              {audioMode === 'idle' && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={startRecording}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Icon name="mic" size={14} /> Gravar resposta em voz
                </button>
              )}

              {audioMode === 'recording' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--eira-danger)', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                  <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--eira-danger)' }}>
                    A gravar… {formatSecs(recSeconds)}
                  </span>
                  <button className="btn btn-danger btn-sm" onClick={stopRecording}><Icon name="stop" size={14} /> Parar</button>
                </div>
              )}

              {audioMode === 'recorded' && audioUrl && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <audio src={audioUrl} controls style={{ width: '100%', borderRadius: 8 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={resetAudio}><Icon name="trash" size={14} /> Descartar</button>
                    <button className="btn btn-ghost btn-sm" onClick={startRecording}><Icon name="refresh" size={14} /> Gravar outra vez</button>
                  </div>
                </div>
              )}
            </div>

            {/* Pré-visualização do feedback */}
            {(selectedShortcuts.size > 0 || freeText.trim()) && (
              <div style={{ background: 'var(--primary-lt)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 16, fontSize: 'var(--font-sm)', borderLeft: '3px solid var(--eira-ocean)' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Pré-visualização do texto:</div>
                {[...selectedShortcuts].map(id => <div key={id} style={{ marginBottom: 4 }}>• {shortcuts.find(s => s.id === id)?.body}</div>)}
                {freeText.trim() && <div style={{ marginTop: 4 }}>{freeText}</div>}
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={sending || !hasContent}
              onClick={sendFeedback}
            >
              {sending ? <span className="spinner" /> : <><Icon name="check" size={15} /> Marcar como revisto e enviar feedback</>}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatSecs(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
