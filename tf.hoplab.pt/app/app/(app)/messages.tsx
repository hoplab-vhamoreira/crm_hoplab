import { useEffect, useState, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../lib/supabase'
import { getTheme } from '../../theme'
import { useAuth } from '../../context/auth'
import { uiVariantForRole } from '../../../packages/types'
import { logAudit } from '../../lib/audit'
import type { Message, TherapistPatientLink } from '../../../packages/types'

export default function MessagesScreen() {
  const { profile, user } = useAuth()
  const variant = profile ? uiVariantForRole(profile.role) : 'focus'
  const theme = getTheme(variant)
  const s = styles(theme)

  const [link, setLink] = useState<TherapistPatientLink | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const flatRef = useRef<FlatList>(null)

  // Carrega link activo e mensagens
  useEffect(() => {
    if (!profile?.id) return
    loadLink()
  }, [profile?.id])

  async function loadLink() {
    const { data } = await supabase
      .schema('tf')
      .from('therapist_patient_links')
      .select('*')
      .eq('patient_id', profile!.id)
      .eq('status', 'active')
      .limit(1)
      .single()

    setLink(data ?? null)
    if (data) {
      await loadMessages(data.id)
      subscribeToMessages(data.id)
    } else {
      setLoading(false)
    }
  }

  async function loadMessages(linkId: string) {
    const { data } = await supabase
      .schema('tf')
      .from('messages')
      .select('*')
      .eq('link_id', linkId)
      .order('created_at', { ascending: true })
      .limit(100)

    setMessages(data ?? [])
    setLoading(false)
    markRead(data ?? [])
  }

  async function markRead(msgs: Message[]) {
    const unread = msgs.filter(m => m.recipient_id === user?.id && !m.read_at)
    if (!unread.length) return
    await supabase
      .schema('tf')
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unread.map(m => m.id))
  }

  function subscribeToMessages(linkId: string) {
    supabase
      .channel(`tf-messages-${linkId}`)
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'tf', table: 'messages', filter: `link_id=eq.${linkId}` },
        (payload: any) => {
          setMessages(prev => [...prev, payload.new as Message])
          if ((payload.new as Message).recipient_id === user?.id) {
            supabase.schema('tf').from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', payload.new.id)
          }
        }
      )
      .subscribe()
  }

  async function send() {
    if (!draft.trim() || !link || !profile) return
    const body = draft.trim()
    setDraft('')
    setSending(true)

    const recipientId = profile.role === 'therapist'
      ? link.patient_id!
      : link.therapist_id

    const { error } = await supabase.schema('tf').from('messages').insert({
      sender_id: user!.id,
      recipient_id: recipientId,
      link_id: link.id,
      body,
    })

    if (!error) {
      await logAudit({ action: 'message.sent', resource_type: 'messages', resource_id: link.id })
    }
    setSending(false)
  }

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages.length])

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={theme.primary} /></View>
      </SafeAreaView>
    )
  }

  if (!link) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.emptyTitle}>Sem terapeuta ligado</Text>
          <Text style={s.muted}>Usa o código de convite do teu terapeuta para te ligares.</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={88}
      >
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={s.messageList}
          renderItem={({ item }) => {
            const isMine = item.sender_id === user?.id
            return (
              <View style={[s.bubble, isMine ? s.bubbleMine : s.bubbleOther]}>
                <Text style={[s.bubbleText, isMine ? s.bubbleTextMine : s.bubbleTextOther]}>
                  {item.body}
                </Text>
                <Text style={[s.bubbleTime, isMine && s.bubbleTimeMine]}>
                  {formatTime(item.created_at)}
                </Text>
              </View>
            )
          }}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.muted}>Nenhuma mensagem ainda.{'\n'}Envia uma dúvida ao teu terapeuta.</Text>
            </View>
          }
        />

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Escreve uma mensagem…"
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={1000}
            accessibilityLabel="Mensagem para o terapeuta"
          />
          <TouchableOpacity
            style={[s.sendBtn, (!draft.trim() || sending) && s.sendBtnDisabled]}
            onPress={send}
            disabled={!draft.trim() || sending}
            accessibilityLabel="Enviar mensagem"
            accessibilityRole="button"
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.sendBtnText}>↑</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

function styles(t: ReturnType<typeof getTheme>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    messageList: { padding: 16, paddingBottom: 8 },
    bubble: {
      maxWidth: '80%',
      borderRadius: t.radius,
      padding: 12,
      marginBottom: 8,
    },
    bubbleMine: {
      backgroundColor: t.primary,
      alignSelf: 'flex-end',
      borderBottomRightRadius: 4,
    },
    bubbleOther: {
      backgroundColor: t.surface,
      alignSelf: 'flex-start',
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: t.border,
    },
    bubbleText: { fontSize: t.fontSizeBody, lineHeight: t.lineHeight },
    bubbleTextMine: { color: '#fff' },
    bubbleTextOther: { color: t.text },
    bubbleTime: { fontSize: 10, color: t.textSecondary, marginTop: 4, textAlign: 'right' },
    bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: 12,
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: t.border,
      backgroundColor: t.surface,
    },
    input: {
      flex: 1,
      backgroundColor: t.background,
      borderRadius: t.radius,
      borderWidth: 1.5,
      borderColor: t.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: t.fontSizeBody,
      color: t.text,
      maxHeight: 100,
      minHeight: t.touchTarget,
    },
    sendBtn: {
      width: t.touchTarget,
      height: t.touchTarget,
      borderRadius: t.touchTarget / 2,
      backgroundColor: t.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.4 },
    sendBtnText: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 24 },
    emptyTitle: { fontSize: t.fontSizeTitle, fontWeight: '600', color: t.text, marginBottom: 8 },
    muted: { fontSize: t.fontSizeBody, color: t.textSecondary, textAlign: 'center', lineHeight: t.lineHeight },
  })
}
