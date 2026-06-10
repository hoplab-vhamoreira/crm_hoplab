import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { getTheme } from '../../theme'
import type { UserRole, UIVariant } from '../../../packages/types'
import { uiVariantForRole } from '../../../packages/types'

interface RoleOption {
  role: UserRole
  label: string
  description: string
  emoji: string
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'patient_adult',
    label: 'Adulto',
    description: 'Faço os meus exercícios de forma autónoma',
    emoji: '🧑',
  },
  {
    role: 'patient_senior',
    label: 'Sénior',
    description: 'Preciso de letra grande e passos simples',
    emoji: '👴',
  },
  {
    role: 'parent',
    label: 'Pai / Mãe',
    description: 'Acompanho os exercícios de um filho',
    emoji: '👨‍👧',
  },
  {
    role: 'caregiver',
    label: 'Cuidador/a',
    description: 'Apoio um familiar nos exercícios',
    emoji: '🤝',
  },
]

export default function WelcomeScreen() {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Usa tema `calm` no welcome — mais acessível antes de sabermos o papel
  const theme = getTheme('calm')
  const s = styles(theme)

  async function handleContinue() {
    if (!selectedRole) return
    setLoading(true)
    try {
      // Autenticação anónima temporária — substituir por email/OTP na Fase 1
      const { error } = await supabase.auth.signInAnonymously()
      if (error) throw error

      // Guarda o papel escolhido no AsyncStorage para o ecrã de consentimento
      // (o perfil só fica no DB depois do consentimento)
      router.push({ pathname: '/(auth)/consent', params: { role: selectedRole } })
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível continuar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.heading}>Bem-vindo/a ao{'\n'}SpeechCraft</Text>
        <Text style={s.sub}>Quem vai usar a app?</Text>

        {ROLE_OPTIONS.map(opt => {
          const selected = selectedRole === opt.role
          return (
            <TouchableOpacity
              key={opt.role}
              style={[s.card, selected && s.cardSelected]}
              onPress={() => setSelectedRole(opt.role)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${opt.label}: ${opt.description}`}
            >
              <Text style={s.cardEmoji}>{opt.emoji}</Text>
              <View style={s.cardText}>
                <Text style={[s.cardLabel, selected && s.cardLabelSelected]}>{opt.label}</Text>
                <Text style={s.cardDesc}>{opt.description}</Text>
              </View>
              {selected && <Text style={s.check}>✓</Text>}
            </TouchableOpacity>
          )
        })}

        <TouchableOpacity
          style={[s.btn, !selectedRole && s.btnDisabled]}
          onPress={handleContinue}
          disabled={!selectedRole || loading}
          accessibilityRole="button"
          accessibilityLabel="Continuar para consentimento"
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Continuar</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function styles(t: ReturnType<typeof getTheme>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    scroll: { padding: 24, paddingBottom: 48 },
    heading: {
      fontSize: t.fontSizeHeading,
      fontWeight: '700',
      color: t.text,
      marginBottom: 8,
      lineHeight: t.fontSizeHeading * 1.25,
    },
    sub: {
      fontSize: t.fontSizeBody,
      color: t.textSecondary,
      marginBottom: 28,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.surface,
      borderRadius: t.radius,
      borderWidth: 2,
      borderColor: t.border,
      padding: 16,
      marginBottom: 12,
      minHeight: t.touchTarget,
    },
    cardSelected: { borderColor: t.primary },
    cardEmoji: { fontSize: 30, marginRight: 14 },
    cardText: { flex: 1 },
    cardLabel: {
      fontSize: t.fontSizeTitle,
      fontWeight: '600',
      color: t.text,
    },
    cardLabelSelected: { color: t.primary },
    cardDesc: {
      fontSize: t.fontSizeBody - 1,
      color: t.textSecondary,
      marginTop: 2,
    },
    check: { fontSize: 20, color: t.primary, fontWeight: '700' },
    btn: {
      backgroundColor: t.primary,
      borderRadius: t.radius,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 24,
      minHeight: t.touchTarget,
    },
    btnDisabled: { opacity: 0.4 },
    btnText: {
      color: t.primaryText,
      fontSize: t.fontSizeTitle,
      fontWeight: '700',
    },
  })
}
