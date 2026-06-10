import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Linking,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'
import { getTheme } from '../../theme'
import { uiVariantForRole, hasRequiredConsents } from '../../../packages/types'
import type { UserRole, ConsentScope, ConsentInsert } from '../../../packages/types'

const POLICY_VERSION = process.env.EXPO_PUBLIC_POLICY_VERSION ?? '1.0'

interface ScopeDefinition {
  scope: ConsentScope
  label: string
  description: string
  required: boolean
}

const SCOPES: ScopeDefinition[] = [
  {
    scope: 'health_data_processing',
    label: 'Tratamento de dados de saúde',
    description:
      'Autorizo o tratamento dos meus dados de saúde para continuidade do plano de terapia da fala, '
      + 'nos termos da Política de Privacidade.',
    required: true,
  },
  {
    scope: 'video_recording',
    label: 'Gravação de vídeo/áudio',
    description:
      'Autorizo a gravação de vídeo e áudio no dispositivo para envio ao terapeuta. '
      + 'Os vídeos são eliminados após revisão.',
    required: false,
  },
  {
    scope: 'video_sharing_with_therapist',
    label: 'Partilha de vídeo com o terapeuta',
    description:
      'Autorizo o envio dos vídeos gravados ao meu terapeuta da fala para revisão humana.',
    required: false,
  },
  {
    scope: 'push_notifications',
    label: 'Notificações push',
    description: 'Autorizo o envio de lembretes e notificações sobre os meus exercícios.',
    required: false,
  },
]

export default function ConsentScreen() {
  const router = useRouter()
  const { role } = useLocalSearchParams<{ role: UserRole }>()
  const variant = uiVariantForRole(role ?? 'patient_adult')
  const theme = getTheme(variant)
  const s = styles(theme)

  const initialState = Object.fromEntries(
    SCOPES.map(d => [d.scope, d.required])
  ) as Record<ConsentScope, boolean>

  const [grants, setGrants] = useState<Record<ConsentScope, boolean>>(initialState)
  const [loading, setLoading] = useState(false)

  function toggle(scope: ConsentScope, required: boolean) {
    if (required) return // obrigatório não pode ser desmarcado
    setGrants(prev => ({ ...prev, [scope]: !prev[scope] }))
  }

  async function handleAccept() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão não encontrada.')

      // 1. Criar perfil
      const { error: profileError } = await supabase
        .schema('tf')
        .from('tf_users')
        .insert({
          id: user.id,
          role: role ?? 'patient_adult',
          ui_variant: variant,
          full_name: null,
        })
      if (profileError) throw profileError

      // 2. Registar consentimentos
      const consents: ConsentInsert[] = SCOPES.map(d => ({
        user_id: user.id,
        scope: d.scope,
        granted: grants[d.scope],
        policy_version: POLICY_VERSION,
      }))
      const { error: consentError } = await supabase
        .schema('tf')
        .from('consents')
        .insert(consents)
      if (consentError) throw consentError

      // 3. Audit log
      await logAudit({
        action: 'consent.granted',
        resource_type: 'consent',
        metadata: { scopes: grants, policy_version: POLICY_VERSION },
      })

      router.replace('/(auth)/link-therapist')
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível guardar o consentimento.')
    } finally {
      setLoading(false)
    }
  }

  const canContinue = grants['health_data_processing']

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.heading}>O teu consentimento</Text>
        <Text style={s.sub}>
          Os teus dados de saúde são protegidos pelo RGPD.{'\n'}
          Versão da política: {POLICY_VERSION}
        </Text>

        {SCOPES.map(d => {
          const granted = grants[d.scope]
          return (
            <TouchableOpacity
              key={d.scope}
              style={[s.row, d.required && s.rowRequired]}
              onPress={() => toggle(d.scope, d.required)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: granted, disabled: d.required }}
              accessibilityLabel={d.label}
              accessibilityHint={d.required ? 'Obrigatório' : undefined}
            >
              <View style={[s.checkbox, granted && s.checkboxOn, d.required && s.checkboxRequired]}>
                {granted && <Text style={s.checkmark}>✓</Text>}
              </View>
              <View style={s.rowText}>
                <View style={s.labelRow}>
                  <Text style={s.label}>{d.label}</Text>
                  {d.required && <Text style={s.tag}>Obrigatório</Text>}
                </View>
                <Text style={s.desc}>{d.description}</Text>
              </View>
            </TouchableOpacity>
          )
        })}

        <TouchableOpacity onPress={() => Linking.openURL('https://tf.hoplab.pt/privacidade')}>
          <Text style={s.link}>Ler a Política de Privacidade completa →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.btn, !canContinue && s.btnDisabled]}
          onPress={handleAccept}
          disabled={!canContinue || loading}
          accessibilityRole="button"
          accessibilityLabel="Aceitar e continuar"
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Aceitar e continuar</Text>
          }
        </TouchableOpacity>

        <Text style={s.footer}>
          Podes revogar o consentimento a qualquer momento em Definições → Privacidade.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function styles(t: ReturnType<typeof getTheme>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    scroll: { padding: 24, paddingBottom: 56 },
    heading: {
      fontSize: t.fontSizeHeading,
      fontWeight: '700',
      color: t.text,
      marginBottom: 8,
    },
    sub: {
      fontSize: t.fontSizeBody,
      color: t.textSecondary,
      marginBottom: 28,
      lineHeight: t.lineHeight,
    },
    row: {
      flexDirection: 'row',
      backgroundColor: t.surface,
      borderRadius: t.radius,
      borderWidth: 1.5,
      borderColor: t.border,
      padding: 16,
      marginBottom: 12,
      gap: 14,
    },
    rowRequired: { borderColor: t.primary + '55' },
    checkbox: {
      width: t.touchTarget * 0.6,
      height: t.touchTarget * 0.6,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
      flexShrink: 0,
    },
    checkboxOn: { backgroundColor: t.primary, borderColor: t.primary },
    checkboxRequired: { borderColor: t.primary },
    checkmark: { color: '#fff', fontWeight: '700', fontSize: 14 },
    rowText: { flex: 1 },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    label: {
      fontSize: t.fontSizeTitle,
      fontWeight: '600',
      color: t.text,
      flexShrink: 1,
    },
    tag: {
      fontSize: 11,
      fontWeight: '600',
      color: t.primary,
      backgroundColor: t.primary + '18',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    desc: {
      fontSize: t.fontSizeBody - 1,
      color: t.textSecondary,
      lineHeight: t.lineHeight - 2,
    },
    link: {
      fontSize: t.fontSizeBody,
      color: t.primary,
      marginBottom: 28,
      marginTop: 4,
    },
    btn: {
      backgroundColor: t.primary,
      borderRadius: t.radius,
      paddingVertical: 16,
      alignItems: 'center',
      minHeight: t.touchTarget,
    },
    btnDisabled: { opacity: 0.4 },
    btnText: {
      color: t.primaryText,
      fontSize: t.fontSizeTitle,
      fontWeight: '700',
    },
    footer: {
      fontSize: t.fontSizeBody - 2,
      color: t.textSecondary,
      textAlign: 'center',
      marginTop: 20,
      lineHeight: t.lineHeight - 4,
    },
  })
}
