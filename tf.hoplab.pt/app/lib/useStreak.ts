import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { BADGE_DEFINITIONS } from '../../packages/types'
import type { Streak, Badge } from '../../packages/types'

interface StreakState {
  streak: Streak | null
  badges: Badge[]
  loading: boolean
}

export function useStreak(patientId: string | null) {
  const [state, setState] = useState<StreakState>({ streak: null, badges: [], loading: true })

  const load = useCallback(async () => {
    if (!patientId) { setState(s => ({ ...s, loading: false })); return }

    const [streakRes, badgesRes] = await Promise.all([
      supabase.schema('tf').from('streaks').select('*').eq('patient_id', patientId).single(),
      supabase.schema('tf').from('badges').select('*').eq('patient_id', patientId).order('earned_at', { ascending: false }),
    ])

    setState({
      streak: streakRes.data ?? null,
      badges: badgesRes.data ?? [],
      loading: false,
    })
  }, [patientId])

  useEffect(() => { load() }, [load])

  return { ...state, reload: load }
}

/** Chama após marcar exercício feito: actualiza streak + atribui medalhas novas */
export async function recordSessionAndUpdateStreak(patientId: string) {
  // 1. Actualiza streak via função SQL
  await supabase.rpc('update_streak', { p_patient_id: patientId }, { schema: 'tf' } as any)

  // 2. Lê estado actual
  const { data: streak } = await supabase
    .schema('tf').from('streaks').select('*').eq('patient_id', patientId).single()
  if (!streak) return []

  // 3. Verifica medalhas por desbloquear
  const { data: existing } = await supabase
    .schema('tf').from('badges').select('badge_key').eq('patient_id', patientId)
  const earnedKeys = new Set((existing ?? []).map(b => b.badge_key))

  const newBadges = BADGE_DEFINITIONS.filter(def => {
    if (earnedKeys.has(def.key)) return false
    const val = def.type === 'streak' ? streak.current_streak : streak.total_sessions
    return val >= def.threshold
  })

  if (newBadges.length > 0) {
    await supabase.schema('tf').from('badges').insert(
      newBadges.map(b => ({ patient_id: patientId, badge_key: b.key }))
    )
  }

  return newBadges
}
