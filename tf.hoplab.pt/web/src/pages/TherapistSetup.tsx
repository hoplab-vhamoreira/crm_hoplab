import { useState, FormEvent } from 'react'
import { tfFrom } from '../lib/supabase'
import { useAuth } from '../context/auth'

export function TherapistSetupPage() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [license, setLicense] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true); setError('')
    const { error } = await tfFrom('tf_users').insert({
      id: user!.id,
      role: 'therapist',
      ui_variant: 'focus',
      full_name: name.trim(),
      license_number: license.trim() || null,
    })
    if (error) { setError(error.message); setSaving(false) }
    // Sucesso → AuthProvider vai recarregar o perfil via onAuthStateChange
    // forçar reload
    else window.location.reload()
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="card" style={{ width: 400, padding: 36 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👨‍⚕️</div>
          <h1 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, margin: 0 }}>Configure o seu perfil</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)', marginTop: 4 }}>Primeiro acesso — só demora um momento.</p>
        </div>
        <form onSubmit={save}>
          <div className="field">
            <label>Nome completo *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Dr. João Silva" required autoFocus />
          </div>
          <div className="field">
            <label>Cédula profissional (ACSS)</label>
            <input value={license} onChange={e => setLicense(e.target.value)} placeholder="TF-XXXX (opcional)" />
          </div>
          {error && <p style={{ color: 'var(--error)', fontSize: 'var(--font-sm)', marginBottom: 12 }}>{error}</p>}
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={saving || !name.trim()}>
            {saving ? <span className="spinner" /> : 'Entrar no backoffice'}
          </button>
        </form>
      </div>
    </div>
  )
}
