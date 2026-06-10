import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../lib/audit'
import { getTheme } from '../../theme'
import { useAuth } from '../../context/auth'
import { uiVariantForRole } from '../../../packages/types'

export default function LinkTherapistScreen() {
  const { profile } = useAuth()
  const variant = profile ? uiVariantForRole(profile.role) : 'focus'
  const theme = getTheme(variant)
  const s = styles(theme)
  const router = useRouter()

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLink() {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length < 6) {
      Alert.alert('Código inválido', 'Introduz o código que o teu terapeuta te deu.')
      return
    }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão não encontrada.')

      // Procura o convite pelo código
      const { data: link, error: findError } = await supabase
        .schema('tf')
        .from('therapist_patient_links')
        .select('id, therapist_id, status')
        .eq('invite_code', trimmed)
        .eq('status', 'pending')
        .single()

      if (findError || !link) {
        throw new Error('Código não encontrado ou já utilizado.')
      }

      // Activa a ligação
      const { error: updateError } = await supabase
        .schema('tf')
        .from('therapist_patient_links')
        .update({ patient_id: user.id, status: 'active', linked_at: new Date().toISOString() })
        .eq('id', link.id)

      if (updateError) throw updateError

      await logAudit({
        action: 'therapist_link.activated',
        resource_type: 'therapist_patient_links',
        resource_id: link.id,
      })

      router.replace('/(app)/')
    } catch (e: any) {
      Alert.alert('Erro', e.message ?? 'Não foi possível ligar ao terapeuta.')
    } finally {
      setLoading(false)
    }
  }

  function handleSkip() {
    router.replace('/(app)/')
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <Text style={s.heading}>Liga-te ao teu{'\n'}terapeuta</Text>
        <Text style={s.sub}>
          Pede ao teu terapeuta da fala o código de convite.
          Podes saltar este passo e ligar mais tarde.
        </Text>

        <TextInput
          style={s.input}
          placeholder="Ex: A3F9B2C1"
          placeholderTextColor={theme.textSecondary}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          accessibilityLabel="Código de convite do terapeuta"
        />

        <TouchableOpacity
          style={[s.btn, code.trim().length < 6 && s.btnDisabled]}
          onPress={handleLink}
          disabled={code.trim().length < 6 || loading}
          accessibilityRole="button"
          accessibilityLabel="Confirmar código"
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Confirmar código</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={s.skipBtn}
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel="Saltar, ligar mais tarde"
        >
          <Text style={s.skipText}>Saltar — ligar mais tarde</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

function styles(t: ReturnType<typeof getTheme>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    container: { flex: 1, padding: 24, justifyContent: 'center' },
    heading: {
      fontSize: t.fontSizeHeading,
      fontWeight: '700',
      color: t.text,
      marginBottom: 12,
      lineHeight: t.fontSizeHeading * 1.25,
    },
    sub: {
      fontSize: t.fontSizeBody,
      color: t.textSecondary,
      marginBottom: 32,
      lineHeight: t.lineHeight,
    },
    input: {
      backgroundColor: t.surface,
      borderRadius: t.radius,
      borderWidth: 1.5,
      borderColor: t.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: t.fontSizeTitle + 2,
      fontWeight: '600',
      color: t.text,
      letterSpacing: 3,
      marginBottom: 16,
      minHeight: t.touchTarget,
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
    skipBtn: {
      marginTop: 16,
      alignItems: 'center',
      minHeight: t.touchTarget,
      justifyContent: 'center',
    },
    skipText: {
      fontSize: t.fontSizeBody,
      color: t.textSecondary,
    },
  })
}
