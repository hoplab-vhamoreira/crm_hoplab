/**
 * Página de destino do link de convite por email.
 * O Supabase redirige para /join com o token na URL.
 * Após autenticação, mostra o fluxo de onboarding.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export function JoinPage() {
  const nav = useNavigate()
  const [status, setStatus] = useState<'loading' | 'set-password' | 'error'>('loading')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let resolved = false

    function resolve() {
      if (resolved) return
      resolved = true
      setStatus('set-password')
    }

    // Tratar todos os eventos possíveis:
    // - INITIAL_SESSION: dispara ao registar o listener (com sessão já activa)
    // - PASSWORD_RECOVERY / SIGNED_IN: dispara quando o hash é processado
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) resolve()
    })

    // Verificar imediatamente (caso o hash já tenha sido processado)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { resolve(); return }
      // Polling curto: dar tempo ao Supabase para processar o hash da URL
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        const { data: { session } } = await supabase.auth.getSession()
        if (session) { clearInterval(poll); resolve(); return }
        if (attempts >= 20) { // 10 segundos
          clearInterval(poll)
          if (!resolved) setStatus('error')
        }
      }, 500)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function setPasswordAndContinue() {
    if (password !== password2) { setError('As passwords não coincidem.'); return }
    if (password.length < 8) { setError('Mínimo 8 caracteres.'); return }
    setSaving(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setSaving(false); return }
    // Redirigir para onboarding do paciente
    nav('/patient/consent')
  }

  if (status === 'loading') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <span className="spinner" style={{ width: 40, height: 40 }} />
        <p style={{ color: 'var(--text-2)', marginTop: 16 }}>A validar o seu convite…</p>
      </div>
    </div>
  )

  if (status === 'error') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
      <div className="card" style={{ maxWidth: 400, textAlign: 'center', padding: 36 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <h2>Link inválido ou expirado</h2>
        <p style={{ color: 'var(--text-2)' }}>Peça ao seu terapeuta para enviar um novo convite.</p>
        <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => nav('/login')}>Ir para o login</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 36 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎙️</div>
          <h1 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, margin: 0 }}>Bem-vindo à Terapia da Fala</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 'var(--font-sm)', marginTop: 6 }}>
            Defina uma password para os próximos acessos.
          </p>
        </div>

        <div className="field">
          <label>Nova password</label>
          <div style={{ position: 'relative' }}>
            <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres" autoFocus style={{ paddingRight: 44 }} />
            <button type="button" onClick={() => setShowPwd(v => !v)}
              aria-label={showPwd ? 'Ocultar password' : 'Mostrar password'}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4, color: 'var(--text-2)' }}>
              {showPwd ? '🙈' : '👁️'}
            </button>
          </div>
        </div>
        <div className="field">
          <label>Confirmar password</label>
          <div style={{ position: 'relative' }}>
            <input type={showPwd ? 'text' : 'password'} value={password2} onChange={e => setPassword2(e.target.value)}
              placeholder="Repita a password" style={{ paddingRight: 44 }}
              onKeyDown={e => e.key === 'Enter' && setPasswordAndContinue()} />
            <button type="button" onClick={() => setShowPwd(v => !v)}
              aria-label={showPwd ? 'Ocultar password' : 'Mostrar password'}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4, color: 'var(--text-2)' }}>
              {showPwd ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        {error && <p style={{ color: 'var(--error)', fontSize: 'var(--font-sm)', marginBottom: 12 }}>{error}</p>}

        <button
          className="btn btn-primary" style={{ width: '100%' }}
          disabled={!password || !password2 || saving}
          onClick={setPasswordAndContinue}
        >
          {saving ? <span className="spinner" /> : 'Continuar →'}
        </button>
      </div>
    </div>
  )
}
