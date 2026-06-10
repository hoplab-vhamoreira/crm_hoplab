/**
 * Fila de revisão — NÚCLEO DE COMPLIANCE
 *
 * Regra inviolável (docs/compliance.md §5.3):
 * Os atalhos apresentados são SEMPRE o conjunto fixo do terapeuta.
 * A app NUNCA filtra, ordena, destaca ou pré-seleciona atalhos com
 * base no conteúdo do vídeo. Quem avalia e escolhe é o terapeuta.
 */
import { useEffect, useState } from 'react'
import { supabase, tfFrom } from '../lib/supabase'
import { useAuth } from '../context/auth'
import { logAudit } from '../lib/audit'
import type { FeedbackShortcut, ClinicalArea } from '@tf/types'

interface Submission {
  id: string
  patient_id: string
  storage_path: string
  patient_note: string | null
  created_at: string
  plan_exercise_id: string | null
  patient_name?: string
  exercise_title?: string
}

const AREA_LABELS: Record<ClinicalArea, string> = {
  respiracao: 'Respiração', ressonancia: 'Ressonância', articulacao: 'Articulação',
  tom: 'Tom', voz: 'Voz', mof: 'MOF', linguagem: 'Linguagem', gaguez: 'Gaguez',
}

export function ReviewQueuePage() {
  const { profile } = useAuth()
  const [queue, setQueue] = useState<Submission[]>([])
  const [active, setActive] = useState<Submission | null>(null)
  const [shortcuts, setShortcuts] = useState<FeedbackShortcut[]>([])
  const [selectedShortcuts, setSelectedShortcuts] = useState<Set<string>>(new Set())
  const [freeText, setFreeText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoError, setVideoError] = useState('')

  useEffect(() => { if (profile?.id) load() }, [profile?.id])

  async function load() {
    setLoading(true)
    const { data: subs } = await tfFrom('video_submissions')
      .select('id, patient_id, storage_path, patient_note, created_at, plan_exercise_id')
      .eq('therapist_id', profile!.id)
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true })

    // Nomes dos utentes
    const pids = [...new Set((subs ?? []).map(s => s.patient_id))]
    const { data: patients } = pids.length
      ? await tfFrom('tf_users').select('id, full_name').in('id', pids)
      : { data: [] }
    const nameMap = new Map((patients ?? []).map(p => [p.id, p.full_name]))

    setQueue((subs ?? []).map(s => ({ ...s, patient_name: nameMap.get(s.patient_id) ?? 'Utente' })))

    // Atalhos do terapeuta — lista FIXA, ordenação neutra (categoria + label)
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
    logAudit('video.viewed', 'video_submissions', sub.id)

    // URL assinado de expiração curta (15 min) — nunca download permanente
    const { data, error } = await supabase.storage.from('tf-videos').createSignedUrl(sub.storage_path, 900)
    if (error || !data?.signedUrl) setVideoError('Não foi possível carregar o vídeo. Pode já ter sido eliminado (retenção RGPD).')
    else setVideoUrl(data.signedUrl)
  }

  function toggleShortcut(id: string) {
    setSelectedShortcuts(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function sendFeedback() {
    if (!active) return
    const body = [
      ...[...selectedShortcuts].map(id => shortcuts.find(s => s.id === id)?.body ?? ''),
      freeText.trim(),
    ].filter(Boolean).join('\n\n')

    if (!body) { alert('Escreva ou seleccione feedback antes de enviar.'); return }

    setSending(true)
    await tfFrom('video_submissions').update({
      status: 'reviewed',
      therapist_feedback: body,
      shortcut_ids: [...selectedShortcuts],
      reviewed_at: new Date().toISOString(),
    }).eq('id', active.id)

    await logAudit('video.reviewed', 'video_submissions', active.id, { shortcuts_used: selectedShortcuts.size, free_text: !!freeText.trim() })

    setSending(false)
    setActive(null)
    load()
  }

  // Agrupa atalhos por categoria — ordem FIXA, sem filtro por conteúdo
  const byCategory = shortcuts.reduce<Record<string, FeedbackShortcut[]>>((acc, s) => {
    const k = AREA_LABELS[s.category as ClinicalArea] ?? s.category
    ;(acc[k] ??= []).push(s)
    return acc
  }, {})

  if (loading) return <div className="empty-state"><span className="spinner" /></div>

  return (
    <div>
      <h1 className="page-title">Fila de revisão</h1>
      <p className="page-sub">{queue.length} vídeo{queue.length !== 1 ? 's' : ''} por rever.</p>

      <div style={{ display: 'grid', gridTemplateColumns: active ? '280px 1fr' : '1fr', gap: 20 }}>
        {/* Lista */}
        <div className="card" style={{ padding: 0 }}>
          {queue.length === 0 && <p className="empty-state">Sem vídeos pendentes. ✅</p>}
          {queue.map(s => (
            <div
              key={s.id}
              onClick={() => openReview(s)}
              style={{
                padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
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
              <button className="btn btn-ghost btn-sm" onClick={() => setActive(null)}>✕</button>
            </div>

            {/* Vídeo — URL assinado de expiração curta */}
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
                        padding: '6px 12px', borderRadius: 20, fontSize: 'var(--font-sm)',
                        cursor: 'pointer', border: '1.5px solid',
                        borderColor: selectedShortcuts.has(sc.id) ? 'var(--primary)' : 'var(--border)',
                        background: selectedShortcuts.has(sc.id) ? 'var(--primary-lt)' : 'var(--surface)',
                        color: selectedShortcuts.has(sc.id) ? 'var(--primary)' : 'var(--text)',
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

            {/* Texto livre adicional */}
            <div className="field">
              <label>Texto adicional (opcional)</label>
              <textarea rows={3} value={freeText} onChange={e => setFreeText(e.target.value)} placeholder="Escreva o seu feedback personalizado…" />
            </div>

            {/* Pré-visualização do feedback que vai ser enviado */}
            {(selectedShortcuts.size > 0 || freeText.trim()) && (
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 16, fontSize: 'var(--font-sm)', borderLeft: '3px solid var(--primary)' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Pré-visualização do feedback:</div>
                {[...selectedShortcuts].map(id => <div key={id} style={{ marginBottom: 4 }}>• {shortcuts.find(s => s.id === id)?.body}</div>)}
                {freeText.trim() && <div style={{ marginTop: 4 }}>{freeText}</div>}
              </div>
            )}

            <button className="btn btn-primary" style={{ width: '100%' }} disabled={sending || (!selectedShortcuts.size && !freeText.trim())} onClick={sendFeedback}>
              {sending ? <span className="spinner" /> : '✓ Marcar como revisto e enviar feedback'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
