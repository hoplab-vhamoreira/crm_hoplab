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
        <div style={{ padding: '4px 12px 20px', borderBottom: '1px solid rgba(127,182,208,.2)', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--font-lg)', color: 'var(--eira-paper)' }}>Eira</div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--eira-ocean-lt)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cuidado sem distância</div>
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
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid rgba(127,182,208,.2)' }}>
          <div style={{ padding: '8px 12px', fontSize: 'var(--font-sm)', color: 'var(--eira-ocean-lt)' }}>
            {profile?.full_name ?? 'Terapeuta'}
          </div>
          <button className="nav-item btn" style={{ width: '100%', background: 'none', color: 'var(--eira-danger)' }} onClick={handleSignOut}>
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
