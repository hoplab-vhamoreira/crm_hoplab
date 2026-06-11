import { useState, FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [showPass, setShowPass] = useState(false)

  async function signIn(e: FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message === 'Invalid login credentials'
      ? 'Email ou password incorrectos.'
      : error.message)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 380, padding: 36 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🌊</div>
          <h1 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, margin: 0, color: 'var(--eira-ink)' }}>Eira</h1>
          <p style={{ color: 'var(--eira-ocean)', fontSize: 'var(--font-xs)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500 }}>Cuidado sem distância</p>
        </div>

        <form onSubmit={signIn}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="o-teu@email.pt" required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input id="password" type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required style={{ paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPass(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', fontSize: 16, padding: 0, lineHeight: 1 }}>
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          {error && <p style={{ color: 'var(--error)', fontSize: 'var(--font-sm)', marginBottom: 12 }}>{error}</p>}
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading || !email || !password}>
            {loading ? <span className="spinner" /> : 'Entrar'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 20 }}>
          Utente novo? O acesso é feito através do link de convite enviado pelo seu terapeuta.
        </p>
      </div>
    </div>
  )
}
