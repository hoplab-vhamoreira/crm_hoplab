import { useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '../../context/auth'
import { uiVariantForRole, BADGE_DEFINITIONS } from '../../../packages/types'
import { getTheme } from '../../theme'
import { useTodayExercises } from '../../lib/useTodayExercises'
import { useStreak, recordSessionAndUpdateStreak } from '../../lib/useStreak'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'
import { BadgeToast } from '../../components/BadgeToast'
import type { TodayExerciseItem, SelfRating, BadgeDefinition } from '../../../packages/types'

const RATING_LABELS: Record<SelfRating, string> = {
  easy: 'Fácil 😊',
  medium: 'Médio 😐',
  hard: 'Difícil 😓',
}

export default function TodayScreen() {
  const { profile } = useAuth()
  const router = useRouter()
  const variant = profile ? uiVariantForRole(profile.role) : 'focus'
  const theme = getTheme(variant)
  const s = styles(theme)

  const { plan, items, loading, error, reload } = useTodayExercises(profile?.id ?? null)
  const { streak, reload: reloadStreak } = useStreak(profile?.id ?? null)
  const [newBadge, setNewBadge] = useState<BadgeDefinition | null>(null)

  const firstName = profile?.full_name?.split(' ')[0] ?? ''
  const done = items.filter(i => i.adherence?.completed).length
  const total = items.length

  async function markDone(item: TodayExerciseItem, rating: SelfRating) {
    const today = new Date().toISOString().slice(0, 10)
    const entry = {
      patient_id: profile!.id,
      plan_exercise_id: item.planExercise.id,
      session_date: today,
      completed: true,
      self_rating: rating,
    }

    const { error } = item.adherence
      ? await supabase.schema('tf').from('adherence_logs')
          .update({ completed: true, self_rating: rating })
          .eq('id', item.adherence.id)
      : await supabase.schema('tf').from('adherence_logs').insert(entry)

    if (error) { Alert.alert('Erro', error.message); return }

    await logAudit({
      action: 'adherence.marked_done',
      resource_type: 'adherence_logs',
      resource_id: item.planExercise.id,
      metadata: { rating },
    })

    // Actualiza streak e verifica medalhas novas
    const earned = await recordSessionAndUpdateStreak(profile!.id)
    if (earned.length > 0) {
      setNewBadge(earned[0])
    }

    reload()
    reloadStreak()
  }

  function promptRating(item: TodayExerciseItem) {
    Alert.alert(
      'Como correu?',
      'A tua opinião só é usada para ti.',
      ([
        { text: 'Fácil 😊',   onPress: () => markDone(item, 'easy') },
        { text: 'Médio 😐',   onPress: () => markDone(item, 'medium') },
        { text: 'Difícil 😓', onPress: () => markDone(item, 'hard') },
        { text: 'Cancelar', style: 'cancel' },
      ] as any[]),
    )
  }

  function renderItem({ item }: { item: TodayExerciseItem }) {
    const done = item.adherence?.completed ?? false
    return (
      <View style={[s.card, done && s.cardDone]}>
        <View style={s.cardHeader}>
          <View style={s.areaTag}>
            <Text style={s.areaText}>{item.exercise.clinical_area}</Text>
          </View>
          {done && item.adherence?.self_rating && (
            <Text style={s.ratingBadge}>{RATING_LABELS[item.adherence.self_rating]}</Text>
          )}
        </View>

        <Text style={[s.cardTitle, done && s.cardTitleDone]}>{item.exercise.title}</Text>

        <Text style={s.cardMeta}>
          {item.planExercise.sets} série{item.planExercise.sets > 1 ? 's' : ''}
          {item.planExercise.reps ? ` · ${item.planExercise.reps} reps` : ''}
          {item.exercise.duration_seconds
            ? ` · ${item.exercise.duration_seconds}s`
            : ''}
        </Text>

        {item.planExercise.therapist_notes && (
          <Text style={s.therapistNote}>💬 {item.planExercise.therapist_notes}</Text>
        )}

        <View style={s.cardActions}>
          {item.exercise.video_url && (
            <TouchableOpacity
              style={s.btnSecondary}
              onPress={() => router.push({
                pathname: '/(app)/exercise',
                params: { planExerciseId: item.planExercise.id },
              })}
              accessibilityLabel={`Ver vídeo: ${item.exercise.title}`}
            >
              <Text style={s.btnSecondaryText}>▶ Ver vídeo</Text>
            </TouchableOpacity>
          )}

          {!done && (
            <TouchableOpacity
              style={s.btnPrimary}
              onPress={() => promptRating(item)}
              accessibilityLabel={`Marcar ${item.exercise.title} como feito`}
            >
              <Text style={s.btnPrimaryText}>Feito ✓</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.loadingText}>A carregar…</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <BadgeToast
        badge={newBadge}
        variant={variant}
        onDone={() => setNewBadge(null)}
      />
      <FlatList
        data={items}
        keyExtractor={i => i.planExercise.id}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View style={s.header}>
            <Text style={s.greeting}>
              {firstName ? `Olá, ${firstName} 👋` : 'Olá 👋'}
            </Text>
            {streak && (streak.current_streak > 0 || streak.total_sessions > 0) && (
              <View style={s.streakRow}>
                <Text style={s.streakText}>🔥 {streak.current_streak} dias seguidos</Text>
                <Text style={s.streakText}>⭐ {streak.total_sessions} sessões</Text>
              </View>
            )}
            {plan && total > 0 && (
              <>
                <Text style={s.planTitle}>{plan.title}</Text>
                <Text style={s.planMeta}>
                  Semana {plan.current_week} de {plan.total_weeks}
                </Text>
                <View style={s.progressBar}>
                  <View style={[s.progressFill, { width: `${(done / total) * 100}%` as any }]} />
                </View>
                <Text style={s.progressLabel}>{done} / {total} exercícios hoje</Text>
              </>
            )}
            {!plan && (
              <Text style={s.emptyText}>
                O teu terapeuta ainda não definiu um plano.{'\n'}
                Assim que o plano estiver pronto, aparece aqui.
              </Text>
            )}
            {error && <Text style={s.errorText}>{error}</Text>}
          </View>
        }
        ListEmptyComponent={
          plan ? (
            <View style={s.center}>
              <Text style={s.emptyText}>Nenhum exercício para hoje. 🎉</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

function styles(t: ReturnType<typeof getTheme>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    list: { padding: 20, paddingBottom: 40 },
    header: { marginBottom: 24 },
    greeting: {
      fontSize: t.fontSizeHeading,
      fontWeight: '700',
      color: t.text,
      marginBottom: 4,
    },
    planTitle: {
      fontSize: t.fontSizeTitle,
      fontWeight: '600',
      color: t.text,
      marginTop: 12,
    },
    planMeta: {
      fontSize: t.fontSizeBody - 1,
      color: t.textSecondary,
      marginTop: 2,
      marginBottom: 10,
    },
    progressBar: {
      height: 8,
      backgroundColor: t.border,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 4,
    },
    progressFill: {
      height: 8,
      backgroundColor: t.success,
      borderRadius: 4,
    },
    progressLabel: {
      fontSize: t.fontSizeBody - 2,
      color: t.textSecondary,
    },
    card: {
      backgroundColor: t.surface,
      borderRadius: t.radius,
      borderWidth: 1.5,
      borderColor: t.border,
      padding: 16,
      marginBottom: 12,
    },
    cardDone: {
      borderColor: t.success + '66',
      backgroundColor: t.success + '08',
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    areaTag: {
      backgroundColor: t.primary + '18',
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    areaText: {
      fontSize: 11,
      fontWeight: '600',
      color: t.primary,
      textTransform: 'capitalize',
    },
    ratingBadge: {
      fontSize: 12,
      color: t.textSecondary,
    },
    cardTitle: {
      fontSize: t.fontSizeTitle,
      fontWeight: '600',
      color: t.text,
      marginBottom: 4,
    },
    cardTitleDone: {
      color: t.textSecondary,
      textDecorationLine: 'line-through',
    },
    cardMeta: {
      fontSize: t.fontSizeBody - 2,
      color: t.textSecondary,
      marginBottom: 6,
    },
    therapistNote: {
      fontSize: t.fontSizeBody - 1,
      color: t.textSecondary,
      fontStyle: 'italic',
      marginBottom: 10,
      lineHeight: t.lineHeight - 4,
    },
    cardActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    btnPrimary: {
      flex: 1,
      backgroundColor: t.primary,
      borderRadius: t.radius - 2,
      paddingVertical: 10,
      alignItems: 'center',
      minHeight: t.touchTarget,
      justifyContent: 'center',
    },
    btnPrimaryText: {
      color: t.primaryText,
      fontWeight: '700',
      fontSize: t.fontSizeBody,
    },
    btnSecondary: {
      flex: 1,
      backgroundColor: 'transparent',
      borderRadius: t.radius - 2,
      paddingVertical: 10,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: t.primary,
      minHeight: t.touchTarget,
      justifyContent: 'center',
    },
    btnSecondaryText: {
      color: t.primary,
      fontWeight: '600',
      fontSize: t.fontSizeBody,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    loadingText: { fontSize: t.fontSizeBody, color: t.textSecondary },
    emptyText: {
      fontSize: t.fontSizeBody,
      color: t.textSecondary,
      textAlign: 'center',
      lineHeight: t.lineHeight,
    },
    errorText: {
      fontSize: t.fontSizeBody - 1,
      color: t.error,
      marginTop: 8,
    },
    streakRow: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 16,
    },
    streakText: {
      fontSize: t.fontSizeBody - 1,
      fontWeight: '600',
      color: t.textSecondary,
    },
  })
}
