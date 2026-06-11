import { useEffect, useState, FormEvent } from 'react'
import { tfFrom } from '../lib/supabase'
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
    setSaving(false); setEditing(null); load()
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
          <p style={{ color: 'var(--text-2)' }}>Sem exercícios ainda.</p>
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
              <div className="field"><label>URL do vídeo de modelagem</label><input type="url" value={editing.video_url ?? ''} onChange={e => setEditing(v => ({ ...v!, video_url: e.target.value || null }))} placeholder="https://…" /></div>
              <div className="field"><label>Duração sugerida (segundos)</label><input type="number" min={1} max={3600} value={editing.duration_seconds ?? ''} onChange={e => setEditing(v => ({ ...v!, duration_seconds: e.target.value ? +e.target.value : null }))} /></div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditing(null)}>Cancelar</button>
                <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>{saving ? <span className="spinner" /> : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
