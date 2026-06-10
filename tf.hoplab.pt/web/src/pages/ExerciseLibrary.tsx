import { useEffect, useState, FormEvent } from 'react'
import { tfFrom } from '../lib/supabase'
import { useAuth } from '../context/auth'
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

  async function load() {
    setLoading(true)
    const q = tfFrom('exercises').select('*').eq('therapist_id', profile!.id).order('clinical_area').order('title')
    const { data } = filter !== 'all' ? await q.eq('clinical_area', filter) : await q
    setExercises(data ?? [])
    setLoading(false)
  }

  useEffect(() => { if (profile?.id) load() }, [filter])

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div><h1 className="page-title">Biblioteca de exercícios</h1><p className="page-sub">Conteúdos de modelagem reutilizáveis entre utentes.</p></div>
        <button className="btn btn-primary" onClick={() => setEditing(blank())}>+ Novo exercício</button>
      </div>

      {/* Filtro por área */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {(['all', ...AREAS] as const).map(a => (
          <button key={a} className={`btn btn-sm ${filter === a ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(a)}>
            {a === 'all' ? 'Todas' : a}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? <div className="empty-state"><span className="spinner" /></div> : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Título</th><th>Área</th><th>Duração</th><th>Vídeo</th><th></th></tr></thead>
            <tbody>
              {exercises.length === 0 && <tr><td colSpan={5} className="empty-state">Sem exercícios ainda.</td></tr>}
              {exercises.map(ex => (
                <tr key={ex.id}>
                  <td style={{ fontWeight: 600 }}>{ex.title}</td>
                  <td><span className="badge badge-blue">{ex.clinical_area}</span></td>
                  <td>{ex.duration_seconds ? `${ex.duration_seconds}s` : '—'}</td>
                  <td>{ex.video_url ? '✅' : '—'}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(ex)}>Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(ex.id)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de edição */}
      {editing !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: 520, maxHeight: '90vh', overflowY: 'auto', padding: 32 }}>
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
