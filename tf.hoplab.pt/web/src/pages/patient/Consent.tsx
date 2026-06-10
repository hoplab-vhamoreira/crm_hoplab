/**
 * Onboarding — consentimento RGPD.
 * Recolhe consentimento granular antes de criar perfil de utente.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tfFrom, supabase } from '../../lib/supabase'
import { useAuth } from '../../context/auth'

const POLICY_VERSION = import.meta.env.VITE_POLICY_VERSION ?? '1.0'

const SCOPES = [
  { key: 'health_data_processing', label: 'Processamento de dados de saúde', required: true,
    desc: 'Necessário para guardar os seus exercícios e progresso terapêutico.' },
  { key: 'video_sharing_with_therapist', label: 'Partilha de vídeos com o terapeuta', required: true,
    desc: 'Os vídeos dos exercícios são partilhados com o seu terapeuta para revisão.' },
  { key: 'push_notifications', label: 'Notificações de lembretes', required: false,
    desc: 'Receber lembretes para fazer os exercícios diários.' },
]

export function PatientConsentPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [consents, setConsents] = useState<Record<string, boolean>>({
    health_data_processing: false,
    video_sharing_with_therapist: false,
    push_notifications: false,
  })
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const allRequired = SCOPES.filter(s => s.required).every(s => consents[s.key])

  async function save() {
    if (!allRequired || !name.trim() || !user) return
    setSaving(true); setError('')
    try {
      // Criar/actualizar perfil de forma idempotente.
      // (upsert/ON CONFLICT não funciona através de views PostgREST, por isso
      //  verificamos a existência e fazemos insert OU update — evita o erro
      //  "duplicate key" se o utente recarregar a página ou reabrir o link.)
      const { data: existing } = await tfFrom('tf_users')
        .select('id').eq('id', user.id).limit(1)
      const profileData = {
        role: 'patient_adult',
        ui_variant: 'focus',
        full_name: name.trim(),
      }
      const { error: profileErr } = existing && existing.length
        ? await tfFrom('tf_users').update(profileData).eq('id', user.id)
        : await tfFrom('tf_users').insert({ id: user.id, ...profileData })
      if (profileErr) throw profileErr

      // Registar consentimentos
      const rows = SCOPES.map(s => ({
        user_id: user.id,
        scope: s.key,
        granted: consents[s.key],
        policy_version: POLICY_VERSION,
      }))
      const { error: consentErr } = await tfFrom('consents').insert(rows)
      if (consentErr) throw consentErr

      // Auto-ligar ao terapeuta se houver convite pendente para este email
      const userEmail = user.email
      if (userEmail) {
        // Usar limit(1) em vez de maybeSingle() para evitar erro com múltiplos links pendentes
        const { data: pendingLinks } = await tfFrom('therapist_patient_links')
          .select('id')
          .eq('patient_email', userEmail)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
        const pendingLink = pendingLinks?.[0] ?? null

        if (pendingLink) {
          await tfFrom('therapist_patient_links')
            .update({ patient_id: user.id, status: 'active', invite_code: null })
            .eq('id', pendingLink.id)
          // Ligado automaticamente → vai directo para a app
          await supabase.auth.refreshSession()
          nav('/patient')
          return
        }
      }

      // Sem convite pendente → pedir código manualmente
      await supabase.auth.refreshSession()
      nav('/patient/link')
    } catch (e: any) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎙️</div>
          <h1 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, margin: 0 }}>Bem-vindo à Terapia da Fala</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)', marginTop: 6 }}>
            Antes de começar precisamos do seu consentimento — é rápido.
          </p>
        </div>

        <div className="field">
          <label>O seu nome *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" autoFocus />
        </div>

        <div style={{ marginBottom: 20 }}>
          {SCOPES.map(s => (
            <label key={s.key} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={consents[s.key]}
                onChange={e => setConsents(v => ({ ...v, [s.key]: e.target.checked }))}
                style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>
                  {s.label} {s.required && <span style={{ color: 'var(--error)' }}>*</span>}
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 2 }}>{s.desc}</div>
              </div>
            </label>
          ))}
        </div>

        <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginBottom: 16 }}>
          Pode revogar o consentimento a qualquer momento nas definições. Os dados são tratados ao abrigo do RGPD (UE) 2016/679.
        </p>

        {error && <p style={{ color: 'var(--error)', fontSize: 'var(--font-sm)', marginBottom: 12 }}>{error}</p>}

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          disabled={!allRequired || !name.trim() || saving}
          onClick={save}
        >
          {saving ? <span className="spinner" /> : 'Aceitar e continuar'}
        </button>
      </div>
    </div>
  )
}
