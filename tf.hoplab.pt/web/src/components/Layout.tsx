import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth'

const NAV = [
  { to: '/',          label: 'Dashboard',    emoji: '🏠' },
  { to: '/patients',  label: 'Utentes',      emoji: '👥' },
  { to: '/reviews',   label: 'Revisões',     emoji: '📹' },
  { to: '/exercises', label: 'Biblioteca',   emoji: '📚' },
  { to: '/shortcuts', label: 'Atalhos',      emoji: '⚡' },
  { to: '/messages',  label: 'Mensagens',    emoji: '💬' },
  { to: '/compliance',label: 'Conformidade', emoji: '🔒' },
]

export function Layout() {
  const { profile, signOut } = useAuth()
  const nav = useNavigate()

  async function handleSignOut() {
    await signOut()
    nav('/login')
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        {/* Logo */}
        <div style={{ padding: '4px 12px 20px', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-lg)', color: 'var(--primary)' }}>SpeechTherapy</div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-2)', marginTop: 2 }}>Backoffice TF</div>
        </div>

        {/* Nav */}
        {NAV.map(({ to, label, emoji }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span>{emoji}</span>
            <span>{label}</span>
          </NavLink>
        ))}

        {/* Perfil */}
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <div style={{ padding: '8px 12px', fontSize: 'var(--font-sm)', color: 'var(--text-2)' }}>
            {profile?.full_name ?? 'Terapeuta'}
          </div>
          <button className="nav-item btn" style={{ width: '100%', background: 'none', color: 'var(--error)' }} onClick={handleSignOut}>
            <span>🚪</span><span>Sair</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
