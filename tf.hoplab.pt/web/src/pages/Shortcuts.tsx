/**
 * Gestão de atalhos de feedback — curados antecipadamente pelo TF.
 * Ver regra de compliance docs/compliance.md §5.3.
 */
import { useEffect, useState, FormEvent } from 'react'
import { tfFrom } from '../lib/supabase'
import { useAuth } from '../context/auth'
import type { FeedbackShortcut, ClinicalArea } from '@tf/types'

const AREAS: ClinicalArea[] = ['respiracao','ressonancia','articulacao','tom','voz','mof','linguagem','gaguez']

const blank = (): Omit<FeedbackShortcut, 'id' | 'created_at' | 'updated_at' | 'therapist_id'> => ({
  category: 'respiracao', label: '', body: '', sort_order: 0,
})

export function ShortcutsPage() {
  const { profile } = useAuth()
  const [shortcuts, setShortcuts] = useState<FeedbackShortcut[]>([])
  const [filter, setFilter] = useState<ClinicalArea | 'all'>('all')
  const [editing, setEditing] = useState<Partial<FeedbackShortcut> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (profile?.id) load() }, [profile?.id, filter])

  async function load() {
    setLoading(true)
    const q = tfFrom('feedback_shortcuts').select('*').eq('therapist_id', profile!.id).order('category').order('sort_order').order('label')
    const { data } = filter !== 'all' ? await q.eq('category', filter) : await q
    setShortcuts(data ?? [])
    setLoading(false)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    if (editing.id) {
      await tfFrom('feedback_shortcuts').update({ category: editing.category, label: editing.label, body: editing.body, sort_order: editing.sort_order ?? 0 }).eq('id', editing.id)
    } else {
      await tfFrom('feedback_shortcuts').insert({ ...blank(), ...editing, therapist_id: profile!.id })
    }
    setSaving(false); setEditing(null); load()
  }

  async function remove(id: string) {
    if (!confirm('Eliminar atalho?')) return
    await tfFrom('feedback_shortcuts').delete().eq('id', id)
    load()
  }

  const byCategory = shortcuts.reduce<Record<string, FeedbackShortcut[]>>((acc, s) => {
    ;(acc[s.category] ??= []).push(s)
    return acc
  }, {})

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Atalhos de feedback</h1>
          <p className="page-sub">Respostas pré-escritas, curadas por si antecipadamente.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing(blank())}>+ Novo atalho</button>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: 16 }}>
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-2)', margin: 0 }}>
          ⚠️ <strong>Regra de compliance:</strong> estes atalhos são sempre apresentados em ordem fixa e neutra na fila de revisão.
          A app nunca filtra, ordena ou sugere atalhos com base no conteúdo do vídeo do utente.
          A escolha é exclusivamente sua.
        </p>
      </div>

      {/* Filtro */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {(['all', ...AREAS] as const).map(a => (
          <button key={a} className={`btn btn-sm ${filter === a ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(a)}>
            {a === 'all' ? 'Todas' : a}
          </button>
        ))}
      </div>

      {loading ? <div className="empty-state"><span className="spinner" /></div> : (
        filter === 'all'
          ? Object.entries(byCategory).map(([cat, list]) => (
            <div key={cat} className="card" style={{ marginBottom: 16 }}>
              <div className="section-title">{cat}</div>
              {list.map(sc => (
                <div key={sc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{sc.label}</div>
                    <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-2)', marginTop: 2 }}>{sc.body}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 16, flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(sc)}>Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(sc.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          ))
          : (
            <div className="card" style={{ padding: 0 }}>
              <table>
                <thead><tr><th>Label</th><th>Texto</th><th>Ordem</th><th></th></tr></thead>
                <tbody>
                  {shortcuts.map(sc => (
                    <tr key={sc.id}>
                      <td style={{ fontWeight: 600 }}>{sc.label}</td>
                      <td style={{ color: 'var(--text-2)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.body}</td>
                      <td>{sc.sort_order}</td>
                      <td style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(sc)}>Editar</button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(sc.id)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      )}

      {/* Modal */}
      {editing !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: 480, padding: 32 }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 'var(--font-xl)' }}>{editing.id ? 'Editar' : 'Novo'} atalho</h2>
            <form onSubmit={save}>
              <div className="field">
                <label>Categoria *</label>
                <select value={editing.category ?? 'respiracao'} onChange={e => setEditing(v => ({ ...v!, category: e.target.value as ClinicalArea }))}>
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="field"><label>Label (nome curto) *</label><input value={editing.label ?? ''} onChange={e => setEditing(v => ({ ...v!, label: e.target.value }))} placeholder="Ex: Atenção à respiração" required /></div>
              <div className="field"><label>Texto completo *</label><textarea rows={3} value={editing.body ?? ''} onChange={e => setEditing(v => ({ ...v!, body: e.target.value }))} placeholder="Texto que o utente vai receber" required /></div>
              <div className="field"><label>Ordem de apresentação</label><input type="number" min={0} value={editing.sort_order ?? 0} onChange={e => setEditing(v => ({ ...v!, sort_order: +e.target.value }))} /></div>
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
