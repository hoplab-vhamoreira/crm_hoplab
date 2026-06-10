import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, SectionList, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { getTheme } from '../../theme'
import { useAuth } from '../../context/auth'
import { uiVariantForRole } from '../../../packages/types'
import type { TreatmentPlan, PlanExercise, Exercise } from '../../../packages/types'

interface WeekSection {
  title: string
  weekNumber: number
  data: (PlanExercise & { exercise: Exercise })[]
}

export default function PlanScreen() {
  const { profile } = useAuth()
  const variant = profile ? uiVariantForRole(profile.role) : 'focus'
  const theme = getTheme(variant)
  const s = styles(theme)

  const [plan, setPlan] = useState<TreatmentPlan | null>(null)
  const [sections, setSections] = useState<WeekSection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    load()
  }, [profile?.id])

  async function load() {
    setLoading(true)
    const { data: planData, error: planErr } = await supabase
      .schema('tf')
      .from('treatment_plans')
      .select('*')
      .eq('patient_id', profile!.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (planErr || !planData) { setLoading(false); return }
    setPlan(planData)

    const { data: pe, error: peErr } = await supabase
      .schema('tf')
      .from('plan_exercises')
      .select('*, exercise:exercises(*)')
      .eq('plan_id', planData.id)
      .order('week_number', { ascending: true })
      .order('sort_order', { ascending: true })

    if (peErr) { Alert.alert('Erro', peErr.message); setLoading(false); return }

    const byWeek = new Map<number, (PlanExercise & { exercise: Exercise })[]>()
    for (let w = 1; w <= planData.total_weeks; w++) byWeek.set(w, [])
    ;(pe ?? []).forEach(item => {
      const arr = byWeek.get(item.week_number) ?? []
      arr.push(item as any)
      byWeek.set(item.week_number, arr)
    })

    setSections(
      Array.from(byWeek.entries()).map(([w, data]) => ({
        title: `Semana ${w}${w === planData.current_week ? '  ◀ actual' : ''}`,
        weekNumber: w,
        data,
      }))
    )
    setLoading(false)
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><Text style={s.muted}>A carregar…</Text></View>
      </SafeAreaView>
    )
  }

  if (!plan) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.emptyTitle}>Sem plano activo</Text>
          <Text style={s.muted}>O teu terapeuta ainda não definiu um plano.</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View style={s.header}>
            <Text style={s.planTitle}>{plan.title}</Text>
            <Text style={s.planMeta}>
              {plan.total_weeks} semanas · começa em {plan.starts_on}
            </Text>
            {plan.notes && <Text style={s.planNotes}>{plan.notes}</Text>}
          </View>
        }
        renderSectionHeader={({ section }) => {
          const isCurrent = section.weekNumber === plan.current_week
          return (
            <View style={[s.weekHeader, isCurrent && s.weekHeaderCurrent]}>
              <Text style={[s.weekTitle, isCurrent && s.weekTitleCurrent]}>
                {section.title}
              </Text>
            </View>
          )
        }}
        renderItem={({ item }) => (
          <View style={s.exerciseRow}>
            <View style={s.areaTag}>
              <Text style={s.areaText}>{item.exercise.clinical_area}</Text>
            </View>
            <Text style={s.exerciseTitle}>{item.exercise.title}</Text>
            <Text style={s.exerciseMeta}>
              {item.sets} série{item.sets > 1 ? 's' : ''}
              {item.reps ? ` · ${item.reps} reps` : ''}
              {item.duration_seconds ? ` · ${item.duration_seconds}s` : ''}
            </Text>
            {item.therapist_notes && (
              <Text style={s.therapistNote}>💬 {item.therapist_notes}</Text>
            )}
          </View>
        )}
        SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
      />
    </SafeAreaView>
  )
}

function styles(t: ReturnType<typeof getTheme>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    list: { padding: 20, paddingBottom: 40 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    header: { marginBottom: 20 },
    planTitle: { fontSize: t.fontSizeHeading, fontWeight: '700', color: t.text, marginBottom: 4 },
    planMeta: { fontSize: t.fontSizeBody - 1, color: t.textSecondary, marginBottom: 8 },
    planNotes: {
      fontSize: t.fontSizeBody,
      color: t.text,
      backgroundColor: t.surface,
      borderRadius: t.radius,
      padding: 12,
      lineHeight: t.lineHeight,
      borderLeftWidth: 3,
      borderLeftColor: t.primary,
    },
    weekHeader: {
      paddingVertical: 8,
      paddingHorizontal: 4,
      marginTop: 12,
      marginBottom: 4,
    },
    weekHeaderCurrent: {
      backgroundColor: t.primary + '10',
      borderRadius: t.radius,
      paddingHorizontal: 10,
    },
    weekTitle: { fontSize: t.fontSizeBody, fontWeight: '700', color: t.textSecondary },
    weekTitleCurrent: { color: t.primary },
    exerciseRow: {
      backgroundColor: t.surface,
      borderRadius: t.radius,
      borderWidth: 1,
      borderColor: t.border,
      padding: 14,
      marginBottom: 8,
    },
    areaTag: {
      alignSelf: 'flex-start',
      backgroundColor: t.primary + '18',
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginBottom: 6,
    },
    areaText: { fontSize: 11, fontWeight: '600', color: t.primary, textTransform: 'capitalize' },
    exerciseTitle: { fontSize: t.fontSizeTitle, fontWeight: '600', color: t.text, marginBottom: 3 },
    exerciseMeta: { fontSize: t.fontSizeBody - 2, color: t.textSecondary },
    therapistNote: { fontSize: t.fontSizeBody - 1, color: t.textSecondary, fontStyle: 'italic', marginTop: 6 },
    emptyTitle: { fontSize: t.fontSizeTitle, fontWeight: '600', color: t.text, marginBottom: 8 },
    muted: { fontSize: t.fontSizeBody, color: t.textSecondary, textAlign: 'center' },
  })
}
