import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { tfFrom } from '../lib/supabase'
import { useAuth } from '../context/auth'
import { logAudit } from '../lib/audit'
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
}

export function PlanBuilderPage() {
  const { patientId, planId } = useParams<{ patientId: string; planId?: string }>()
  const { profile } = useAuth()
  const nav = useNavigate()

  const [title, setTitle] = useState('')
  const [totalWeeks, setTotalWeeks] = useState(6)
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [exercises, setExercises] = useState<DraftExercise[]>([])
  const [library, setLibrary] = useState<Exercise[]>([])
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile?.id) init() }, [profile?.id])

  async function init() {
    const { data: lib } = await tfFrom('exercises').select('*').eq('therapist_id', profile!.id)
    setLibrary(lib ?? [])

    if (planId) {
      const { data: plan } = await tfFrom('treatment_plans').select('*').eq('id', planId).single()
      if (plan) {
        setTitle(plan.title); setTotalWeeks(plan.total_weeks)
        setStartsOn(plan.starts_on); setNotes(plan.notes ?? '')
      }
      const { data: pe } = await tfFrom('plan_exercises').select('*, exercise:exercises(*)').eq('plan_id', planId).order('week_number').order('sort_order')
      setExercises((pe ?? []).map((p, i) => ({
        tempId: p.id, exercise_id: p.exercise_id, exercise: (p as any).exercise,
        week_number: p.week_number, sets: p.sets, reps: p.reps,
        duration_seconds: p.duration_seconds, therapist_notes: p.therapist_notes ?? '', sort_order: i,
      })))
    }
    setLoading(false)
  }

  function addExercise(ex: Exercise) {
    setExercises(prev => [...prev, {
      tempId: crypto.randomUUID(), exercise_id: ex.id, exercise: ex,
      week_number: selectedWeek, sets: 3, reps: null,
      duration_seconds: ex.duration_seconds, therapist_notes: '', sort_order: prev.length,
    }])
  }

  function updateDraft(tempId: string, patch: Partial<DraftExercise>) {
    setExercises(prev => prev.map(d => d.tempId === tempId ? { ...d, ...patch } : d))
  }

  function removeDraft(tempId: string) {
    setExercises(prev => prev.filter(d => d.tempId !== tempId))
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
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => nav(`/patients/${patientId}`)}>← Utente</button>
      <h1 className="page-title">{planId ? 'Editar plano' : 'Novo plano'}</h1>
      <p className="page-sub">Defina semanas e exercícios. O utente vê apenas o plano publicado.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        {/* Configuração */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">Configuração</div>
            <div className="field"><label>Título do plano *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Plano inicial 6 semanas" /></div>
            <div className="field"><label>Nº de semanas</label><input type="number" min={1} max={52} value={totalWeeks} onChange={e => setTotalWeeks(+e.target.value)} /></div>
            <div className="field"><label>Início</label><input type="date" value={startsOn} onChange={e => setStartsOn(e.target.value)} /></div>
            <div className="field"><label>Notas para o utente</label><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instruções gerais (não é avaliação clínica)" /></div>
          </div>

          {/* Biblioteca */}
          <div className="card">
            <div className="section-title">Biblioteca — adicionar à semana {selectedWeek}</div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {library.length === 0 && <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)' }}>Sem exercícios. Crie primeiro na Biblioteca.</p>}
              {library.map(ex => (
                <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{ex.title}</div>
                    <span className="badge badge-blue">{ex.clinical_area}</span>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => addExercise(ex)}>+</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Semanas */}
        <div className="card">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {weeks.map(w => (
              <button key={w} className={`btn btn-sm ${selectedWeek === w ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSelectedWeek(w)}>
                S{w} <span style={{ fontSize: 10, marginLeft: 2 }}>({exercises.filter(e => e.week_number === w).length})</span>
              </button>
            ))}
          </div>

          <div className="section-title">Semana {selectedWeek}</div>

          {weekExercises.length === 0 && <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)' }}>Sem exercícios para esta semana. Adicione da biblioteca →</p>}

          {weekExercises.map(d => (
            <div key={d.tempId} style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 10, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{d.exercise?.title}</span>
                <button className="btn btn-danger btn-sm" onClick={() => removeDraft(d.tempId)}>✕</button>
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
              <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
                <label>Nota para o utente</label>
                <input value={d.therapist_notes} onChange={e => updateDraft(d.tempId, { therapist_notes: e.target.value })} placeholder="Instrução específica (não é feedback clínico)" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
        <button className="btn btn-ghost" onClick={() => nav(`/patients/${patientId}`)}>Cancelar</button>
        <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? <span className="spinner" /> : 'Guardar plano'}</button>
      </div>
    </div>
  )
}
