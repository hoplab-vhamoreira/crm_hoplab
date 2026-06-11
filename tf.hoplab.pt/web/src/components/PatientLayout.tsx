import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { Icon } from './Icon'

const BASE = import.meta.env.BASE_URL

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
        height: 56, background: 'var(--surface)', borderBottom: 'var(--hairline)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <img
          src={`${BASE}eira-logo-horizontal-slogan.svg`}
          alt="Eira"
          style={{ height: 30, width: 'auto' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-2)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profile?.full_name ?? 'Utente'}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleSignOut}
            style={{ padding: '6px 8px' }}
            title="Sair"
          >
            <Icon name="sign-out" size={16} />
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <main style={{ flex: 1, maxWidth: 640, width: '100%', margin: '0 auto', padding: '24px 16px calc(80px + env(safe-area-inset-bottom))' }}>
        <Outlet />
      </main>

      {/* Nav bar inferior */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--surface)', borderTop: 'var(--hairline)',
        display: 'flex', justifyContent: 'space-around',
        padding: '8px 0 max(8px, env(safe-area-inset-bottom))',
        zIndex: 10,
      }}>
        {[
          { to: '/patient',          label: 'Hoje',      icon: 'home'  as const, end: true },
          { to: '/patient/history',  label: 'Histórico', icon: 'chart' as const },
          { to: '/patient/messages', label: 'Mensagens', icon: 'chat'  as const },
        ].map(({ to, label, icon, end }) => (
          <NavLink
            key={to} to={to} end={end}
            style={({ isActive }) => ({
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              textDecoration: 'none', fontSize: 'var(--font-xs)',
              color: isActive ? 'var(--eira-ocean)' : 'var(--text-2)',
              fontWeight: isActive ? 700 : 400,
              minWidth: 64, padding: '4px 0',
            })}
          >
            <Icon name={icon} size={22} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
