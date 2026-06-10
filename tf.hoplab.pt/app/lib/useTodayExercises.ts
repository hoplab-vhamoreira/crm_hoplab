import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import type { TodayExerciseItem, TreatmentPlan } from '../../packages/types'

interface State {
  plan: TreatmentPlan | null
  items: TodayExerciseItem[]
  loading: boolean
  error: string | null
}

export function useTodayExercises(patientId: string | null) {
  const [state, setState] = useState<State>({ plan: null, items: [], loading: true, error: null })

  const load = useCallback(async () => {
    if (!patientId) { setState(s => ({ ...s, loading: false })); return }
    setState(s => ({ ...s, loading: true, error: null }))

    try {
      // 1. Plano activo
      const { data: plan, error: planError } = await supabase
        .schema('tf')
        .from('treatment_plans')
        .select('*')
        .eq('patient_id', patientId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (planError || !plan) {
        setState({ plan: null, items: [], loading: false, error: null })
        return
      }

      // 2. Exercícios da semana actual
      const { data: planExercises, error: peError } = await supabase
        .schema('tf')
        .from('plan_exercises')
        .select('*, exercise:exercises(*)')
        .eq('plan_id', plan.id)
        .eq('week_number', plan.current_week)
        .order('sort_order', { ascending: true })

      if (peError) throw peError

      // 3. Registo de adesão de hoje
      const today = new Date().toISOString().slice(0, 10)
      const peIds = (planExercises ?? []).map(pe => pe.id)

      const { data: logs } = peIds.length
        ? await supabase
            .schema('tf')
            .from('adherence_logs')
            .select('*')
            .eq('patient_id', patientId)
            .eq('session_date', today)
            .in('plan_exercise_id', peIds)
        : { data: [] }

      const logMap = new Map((logs ?? []).map(l => [l.plan_exercise_id, l]))

      const items: TodayExerciseItem[] = (planExercises ?? []).map(pe => ({
        planExercise: pe,
        exercise: pe.exercise,
        adherence: logMap.get(pe.id) ?? null,
      }))

      setState({ plan, items, loading: false, error: null })
    } catch (e: any) {
      setState(s => ({ ...s, loading: false, error: e.message ?? 'Erro ao carregar exercícios.' }))
    }
  }, [patientId])

  useEffect(() => { load() }, [load])

  return { ...state, reload: load }
}
