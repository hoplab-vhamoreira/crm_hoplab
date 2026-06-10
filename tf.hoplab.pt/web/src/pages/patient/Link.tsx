/**
 * Onboarding — ligar ao terapeuta via código de convite.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tfFrom } from '../../lib/supabase'
import { useAuth } from '../../context/auth'

export function PatientLinkPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function link() {
    if (!code.trim() || !user) return
    setSaving(true); setError('')

    // Encontrar o link pendente com este código
    const { data: linkRow, error: findErr } = await tfFrom('therapist_patient_links')
      .select('id, therapist_id')
      .eq('invite_code', code.trim().toUpperCase())
      .eq('status', 'pending')
      .single()

    if (findErr || !linkRow) {
      setError('Código inválido ou já utilizado.')
      setSaving(false)
      return
    }

    // Aceitar convite
    const { error: updateErr } = await tfFrom('therapist_patient_links')
      .update({ patient_id: user.id, status: 'active', invite_code: null })
      .eq('id', linkRow.id)

    if (updateErr) { setError(updateErr.message); setSaving(false); return }

    nav('/patient')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 440, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔗</div>
          <h1 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, margin: 0 }}>Ligar ao terapeuta</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)', marginTop: 6 }}>
            Introduza o código que o seu terapeuta lhe enviou.
          </p>
        </div>

        <div className="field">
          <label>Código de convite</label>
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="ex: ABC123"
            style={{ textAlign: 'center', fontSize: 24, fontWeight: 700, letterSpacing: 6 }}
            autoFocus
            maxLength={8}
          />
        </div>

        {error && <p style={{ color: 'var(--error)', fontSize: 'var(--font-sm)', marginBottom: 12 }}>{error}</p>}

        <button
          className="btn btn-primary"
          style={{ width: '100%', marginBottom: 12 }}
          disabled={!code.trim() || saving}
          onClick={link}
        >
          {saving ? <span className="spinner" /> : 'Ligar'}
        </button>

        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => nav('/patient')}>
          Saltar por agora
        </button>
      </div>
    </div>
  )
}
