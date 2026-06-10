import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'
import { getTheme } from '../../theme'
import { useAuth } from '../../context/auth'
import { uiVariantForRole } from '../../../packages/types'
import type { PlanExercise, Exercise } from '../../../packages/types'

export default function ExerciseScreen() {
  const { planExerciseId } = useLocalSearchParams<{ planExerciseId: string }>()
  const { profile } = useAuth()
  const router = useRouter()
  const variant = profile ? uiVariantForRole(profile.role) : 'focus'
  const theme = getTheme(variant)
  const s = styles(theme)

  const [planExercise, setPlanExercise] = useState<PlanExercise | null>(null)
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!planExerciseId) return
    supabase.schema('tf')
      .from('plan_exercises')
      .select('*, exercise:exercises(*)')
      .eq('id', planExerciseId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setPlanExercise(data)
          setExercise(data.exercise ?? null)
          logAudit({
            action: 'exercise.viewed',
            resource_type: 'exercises',
            resource_id: data.exercise_id,
          })
        }
        setLoading(false)
      })
  }, [planExerciseId])

  if (loading || !exercise) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.muted}>A carregar…</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Cabeçalho */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Text style={s.backText}>← Voltar</Text>
        </TouchableOpacity>

        <View style={s.areaTag}>
          <Text style={s.areaText}>{exercise.clinical_area}</Text>
        </View>
        <Text style={s.title}>{exercise.title}</Text>

        {planExercise && (
          <Text style={s.meta}>
            {planExercise.sets} série{planExercise.sets > 1 ? 's' : ''}
            {planExercise.reps ? ` · ${planExercise.reps} reps` : ''}
            {exercise.duration_seconds ? ` · ${exercise.duration_seconds}s` : ''}
          </Text>
        )}

        {/* Vídeo de modelagem — o utilizador vê e imita; a app não avalia */}
        {exercise.video_url ? (
          <View style={s.videoPlaceholder}>
            {/* VideoView do expo-video (instalado na Fase 1) */}
            <Text style={s.videoPlaceholderText}>
              ▶ Vídeo de modelagem{'\n'}
              <Text style={s.muted}>(expo-video — instalar com: npx expo install expo-video)</Text>
            </Text>
          </View>
        ) : (
          <View style={s.videoPlaceholder}>
            <Text style={s.muted}>Sem vídeo de modelagem</Text>
          </View>
        )}

        {/* Instruções */}
        {exercise.instructions && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Como fazer</Text>
            <Text style={s.instructions}>{exercise.instructions}</Text>
          </View>
        )}

        {/* Nota do terapeuta */}
        {planExercise?.therapist_notes && (
          <View style={[s.section, s.noteSection]}>
            <Text style={s.sectionTitle}>Nota do terapeuta</Text>
            <Text style={s.instructions}>{planExercise.therapist_notes}</Text>
          </View>
        )}

        {/* Aviso de espelho — a app não avalia o vídeo */}
        <View style={s.mirrorNotice}>
          <Text style={s.mirrorText}>
            📷  Podes usar a câmara como espelho enquanto praticas.
            O vídeo não é avaliado automaticamente.
          </Text>
        </View>

        <TouchableOpacity
          style={s.btn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Pronto, voltar aos exercícios de hoje"
        >
          <Text style={s.btnText}>Pronto — marcar como feito</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function styles(t: ReturnType<typeof getTheme>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    scroll: { padding: 20, paddingBottom: 48 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    backBtn: { marginBottom: 16, minHeight: t.touchTarget, justifyContent: 'center' },
    backText: { fontSize: t.fontSizeBody, color: t.primary, fontWeight: '600' },
    areaTag: {
      alignSelf: 'flex-start',
      backgroundColor: t.primary + '18',
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginBottom: 8,
    },
    areaText: { fontSize: 12, fontWeight: '600', color: t.primary, textTransform: 'capitalize' },
    title: {
      fontSize: t.fontSizeHeading,
      fontWeight: '700',
      color: t.text,
      marginBottom: 6,
    },
    meta: {
      fontSize: t.fontSizeBody - 1,
      color: t.textSecondary,
      marginBottom: 20,
    },
    videoPlaceholder: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: '#000',
      borderRadius: t.radius,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    videoPlaceholderText: {
      color: '#fff',
      fontSize: t.fontSizeBody,
      textAlign: 'center',
      lineHeight: t.lineHeight,
    },
    section: { marginBottom: 20 },
    noteSection: {
      backgroundColor: t.primary + '0C',
      borderRadius: t.radius,
      padding: 14,
      borderLeftWidth: 3,
      borderLeftColor: t.primary,
    },
    sectionTitle: {
      fontSize: t.fontSizeBody - 1,
      fontWeight: '700',
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    instructions: {
      fontSize: t.fontSizeBody,
      color: t.text,
      lineHeight: t.lineHeight,
    },
    mirrorNotice: {
      backgroundColor: t.surface,
      borderRadius: t.radius,
      borderWidth: 1,
      borderColor: t.border,
      padding: 14,
      marginBottom: 24,
    },
    mirrorText: {
      fontSize: t.fontSizeBody - 1,
      color: t.textSecondary,
      lineHeight: t.lineHeight - 2,
    },
    btn: {
      backgroundColor: t.success,
      borderRadius: t.radius,
      paddingVertical: 16,
      alignItems: 'center',
      minHeight: t.touchTarget,
    },
    btnText: { color: '#fff', fontSize: t.fontSizeTitle, fontWeight: '700' },
    muted: { color: t.textSecondary, fontSize: t.fontSizeBody - 2, textAlign: 'center' },
  })
}
