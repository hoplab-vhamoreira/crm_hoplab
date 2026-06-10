import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, tfFrom } from '../lib/supabase'
import { useAuth } from '../context/auth'
import { logAudit } from '../lib/audit'
import type { Message, TherapistPatientLink, TfUser } from '@tf/types'

interface Conversation {
  link: TherapistPatientLink
  patient: TfUser
  unreadCount: number
}

export function MessagesPage() {
  const { patientId } = useParams<{ patientId?: string }>()
  const { profile, user } = useAuth()
  const nav = useNavigate()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeLink, setActiveLink] = useState<TherapistPatientLink | null>(null)
  const [activePatient, setActivePatient] = useState<TfUser | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (profile?.id) loadConversations() }, [profile?.id])

  useEffect(() => {
    if (patientId && conversations.length > 0) {
      const conv = conversations.find(c => c.patient.id === patientId)
      if (conv) openConversation(conv)
    }
  }, [patientId, conversations.length])

  async function loadConversations() {
    setLoading(true)
    const { data: links } = await tfFrom('therapist_patient_links')
      .select('*, patient:patient_id(id, full_name, role, ui_variant, created_at, updated_at, license_number, guardian_id)')
      .eq('therapist_id', profile!.id)
      .eq('status', 'active')

    const convs: Conversation[] = await Promise.all((links ?? []).map(async l => {
      const { count } = await tfFrom('messages')
        .select('id', { count: 'exact', head: true })
        .eq('link_id', l.id)
        .eq('recipient_id', user!.id)
        .is('read_at', null)
      return { link: l as TherapistPatientLink, patient: (l as any).patient as TfUser, unreadCount: count ?? 0 }
    }))

    setConversations(convs)
    setLoading(false)
  }

  async function openConversation(conv: Conversation) {
    setActiveLink(conv.link); setActivePatient(conv.patient)
    const { data } = await tfFrom('messages').select('*').eq('link_id', conv.link.id).order('created_at').limit(100)
    setMessages(data ?? [])

    // Marca como lidas
    const unread = (data ?? []).filter(m => m.recipient_id === user?.id && !m.read_at)
    if (unread.length) {
      await tfFrom('messages').update({ read_at: new Date().toISOString() }).in('id', unread.map(m => m.id))
      loadConversations()
    }

    // Subscrição realtime
    supabase.channel(`web-msgs-${conv.link.id}`)
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'tf', table: 'messages', filter: `link_id=eq.${conv.link.id}` },
        async (p: any) => {
          setMessages(prev => [...prev, p.new as Message])
          if ((p.new as Message).recipient_id === user?.id) {
            await tfFrom('messages').update({ read_at: new Date().toISOString() }).eq('id', p.new.id)
          }
        })
      .subscribe()
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function send() {
    if (!draft.trim() || !activeLink || !activePatient) return
    const body = draft.trim(); setDraft(''); setSending(true)
    await tfFrom('messages').insert({ sender_id: user!.id, recipient_id: activePatient.id, link_id: activeLink.id, body })
    await logAudit('message.sent', 'messages', activeLink.id)
    setSending(false)
  }

  if (loading) return <div className="empty-state"><span className="spinner" /></div>

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', gap: 0 }}>
      {/* Lista de conversas */}
      <div style={{ width: 260, borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 'var(--font-lg)' }}>Mensagens</div>
        {conversations.length === 0 && <p className="empty-state">Sem utentes ligados.</p>}
        {conversations.map(c => (
          <div
            key={c.link.id}
            onClick={() => { nav(`/messages/${c.patient.id}`); openConversation(c) }}
            style={{
              padding: '14px 20px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
              background: activePatient?.id === c.patient.id ? 'var(--primary-lt)' : 'transparent',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <div style={{ fontWeight: 600 }}>{c.patient.full_name ?? 'Utente'}</div>
            {c.unreadCount > 0 && (
              <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: 10, fontSize: 11, fontWeight: 700, padding: '2px 7px' }}>{c.unreadCount}</span>
            )}
          </div>
        ))}
      </div>

      {/* Conversa */}
      {activePatient ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>
            {activePatient.full_name ?? 'Utente'}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map(m => {
              const mine = m.sender_id === user?.id
              return (
                <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                  <div style={{
                    background: mine ? 'var(--primary)' : 'var(--surface)',
                    color: mine ? '#fff' : 'var(--text)',
                    borderRadius: 'var(--radius)',
                    borderBottomRightRadius: mine ? 4 : undefined,
                    borderBottomLeftRadius: !mine ? 4 : undefined,
                    padding: '10px 14px',
                    border: mine ? 'none' : '1px solid var(--border)',
                    fontSize: 'var(--font-md)',
                  }}>
                    {m.body}
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 3, textAlign: mine ? 'right' : 'left' }}>
                    {new Date(m.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    {mine && m.read_at && ' · lido'}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
          <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 10, background: 'var(--surface)' }}>
            <textarea
              style={{ flex: 1, resize: 'none', maxHeight: 100 }}
              rows={2}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Escreva uma mensagem… (sem respostas clínicas automáticas)"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            />
            <button className="btn btn-primary" disabled={!draft.trim() || sending} onClick={send} style={{ alignSelf: 'flex-end' }}>
              {sending ? <span className="spinner" /> : '↑ Enviar'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
          Seleccione uma conversa.
        </div>
      )}
    </div>
  )
}
