import { useEffect, useState, useRef, FormEvent } from 'react'
import { supabase, tfFrom } from '../lib/supabase'
import { useAuth } from '../context/auth'
import { Icon } from '../components/Icon'
import type { Exercise, ClinicalArea } from '@tf/types'

const AREAS: ClinicalArea[] = ['respiracao','ressonancia','articulacao','tom','voz','mof','linguagem','gaguez']

const blank = (): Omit<Exercise, 'id' | 'created_at' | 'updated_at'> => ({
  therapist_id: '',
  title: '',
  instructions: null,
  video_url: null,
  clinical_area: 'respiracao',
  duration_seconds: null,
})

export function ExerciseLibraryPage() {
  const { profile } = useAuth()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [filter, setFilter] = useState<ClinicalArea | 'all'>('all')
  const [editing, setEditing] = useState<Partial<Exercise> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedDone, setSeedDone] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Gravação por webcam (desktop)
  const [recMode, setRecMode] = useState<'idle' | 'live' | 'recording' | 'recorded'>('idle')
  const [recBlob, setRecBlob] = useState<Blob | null>(null)
  const [recUrl, setRecUrl] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const liveRef = useRef<HTMLVideoElement>(null)

  async function uploadVideo(data: Blob, ext: string, contentType: string) {
    if (!profile?.id) return
    if (data.size > 100 * 1024 * 1024) { setUploadError('O vídeo não pode exceder 100 MB.'); return }
    setUploadingVideo(true); setUploadError('')
    const path = `modeling/${profile.id}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('tf-videos').upload(path, data, { contentType, upsert: false })
    if (error) setUploadError('Erro ao carregar: ' + error.message)
    else { setEditing(v => ({ ...v!, video_url: `storage:${path}` })); closeRecorder() }
    setUploadingVideo(false)
  }

  async function openRecorder() {
    setUploadError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true })
      streamRef.current = stream
      setRecMode('live')
      // o <video> só existe após o re-render
      setTimeout(() => { if (liveRef.current) { liveRef.current.srcObject = stream; liveRef.current.play() } }, 50)
    } catch {
      setUploadError('Não foi possível aceder à câmara/microfone.')
    }
  }

  function startRec() {
    if (!streamRef.current) return
    const mr = new MediaRecorder(streamRef.current, { mimeType: 'video/webm;codecs=vp8,opus' })
    chunksRef.current = []
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      setRecBlob(blob)
      setRecUrl(URL.createObjectURL(blob))
      setRecMode('recorded')
    }
    mr.start()
    recorderRef.current = mr
    setRecMode('recording')
  }

  function stopRec() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  function closeRecorder() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (recUrl) URL.revokeObjectURL(recUrl)
    setRecBlob(null); setRecUrl(null); setRecMode('idle')
  }

  useEffect(() => { if (profile?.id) load() }, [profile?.id])
  useEffect(() => { if (profile?.id) load() }, [filter])

  async function load() {
    setLoading(true)
    const q = tfFrom('exercises').select('*').eq('therapist_id', profile!.id).order('clinical_area').order('title')
    const { data } = filter !== 'all' ? await q.eq('clinical_area', filter) : await q
    setExercises(data ?? [])
    setLoading(false)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    if (editing.id) {
      await tfFrom('exercises').update({ title: editing.title, instructions: editing.instructions, video_url: editing.video_url, clinical_area: editing.clinical_area, duration_seconds: editing.duration_seconds }).eq('id', editing.id)
    } else {
      await tfFrom('exercises').insert({ ...blank(), ...editing, therapist_id: profile!.id })
    }
    setSaving(false); setEditing(null); closeRecorder(); load()
  }

  async function seedLibrary() {
    if (!profile?.id) return
    setSeeding(true)
    const seed: Omit<Exercise, 'id' | 'created_at' | 'updated_at'>[] = [
      // Respiração
      { therapist_id: profile.id, title: 'Respiração diafragmática', clinical_area: 'respiracao', duration_seconds: 120, instructions: 'Inspire pelo nariz contando 4 tempos, expire pela boca contando 8 tempos. Mão sobre o abdómen para sentir o movimento.', video_url: null },
      { therapist_id: profile.id, title: 'Coordenação pneumofonoarticulatória', clinical_area: 'respiracao', duration_seconds: 90, instructions: 'Inspire, faça pausa breve e produza /s/ contínuo na expiração durante 10–15 segundos.', video_url: null },
      { therapist_id: profile.id, title: 'Sopro sonoro sustentado', clinical_area: 'respiracao', duration_seconds: 60, instructions: 'Mantenha /f/ ou /s/ contínuo o máximo de tempo possível sem tensão cervical.', video_url: null },
      // Articulação
      { therapist_id: profile.id, title: 'Movimentos labiais alternados', clinical_area: 'articulacao', duration_seconds: 60, instructions: 'Alterne /p/ – /b/ – /m/ em séries de 10 repetições, com atenção ao encerramento labial completo.', video_url: null },
      { therapist_id: profile.id, title: 'Diadococinesia /pa-ta-ca/', clinical_area: 'articulacao', duration_seconds: 60, instructions: 'Repita /pa-ta-ca/ o mais rápido e claro possível durante 10 segundos. Registe repetições por segundo.', video_url: null },
      { therapist_id: profile.id, title: 'Exercício de língua — ponta', clinical_area: 'articulacao', duration_seconds: 45, instructions: 'Eleve a ponta da língua ao alvéolo superior e mantenha 5 segundos. Repita 10×.', video_url: null },
      { therapist_id: profile.id, title: 'Trava-língua terapêutico', clinical_area: 'articulacao', duration_seconds: 90, instructions: 'Produza trava-língua com os sons-alvo em velocidade crescente, mantendo inteligibilidade.', video_url: null },
      // Voz
      { therapist_id: profile.id, title: 'Humming — voz suave', clinical_area: 'voz', duration_seconds: 90, instructions: 'Produza /m/ com lábios relaxados, sem esforço, sentindo vibração nos lábios. Deslize lentamente na tessitura.', video_url: null },
      { therapist_id: profile.id, title: 'Tempo máximo de fonação /a/', clinical_area: 'voz', duration_seconds: 30, instructions: 'Inspire profundamente e emita /a/ sustentado o máximo de tempo em intensidade confortável.', video_url: null },
      { therapist_id: profile.id, title: 'Glides ascendentes e descendentes', clinical_area: 'voz', duration_seconds: 60, instructions: 'Deslize em /i/ do mais grave possível ao mais agudo e desça. Sem quebras ou tensão. 5 repetições.', video_url: null },
      { therapist_id: profile.id, title: 'Exercício de tracto semiocluído — canudo', clinical_area: 'voz', duration_seconds: 90, instructions: 'Expire através de um canudo fino durante 5 segundos. Sinta resistência labial. Repita 10×.', video_url: null },
      // Ressonância
      { therapist_id: profile.id, title: 'Fala anterior — /mi-ma-mo/', clinical_area: 'ressonancia', duration_seconds: 60, instructions: 'Produza /mi-ma-mo/ com foco na vibração nos lábios. Evite ressonância nasal em /a/ e /o/.', video_url: null },
      { therapist_id: profile.id, title: 'Controlo de hipernasalidade — plug nasal', clinical_area: 'ressonancia', duration_seconds: 90, instructions: 'Tampe as narinas gentilmente e compare o som oral com o nasal. Pratique alternância consciente.', video_url: null },
      // Motricidade Orofacial
      { therapist_id: profile.id, title: 'Selagem labial ativa', clinical_area: 'mof', duration_seconds: 45, instructions: 'Comprima lábios com espátula entre eles (sem morder) durante 10 segundos. 5 repetições.', video_url: null },
      { therapist_id: profile.id, title: 'Elevação do véu do palato — /a/ rápido', clinical_area: 'mof', duration_seconds: 45, instructions: 'Produza /a/ curto e forte repetidamente para estimular a elevação velar. 20 repetições.', video_url: null },
      { therapist_id: profile.id, title: 'Mobilidade de mandíbula', clinical_area: 'mof', duration_seconds: 60, instructions: 'Abra a boca lentamente ao máximo sem dor, mantenha 5 segundos e feche. 8 repetições.', video_url: null },
      // Gaguez
      { therapist_id: profile.id, title: 'Fala suave — início suave', clinical_area: 'gaguez', duration_seconds: 90, instructions: 'Inicie cada palavra com fluxo de ar suave antes de acionar a fonação. Pratique em frases curtas.', video_url: null },
      { therapist_id: profile.id, title: 'Controlo de ritmo — fala lenta', clinical_area: 'gaguez', duration_seconds: 120, instructions: 'Leia em voz alta a 50% da velocidade habitual. Use o metrónomo a 60 bpm como guia.', video_url: null },
      { therapist_id: profile.id, title: 'Cancelamento de gaguez', clinical_area: 'gaguez', duration_seconds: 90, instructions: 'Quando gaguejar, pare voluntariamente, pause 2 segundos e recomece a palavra de forma suave.', video_url: null },
      // Linguagem
      { therapist_id: profile.id, title: 'Nomeação por categorias', clinical_area: 'linguagem', duration_seconds: 60, instructions: 'Nomeie o maior número de itens de uma categoria (ex.: animais) em 60 segundos.', video_url: null },
      { therapist_id: profile.id, title: 'Completamento de frases', clinical_area: 'linguagem', duration_seconds: 90, instructions: 'Complete frases deixadas em aberto pelo terapeuta com a palavra mais adequada ao contexto.', video_url: null },
      { therapist_id: profile.id, title: 'Leitura em voz alta — parágrafo', clinical_area: 'linguagem', duration_seconds: 180, instructions: 'Leia um parágrafo em voz alta com atenção à prosódia e pontuação. Grave e reveja.', video_url: null },
      // Tom
      { therapist_id: profile.id, title: 'Variação de tom prosódico', clinical_area: 'tom', duration_seconds: 60, instructions: 'Repita a mesma frase com entoações diferentes (afirmação, pergunta, surpresa). 5 padrões.', video_url: null },
      { therapist_id: profile.id, title: 'Escalas de altura tonal', clinical_area: 'tom', duration_seconds: 90, instructions: 'Suba em dó-ré-mi-fá-sol e desça, em voz falada. Mantenha qualidade vocal em todos os semitons.', video_url: null },
    ]
    await tfFrom('exercises').insert(seed)
    setSeeding(false)
    setSeedDone(true)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Eliminar exercício? Esta ação é irreversível.')) return
    await tfFrom('exercises').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12 }}>
        <div>
          <h1 className="page-title">Biblioteca</h1>
          <p className="page-sub">Conteúdos de modelagem reutilizáveis.</p>
        </div>
        <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={() => setEditing(blank())}>
          <Icon name="plus" size={16} /> Novo
        </button>
      </div>

      {/* Filtro por área */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {(['all', ...AREAS] as const).map(a => (
          <button key={a} className={`btn btn-sm ${filter === a ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(a)}>
            {a === 'all' ? 'Todas' : a}
          </button>
        ))}
      </div>

      {/* Lista — cards responsivos */}
      {loading ? <div className="empty-state"><span className="spinner" /></div> : exercises.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <Icon name="book" size={40} style={{ color: 'var(--eira-mist)', marginBottom: 12 }} />
          <p style={{ color: 'var(--text-2)', marginBottom: 20 }}>A biblioteca está vazia.</p>
          {seedDone ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--success)', fontWeight: 600 }}>
              <Icon name="check" size={18} /> 24 exercícios importados
            </div>
          ) : (
            <button className="btn btn-ghost" onClick={seedLibrary} disabled={seeding} style={{ margin: '0 auto' }}>
              {seeding ? <><span className="spinner" /> A importar…</> : <><Icon name="zap" size={15} /> Importar exercícios iniciais</>}
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {exercises.map(ex => (
            <div key={ex.id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600 }}>{ex.title}</span>
                    <span className="badge badge-blue">{ex.clinical_area}</span>
                    {ex.duration_seconds && <span className="badge badge-blue">{ex.duration_seconds}s</span>}
                    {ex.video_url && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 'var(--font-xs)', color: 'var(--success)' }}>
                        <Icon name="video" size={12} /> vídeo
                      </span>
                    )}
                  </div>
                  {ex.instructions && (
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ex.instructions}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(ex)} style={{ padding: '6px 8px' }}>
                    <Icon name="edit" size={15} />
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(ex.id)} style={{ padding: '6px 8px' }}>
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de edição */}
      {editing !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 'var(--font-xl)' }}>{editing.id ? 'Editar' : 'Novo'} exercício</h2>
            <form onSubmit={save}>
              <div className="field"><label>Título *</label><input value={editing.title ?? ''} onChange={e => setEditing(v => ({ ...v!, title: e.target.value }))} required /></div>
              <div className="field">
                <label>Área clínica *</label>
                <select value={editing.clinical_area ?? 'respiracao'} onChange={e => setEditing(v => ({ ...v!, clinical_area: e.target.value as ClinicalArea }))}>
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="field"><label>Instruções</label><textarea rows={4} value={editing.instructions ?? ''} onChange={e => setEditing(v => ({ ...v!, instructions: e.target.value || null }))} /></div>
              <div className="field">
                <label>Vídeo de modelagem</label>
                {editing.video_url?.startsWith('storage:') ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--success-lt)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                    <Icon name="video" size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 'var(--font-sm)', color: 'var(--success)', fontWeight: 600 }}>Vídeo próprio carregado</span>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}
                      onClick={() => setEditing(v => ({ ...v!, video_url: null }))} title="Remover vídeo">
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                ) : recMode === 'idle' ? (
                  <>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="url" value={editing.video_url ?? ''} onChange={e => setEditing(v => ({ ...v!, video_url: e.target.value || null }))} placeholder="https://… (YouTube, Vimeo ou link directo)" style={{ flex: 1 }} />
                      <button type="button" className="btn btn-ghost btn-sm" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                        disabled={uploadingVideo} onClick={() => fileRef.current?.click()}>
                        {uploadingVideo ? <span className="spinner" /> : <><Icon name="plus" size={14} /> Carregar</>}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                        disabled={uploadingVideo} onClick={openRecorder}>
                        <Icon name="camera" size={14} /> Gravar
                      </button>
                    </div>
                    <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }}
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) uploadVideo(f, f.name.split('.').pop()?.toLowerCase() || 'mp4', f.type || 'video/mp4')
                        e.target.value = ''
                      }} />
                    <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 6, marginBottom: 0 }}>
                      Cole um link, carregue um ficheiro ou grave com a câmara do computador (máx. 100 MB).
                    </p>
                  </>
                ) : (
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12 }}>
                    {(recMode === 'live' || recMode === 'recording') && (
                      <video ref={liveRef} muted playsInline style={{ width: '100%', borderRadius: 'var(--radius-sm)', background: '#000', transform: 'scaleX(-1)', maxHeight: 280 }} />
                    )}
                    {recMode === 'recorded' && recUrl && (
                      <video src={recUrl} controls playsInline style={{ width: '100%', borderRadius: 'var(--radius-sm)', background: '#000', maxHeight: 280 }} />
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                      {recMode === 'live' && (
                        <button type="button" className="btn btn-primary btn-sm" onClick={startRec}>
                          <Icon name="mic" size={14} /> Começar a gravar
                        </button>
                      )}
                      {recMode === 'recording' && (
                        <>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--eira-danger)', display: 'inline-block' }} />
                          <button type="button" className="btn btn-danger btn-sm" onClick={stopRec}>
                            <Icon name="stop" size={14} /> Parar
                          </button>
                        </>
                      )}
                      {recMode === 'recorded' && recBlob && (
                        <>
                          <button type="button" className="btn btn-primary btn-sm" disabled={uploadingVideo}
                            onClick={() => uploadVideo(recBlob, 'webm', 'video/webm')}>
                            {uploadingVideo ? <span className="spinner" /> : <><Icon name="check" size={14} /> Usar este vídeo</>}
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" disabled={uploadingVideo} onClick={() => { if (recUrl) URL.revokeObjectURL(recUrl); setRecBlob(null); setRecUrl(null); openRecorder() }}>
                            <Icon name="refresh" size={14} /> Repetir
                          </button>
                        </>
                      )}
                      <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} disabled={uploadingVideo} onClick={closeRecorder}>
                        <Icon name="close" size={14} /> Fechar
                      </button>
                    </div>
                  </div>
                )}
                {uploadError && <p style={{ color: 'var(--error)', fontSize: 'var(--font-sm)', marginTop: 6 }}>{uploadError}</p>}
              </div>
              <div className="field"><label>Duração sugerida (segundos)</label><input type="number" min={1} max={3600} value={editing.duration_seconds ?? ''} onChange={e => setEditing(v => ({ ...v!, duration_seconds: e.target.value ? +e.target.value : null }))} /></div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setEditing(null); closeRecorder() }}>Cancelar</button>
                <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>{saving ? <span className="spinner" /> : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
