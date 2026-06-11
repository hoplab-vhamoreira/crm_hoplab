import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { Icon } from './Icon'

const NAV = [
  { to: '/',          label: 'Painel',      icon: 'home'     },
  { to: '/patients',  label: 'Utentes',     icon: 'users'    },
  { to: '/reviews',   label: 'Revisões',    icon: 'video'    },
  { to: '/exercises', label: 'Biblioteca',  icon: 'book'     },
  { to: '/shortcuts', label: 'Atalhos',     icon: 'zap'      },
  { to: '/messages',  label: 'Mensagens',   icon: 'chat'     },
  { to: '/compliance',label: 'Conformidade',icon: 'lock'     },
] as const

const BASE = import.meta.env.BASE_URL

export function Layout() {
  const { profile, signOut } = useAuth()
  const nav = useNavigate()

  async function handleSignOut() {
    await signOut()
    nav('/login')
  }

  return (
    <div className="layout">
      {/* ── Sidebar (desktop) ──────────────────────────────────────── */}
      <aside className="sidebar">
        <div style={{ padding: '4px 12px 20px', borderBottom: '1px solid rgba(127,182,208,.2)', marginBottom: 12 }}>
          <img
            src={`${BASE}eira-logo-horizontal-slogan-dark.svg`}
            alt="Eira"
            style={{ height: 38, width: 'auto', display: 'block' }}
          />
        </div>

        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon name={icon as any} size={18} />
            <span>{label}</span>
          </NavLink>
        ))}

        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid rgba(127,182,208,.2)' }}>
          <div style={{ padding: '8px 12px', fontSize: 'var(--font-sm)', color: 'var(--eira-ocean-lt)' }}>
            {profile?.full_name ?? 'Terapeuta'}
          </div>
          <button
            className="nav-item btn"
            style={{ width: '100%', background: 'none', color: 'var(--eira-danger)' }}
            onClick={handleSignOut}
          >
            <Icon name="sign-out" size={18} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* ── Conteúdo ──────────────────────────────────────────────── */}
      <main className="main">
        <Outlet />
      </main>

      {/* ── Bottom nav (mobile only) ───────────────────────────────── */}
      <nav className="mobile-bottom-nav">
        {NAV.slice(0, 5).map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
          >
            <Icon name={icon as any} size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
