import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { tfFrom } from '../lib/supabase'
import { useAuth } from '../context/auth'
import { logAudit } from '../lib/audit'
import { Icon } from '../components/Icon'
import type { TreatmentPlan, Exercise, PlanExercise } from '@tf/types'

interface DraftExercise {
  tempId: string
  exercise_id: string
  exercise?: Exercise
  week_number: number
  sets: number
  reps: number | null
  duration_seconds: number | null
  therapist_notes: string
  sort_order: number
  day_of_week: number[] | null   // 0=Dom … 6=Sáb (convenção JS); null = todos os dias
  allow_repeat: boolean          // utente pode repetir no mesmo dia
}

// Ordem de apresentação: Seg → Dom
const DAY_CHIPS: { d: number; label: string }[] = [
  { d: 1, label: 'S' }, { d: 2, label: 'T' }, { d: 3, label: 'Q' }, { d: 4, label: 'Q' },
  { d: 5, label: 'S' }, { d: 6, label: 'S' }, { d: 0, label: 'D' },
]
const DAY_NAMES: Record<number, string> = { 1: '2ª', 2: '3ª', 3: '4ª', 4: '5ª', 5: '6ª', 6: 'Sáb', 0: 'Dom' }

interface PlanTemplate {
  id: string
  name: string
  total_weeks: number
  notes: string | null
  exercises: Omit<DraftExercise, 'tempId' | 'exercise'>[]
  created_at: string
}

export function PlanBuilderPage() {
  const { patientId, planId } = useParams<{ patientId: string; planId?: string }>()
  const { profile } = useAuth()
  const nav = useNavigate()

  const [title, setTitle]           = useState('')
  const [totalWeeks, setTotalWeeks] = useState(6)
  const [startsOn, setStartsOn]     = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes]           = useState('')
  const [exercises, setExercises]   = useState<DraftExercise[]>([])
  const [library, setLibrary]       = useState<Exercise[]>([])
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [saving, setSaving]         = useState(false)
  const [loading, setLoading]       = useState(true)

  // Templates
  const [templates, setTemplates]         = useState<PlanTemplate[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName]   = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateSaved, setTemplateSaved] = useState(false)

  useEffect(() => { if (profile?.id) init() }, [profile?.id])

  async function init() {
    const { data: lib } = await tfFrom('exercises').select('*').eq('therapist_id', profile!.id)
    setLibrary(lib ?? [])

    // Carregar templates existentes
    const { data: tmpl } = await tfFrom('plan_templates')
      .select('*').eq('therapist_id', profile!.id).order('created_at', { ascending: false })
    setTemplates((tmpl ?? []) as PlanTemplate[])

    if (planId) {
      const { data: plan } = await tfFrom('treatment_plans').select('*').eq('id', planId).single()
      if (plan) {
        setTitle(plan.title); setTotalWeeks(plan.total_weeks)
        setStartsOn(plan.starts_on); setNotes(plan.notes ?? '')
      }
      const { data: pe } = await tfFrom('plan_exercises').select('*, exercise:tf_exercises(*)').eq('plan_id', planId).order('week_number').order('sort_order')
      setExercises((pe ?? []).map((p, i) => ({
        tempId: p.id, exercise_id: p.exercise_id, exercise: (p as any).exercise,
        week_number: p.week_number, sets: p.sets, reps: p.reps,
        duration_seconds: p.duration_seconds, therapist_notes: p.therapist_notes ?? '', sort_order: i,
        day_of_week: (p as any).day_of_week ?? null, allow_repeat: (p as any).allow_repeat ?? false,
      })))
    }
    setLoading(false)
  }

  function addExercise(ex: Exercise) {
    setExercises(prev => [...prev, {
      tempId: crypto.randomUUID(), exercise_id: ex.id, exercise: ex,
      week_number: selectedWeek, sets: 3, reps: null,
      duration_seconds: ex.duration_seconds, therapist_notes: '', sort_order: prev.length,
      day_of_week: null, allow_repeat: false,
    }])
  }

  function updateDraft(tempId: string, patch: Partial<DraftExercise>) {
    setExercises(prev => prev.map(d => d.tempId === tempId ? { ...d, ...patch } : d))
  }

  function removeDraft(tempId: string) {
    setExercises(prev => prev.filter(d => d.tempId !== tempId))
  }

  function toggleDay(tempId: string, day: number) {
    setExercises(prev => prev.map(d => {
      if (d.tempId !== tempId) return d
      const cur = d.day_of_week ?? []
      const next = cur.includes(day) ? cur.filter(x => x !== day) : [...cur, day]
      return { ...d, day_of_week: next.length ? next : null }
    }))
  }

  // Copia os exercícios da semana actual para outra (substitui o conteúdo da semana destino)
  function copyWeekTo(target: number) {
    const source = exercises.filter(e => e.week_number === selectedWeek)
    if (!source.length) return
    const targetHas = exercises.some(e => e.week_number === target)
    if (targetHas && !confirm(`A semana ${target} já tem exercícios — substituir pelo conteúdo da semana ${selectedWeek}?`)) return
    setExercises(prev => [
      ...prev.filter(e => e.week_number !== target),
      ...source.map(e => ({ ...e, tempId: crypto.randomUUID(), week_number: target })),
    ])
  }

  // Copia as atribuições de um dia para outro (na semana actual):
  // exercícios que incluem o dia de origem passam a incluir também o destino
  function copyDay(from: number, to: number) {
    setExercises(prev => prev.map(d => {
      if (d.week_number !== selectedWeek) return d
      if (!d.day_of_week?.includes(from) || d.day_of_week.includes(to)) return d
      return { ...d, day_of_week: [...d.day_of_week, to] }
    }))
  }

  // Guardar plano actual como template
  async function saveAsTemplate() {
    if (!templateName.trim()) return
    setSavingTemplate(true)
    await tfFrom('plan_templates').insert({
      therapist_id: profile!.id,
      name: templateName.trim(),
      total_weeks: totalWeeks,
      notes: notes || null,
      exercises: exercises.map(d => ({
        exercise_id: d.exercise_id,
        week_number: d.week_number,
        sets: d.sets,
        reps: d.reps,
        duration_seconds: d.duration_seconds,
        therapist_notes: d.therapist_notes,
        sort_order: d.sort_order,
        day_of_week: d.day_of_week,
        allow_repeat: d.allow_repeat,
      })),
    })
    await logAudit('template.created', 'plan_templates')
    // Actualizar lista local
    const { data: tmpl } = await tfFrom('plan_templates')
      .select('*').eq('therapist_id', profile!.id).order('created_at', { ascending: false })
    setTemplates((tmpl ?? []) as PlanTemplate[])
    setSavingTemplate(false)
    setTemplateSaved(true)
    setTimeout(() => { setShowSaveTemplate(false); setTemplateName(''); setTemplateSaved(false) }, 1500)
  }

  // Carregar template para o plano actual
  function loadTemplate(tmpl: PlanTemplate) {
    setTotalWeeks(tmpl.total_weeks)
    setNotes(tmpl.notes ?? '')
    // Reconstrói rascunhos com referências da biblioteca
    const libMap = new Map(library.map(ex => [ex.id, ex]))
    setExercises(tmpl.exercises.map((e, i) => ({
      tempId: crypto.randomUUID(),
      exercise_id: e.exercise_id,
      exercise: libMap.get(e.exercise_id),
      week_number: e.week_number,
      sets: e.sets,
      reps: e.reps,
      duration_seconds: e.duration_seconds,
      therapist_notes: e.therapist_notes ?? '',
      sort_order: i,
      day_of_week: (e as any).day_of_week ?? null,
      allow_repeat: (e as any).allow_repeat ?? false,
    })))
    setSelectedWeek(1)
    setShowTemplates(false)
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Eliminar template?')) return
    await tfFrom('plan_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  async function save() {
    if (!title.trim()) { alert('Introduza um título para o plano.'); return }
    setSaving(true)

    let pid = planId
    if (!pid) {
      const { data: newPlan, error } = await tfFrom('treatment_plans').insert({
        therapist_id: profile!.id, patient_id: patientId!,
        title, total_weeks: totalWeeks, starts_on: startsOn, notes: notes || null, current_week: 1,
      }).select('id').single()
      if (error || !newPlan) { setSaving(false); alert(error?.message); return }
      pid = newPlan.id
      await logAudit('plan.created', 'treatment_plans', pid)
    } else {
      await tfFrom('treatment_plans').update({ title, total_weeks: totalWeeks, starts_on: startsOn, notes: notes || null }).eq('id', pid)
      await tfFrom('plan_exercises').delete().eq('plan_id', pid)
      await logAudit('plan.updated', 'treatment_plans', pid)
    }

    if (exercises.length > 0) {
      await tfFrom('plan_exercises').insert(exercises.map((d, i) => ({
        plan_id: pid!, exercise_id: d.exercise_id, week_number: d.week_number,
        sets: d.sets, reps: d.reps, duration_seconds: d.duration_seconds,
        therapist_notes: d.therapist_notes || null, sort_order: i,
        day_of_week: d.day_of_week?.length ? d.day_of_week : null,
        allow_repeat: d.allow_repeat,
      })))
    }

    setSaving(false)
    nav(`/patients/${patientId}`)
  }

  if (loading) return <div className="empty-state"><span className="spinner" /></div>

  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1)
  const weekExercises = exercises.filter(e => e.week_number === selectedWeek)

  return (
    <div>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => nav(`/patients/${patientId}`)}>
        <Icon name="arrow-left" size={15} /> Utente
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">{planId ? 'Editar plano' : 'Novo plano'}</h1>
          <p className="page-sub">Defina semanas e exercícios. O utente vê apenas o plano publicado.</p>
        </div>
        {/* Acções de template */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowTemplates(true)} style={{ gap: 6 }}>
            <Icon name="book" size={15} /> Carregar template
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setShowSaveTemplate(true); setTemplateName(title || '') }} style={{ gap: 6 }}>
            <Icon name="star" size={15} /> Guardar como template
          </button>
        </div>
      </div>

      {/* ── Modal: carregar template ──────────────────────────────── */}
      {showTemplates && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 28, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 'var(--font-xl)' }}>Templates guardados</h2>
              <button className="btn btn-ghost btn-sm" style={{ padding: '6px 8px' }} onClick={() => setShowTemplates(false)}>
                <Icon name="close" size={16} />
              </button>
            </div>

            {templates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-2)' }}>
                <Icon name="book" size={36} style={{ marginBottom: 10, color: 'var(--eira-mist)' }} />
                <p>Sem templates ainda.<br />Crie um guardando o plano actual.</p>
              </div>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {templates.map(t => (
                  <div key={t.id} style={{ padding: '14px 0', borderBottom: 'var(--hairline)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 2 }}>
                        {t.total_weeks} semanas · {(t.exercises as any[]).length} exercícios
                        {' · '}{new Date(t.created_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => loadTemplate(t)}>Carregar</button>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '6px 8px', color: 'var(--eira-danger)', borderColor: 'var(--eira-danger)' }} onClick={() => deleteTemplate(t.id)}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 16, fontStyle: 'italic' }}>
              Carregar um template substitui semanas e exercícios actuais. O título e a data de início mantêm-se.
            </p>
          </div>
        </div>
      )}

      {/* ── Modal: guardar como template ─────────────────────────── */}
      {showSaveTemplate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 400, padding: 28 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 'var(--font-xl)' }}>Guardar como template</h2>
            <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)', marginBottom: 20 }}>
              Guarda este plano ({exercises.length} exercícios, {totalWeeks} semanas) como template reutilizável para outros utentes.
            </p>

            {templateSaved ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--success-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                  <Icon name="check" size={26} style={{ color: 'var(--success)' }} />
                </div>
                <div style={{ fontWeight: 600, color: 'var(--success)' }}>Template guardado!</div>
              </div>
            ) : (
              <>
                <div className="field">
                  <label>Nome do template *</label>
                  <input
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="Ex: Disfonia — Plano inicial 6 semanas"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && saveAsTemplate()}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowSaveTemplate(false); setTemplateName('') }}>Cancelar</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={!templateName.trim() || savingTemplate} onClick={saveAsTemplate}>
                    {savingTemplate ? <span className="spinner" /> : <><Icon name="star" size={15} /> Guardar</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: 20 }}>
        {/* Configuração + biblioteca */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">Configuração</div>
            <div className="field"><label>Título do plano *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Plano inicial 6 semanas" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field"><label>Semanas</label><input type="number" min={1} max={52} value={totalWeeks} onChange={e => setTotalWeeks(+e.target.value)} /></div>
              <div className="field"><label>Início</label><input type="date" value={startsOn} onChange={e => setStartsOn(e.target.value)} /></div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}><label>Notas para o utente</label><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instruções gerais" /></div>
          </div>

          <div className="card">
            <div className="section-title">Biblioteca — semana {selectedWeek}</div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {library.length === 0 && <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)' }}>Sem exercícios. Crie na Biblioteca.</p>}
              {library.map(ex => (
                <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: 'var(--hairline)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{ex.title}</div>
                    <span className="badge badge-blue">{ex.clinical_area}</span>
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '5px 8px' }} onClick={() => addExercise(ex)}>
                    <Icon name="plus" size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Semanas */}
        <div className="card">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
            {weeks.map(w => (
              <button key={w} className={`btn btn-sm ${selectedWeek === w ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSelectedWeek(w)}>
                S{w}
                {exercises.filter(e => e.week_number === w).length > 0 && (
                  <span style={{ fontSize: 10, marginLeft: 2, opacity: .75 }}>({exercises.filter(e => e.week_number === w).length})</span>
                )}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
            <div className="section-title" style={{ margin: 0 }}>Semana {selectedWeek}</div>
            {weekExercises.length > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  defaultValue=""
                  onChange={e => { if (e.target.value) { copyWeekTo(+e.target.value); e.target.value = '' } }}
                  style={{ width: 'auto', fontSize: 'var(--font-xs)', padding: '6px 10px' }}
                >
                  <option value="">Copiar semana para…</option>
                  {weeks.filter(w => w !== selectedWeek).map(w => <option key={w} value={w}>Semana {w}</option>)}
                </select>
                <select
                  defaultValue=""
                  onChange={e => {
                    const [from, to] = e.target.value.split('-').map(Number)
                    if (!isNaN(from) && !isNaN(to)) copyDay(from, to)
                    e.target.value = ''
                  }}
                  style={{ width: 'auto', fontSize: 'var(--font-xs)', padding: '6px 10px' }}
                >
                  <option value="">Copiar dia…</option>
                  {DAY_CHIPS.flatMap(({ d: from }) =>
                    DAY_CHIPS.filter(({ d: to }) => to !== from).map(({ d: to }) => (
                      <option key={`${from}-${to}`} value={`${from}-${to}`}>{DAY_NAMES[from]} → {DAY_NAMES[to]}</option>
                    ))
                  )}
                </select>
              </div>
            )}
          </div>

          {weekExercises.length === 0 && (
            <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)', padding: '12px 0' }}>
              Sem exercícios para esta semana. Adicione da biblioteca.
            </p>
          )}

          {weekExercises.map(d => (
            <div key={d.tempId} style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 10, border: 'var(--hairline)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>
                  {d.exercise?.title ?? <span style={{ color: 'var(--text-2)', fontStyle: 'italic' }}>Exercício removido da biblioteca</span>}
                </span>
                <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px' }} onClick={() => removeDraft(d.tempId)}>
                  <Icon name="close" size={14} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label>Séries</label>
                  <input type="number" min={1} value={d.sets} onChange={e => updateDraft(d.tempId, { sets: +e.target.value })} />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label>Reps</label>
                  <input type="number" min={1} value={d.reps ?? ''} onChange={e => updateDraft(d.tempId, { reps: e.target.value ? +e.target.value : null })} placeholder="—" />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label>Dur. (s)</label>
                  <input type="number" min={1} value={d.duration_seconds ?? ''} onChange={e => updateDraft(d.tempId, { duration_seconds: e.target.value ? +e.target.value : null })} placeholder="—" />
                </div>
              </div>
              {/* Dias da semana */}
              <div style={{ marginTop: 10 }}>
                <label style={{ marginBottom: 6 }}>Dias da semana</label>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                  {DAY_CHIPS.map(({ d: day, label }) => {
                    const active = d.day_of_week?.includes(day) ?? false
                    return (
                      <button key={day} type="button" onClick={() => toggleDay(d.tempId, day)} title={DAY_NAMES[day]} style={{
                        width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                        fontFamily: 'Poppins, sans-serif', fontSize: 12, fontWeight: 700,
                        border: '1.5px solid', borderColor: active ? 'var(--eira-ocean)' : 'var(--border)',
                        background: active ? 'var(--eira-ocean)' : 'var(--surface)',
                        color: active ? '#fff' : 'var(--text-2)',
                      }}>{label}</button>
                    )
                  })}
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginLeft: 6 }}>
                    {d.day_of_week?.length
                      ? d.day_of_week.slice().sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)).map(x => DAY_NAMES[x]).join(', ')
                      : 'Todos os dias'}
                  </span>
                </div>
              </div>

              <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
                <label>Nota para o utente</label>
                <input value={d.therapist_notes} onChange={e => updateDraft(d.tempId, { therapist_notes: e.target.value })} placeholder="Instrução específica" />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 0, cursor: 'pointer', fontWeight: 400, fontSize: 'var(--font-sm)', color: 'var(--text)' }}>
                <input type="checkbox" checked={d.allow_repeat} style={{ width: 16, height: 16 }}
                  onChange={e => updateDraft(d.tempId, { allow_repeat: e.target.checked })} />
                O utente pode repetir este exercício no mesmo dia
              </label>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
        <button className="btn btn-ghost" onClick={() => nav(`/patients/${patientId}`)}>Cancelar</button>
        <button className="btn btn-primary" disabled={saving} onClick={save}>
          {saving ? <span className="spinner" /> : <><Icon name="check" size={16} /> Guardar plano</>}
        </button>
      </div>

      {/* Responsivo mobile: stack columns */}
      <style>{`
        @media (max-width: 768px) {
          .plan-builder-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
