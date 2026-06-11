import { useEffect, useState, useRef } from 'react'
import { supabase, tfFrom } from '../../lib/supabase'
import { useAuth } from '../../context/auth'
import { logAudit } from '../../lib/audit'
import { Icon } from '../../components/Icon'
import type { Message } from '@tf/types'

export function PatientMessagesPage() {
  const { profile, user } = useAuth()
  const [linkId, setLinkId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (profile?.id) load() }, [profile?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function load() {
    setLoading(true)
    const { data: link } = await tfFrom('therapist_patient_links')
      .select('id')
      .eq('patient_id', profile!.id)
      .eq('status', 'active')
      .single()

    if (!link) { setLoading(false); return }
    setLinkId(link.id)

    const { data } = await tfFrom('messages')
      .select('*')
      .eq('link_id', link.id)
      .order('created_at')
      .limit(100)
    setMessages(data ?? [])

    // Marcar como lidas
    const unread = (data ?? []).filter(m => m.recipient_id === user?.id && !m.read_at)
    if (unread.length) {
      await tfFrom('messages').update({ read_at: new Date().toISOString() }).in('id', unread.map(m => m.id))
    }

    // Realtime
    supabase.channel(`patient-msgs-${link.id}`)
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'tf_messages', filter: `link_id=eq.${link.id}` },
        async (p: any) => {
          setMessages(prev => [...prev, p.new as Message])
          if ((p.new as Message).recipient_id === user?.id) {
            await tfFrom('messages').update({ read_at: new Date().toISOString() }).eq('id', p.new.id)
          }
        })
      .subscribe()

    setLoading(false)
  }

  async function send() {
    if (!draft.trim() || !linkId || !user || !profile) return
    const body = draft.trim(); setDraft(''); setSending(true)

    // Encontrar o terapeuta
    const { data: link } = await tfFrom('therapist_patient_links')
      .select('therapist_id')
      .eq('id', linkId)
      .single()

    await tfFrom('messages').insert({
      sender_id: user.id,
      recipient_id: link?.therapist_id ?? '',
      link_id: linkId,
      body,
    })
    await logAudit('message.sent', 'messages', linkId)
    setSending(false)
  }

  if (loading) return <div className="empty-state"><span className="spinner" /></div>

  if (!linkId) return (
    <div className="card" style={{ textAlign: 'center', padding: 40 }}>
      <Icon name="chat" size={40} style={{ color: 'var(--eira-mist)', marginBottom: 12 }} />
      <p style={{ color: 'var(--text-2)' }}>Ainda não está ligado a um terapeuta.<br />Use um código de convite para se ligar.</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100svh - 210px)' }}>
      {/* 100svh = viewport sem chrome do browser; 210px = header(56) + padding(24) + título(44) + bottom-nav(80) + margem(6) */}
      <h1 className="page-title" style={{ marginBottom: 16 }}>Mensagens</h1>

      {/* Mensagens */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
        {messages.length === 0 && (
          <p style={{ color: 'var(--text-2)', textAlign: 'center', padding: 24 }}>Ainda sem mensagens. Envie a primeira!</p>
        )}
        {messages.map(m => {
          const mine = m.sender_id === user?.id
          return (
            <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              <div style={{
                background: mine ? 'var(--primary)' : 'var(--surface)',
                color: mine ? '#fff' : 'var(--text)',
                borderRadius: 'var(--radius)',
                borderBottomRightRadius: mine ? 4 : undefined,
                borderBottomLeftRadius: !mine ? 4 : undefined,
                padding: '10px 14px',
                border: mine ? 'none' : '1px solid var(--border)',
              }}>
                {m.body}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 3, textAlign: mine ? 'right' : 'left' }}>
                {new Date(m.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <textarea
          style={{ flex: 1, resize: 'none' }}
          rows={2}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Escreva uma mensagem…"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        />
        <button className="btn btn-primary" disabled={!draft.trim() || sending} onClick={send} style={{ alignSelf: 'flex-end' }}>
          {sending ? <span className="spinner" /> : <Icon name="send" size={16} />}
        </button>
      </div>
    </div>
  )
}
