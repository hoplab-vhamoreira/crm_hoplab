import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth'

export function PatientLayout() {
  const { profile, signOut } = useAuth()
  const nav = useNavigate()

  async function handleSignOut() {
    await signOut()
    nav('/login')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        height: 56, background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--font-lg)', color: 'var(--primary)' }}>
          SpeechTherapy
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-2)' }}>
            {profile?.full_name ?? 'Utente'}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>Sair</button>
        </div>
      </header>

      {/* Conteúdo */}
      <main style={{ flex: 1, maxWidth: 640, width: '100%', margin: '0 auto', padding: '24px 16px calc(80px + env(safe-area-inset-bottom))' }}>
        <Outlet />
      </main>

      {/* Nav bar inferior (mobile-first) */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--surface)', borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-around',
        padding: '8px 0 max(8px, env(safe-area-inset-bottom))',
        zIndex: 10,
      }}>
        {[
          { to: '/patient', label: 'Hoje', icon: '🏠', end: true },
          { to: '/patient/history', label: 'Histórico', icon: '📊' },
          { to: '/patient/messages', label: 'Mensagens', icon: '💬' },
        ].map(({ to, label, icon, end }) => (
          <NavLink
            key={to} to={to} end={end}
            style={({ isActive }) => ({
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              textDecoration: 'none', fontSize: 'var(--font-xs)',
              color: isActive ? 'var(--primary)' : 'var(--text-2)',
              fontWeight: isActive ? 700 : 400,
              minWidth: 64, padding: '4px 0',
            })}
          >
            <span style={{ fontSize: 20 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
