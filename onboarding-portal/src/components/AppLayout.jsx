import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ApartmentOutlined,
  DashboardOutlined,
  DownOutlined,
  HistoryOutlined,
  KeyOutlined,
  LogoutOutlined,
  MenuOutlined,
  SettingOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import Badge from '../ui/Badge.jsx'
import { cn } from '../ui/cn.js'
import { useAuth } from '../context/AuthContext.js'
import { USE_MOCKS } from '../utils/env.js'
import { CANDIDATE_ROLES, ROLE_LABELS } from '../utils/roles.js'
import { BrandBadge } from './BrandMark.jsx'
import NameAvatar from './NameAvatar.jsx'
import RoleSwitcher from './RoleSwitcher.jsx'
import SessionTimeout from './SessionTimeout.jsx'

// Sidebar links. "roles" lists who may see each link; no "roles" means everyone.
const MENU_ITEMS = [
  { key: '/admin', icon: <DashboardOutlined />, label: 'Dashboard', roles: ['SUPER_ADMIN'] },
  { key: '/candidates', icon: <TeamOutlined />, label: 'Candidates', roles: CANDIDATE_ROLES },
  { key: '/candidates/new', icon: <UserAddOutlined />, label: 'New candidate', roles: ['RECRUITER'] },
  { key: '/admin/users', icon: <SettingOutlined />, label: 'Users', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { key: '/admin/teams', icon: <ApartmentOutlined />, label: 'Teams', roles: ['SUPER_ADMIN', 'ADMIN', 'SALES_LEAD', 'SALES_MANAGER'] },
  { key: '/admin/audit', icon: <HistoryOutlined />, label: 'Audit log', roles: ['SUPER_ADMIN'] },
]

// The dark navigation panel, shared by the fixed desktop sidebar and the mobile drawer.
function Sidebar({ items, selectedKey, onNavigate }) {
  return (
    <div className="oi-sidebar flex h-full flex-col">
      {/* Brand lockup: a gradient atom badge + wordmark that reads cleanly on the dark panel */}
      <div className="mx-5 flex items-center gap-3 border-b border-white/[0.07] pb-5 pt-6">
        <BrandBadge size={40} />
        <div className="min-w-0">
          <div className="text-[16px] font-extrabold leading-none tracking-tight text-white">Intellectt</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Onboarding Portal</div>
        </div>
      </div>

      <div className="px-5 pb-2 pt-5">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Menu</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {items.map((item) => {
          const active = item.key === selectedKey
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={cn('oi-nav-link w-full text-left', active ? 'oi-nav-active' : 'oi-nav-idle')}
            >
              <span className="oi-nav-ico">{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-white/[0.07] px-5 py-4">
        <p className="text-[11px] text-slate-500">© {new Date().getFullYear()} One Intellectt</p>
      </div>
    </div>
  )
}

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const menuItems = MENU_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role))

  // Highlight the link that best matches the current URL (longest match wins, so
  // /candidates/new highlights "New candidate", not "Candidates").
  const selectedKey =
    menuItems
      .map((item) => item.key)
      .filter((key) => location.pathname.startsWith(key))
      .sort((a, b) => b.length - a.length)[0] ?? ''

  // Close the user menu when clicking elsewhere
  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Close the mobile drawer whenever the route changes
  useEffect(() => setDrawerOpen(false), [location.pathname])

  function go(key) {
    navigate(key)
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar: fixed column on large screens */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="fixed inset-y-0 left-0 w-64 shadow-[10px_0_40px_-20px_rgba(2,6,23,0.45)]">
          <Sidebar items={menuItems} selectedKey={selectedKey} onNavigate={go} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={() => setDrawerOpen(false)} />
          <div className="oi-pop absolute inset-y-0 left-0 w-64">
            <Sidebar items={menuItems} selectedKey={selectedKey} onNavigate={go} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white/75 px-4 py-2.5 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-ink transition-colors hover:border-brand hover:text-brand lg:hidden"
              aria-label="Open menu"
            >
              <MenuOutlined />
            </button>
            {/* Left side stays empty on normal pages; only the dev role switcher appears in mock mode */}
            {USE_MOCKS && (
              <div className="flex min-w-0 max-w-sm flex-1 items-center gap-2">
                <Badge tone="warning">MOCK</Badge>
                <RoleSwitcher />
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition-colors hover:bg-black/5"
            >
              <NameAvatar name={user.name} />
              <div className="hidden text-left leading-tight sm:block">
                <div className="text-sm font-semibold text-ink">{user.name}</div>
                <div className="text-xs text-muted">
                  {ROLE_LABELS[user.role]}
                  {user.teamName && ` · ${user.teamName}`}
                </div>
              </div>
              <DownOutlined className="text-[10px] text-faint" />
            </button>
            {menuOpen && (
              <div className="oi-pop absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-white shadow-xl">
                <div className="border-b border-line px-4 py-3">
                  <div className="font-semibold text-ink">{user.name}</div>
                  <div className="truncate text-xs text-muted">{user.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/change-password')
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink transition-colors hover:bg-slate-50"
                >
                  <KeyOutlined className="text-faint" />
                  Change password
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-danger transition-colors hover:bg-danger-soft"
                >
                  <LogoutOutlined />
                  Log out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto max-w-[1400px]">
            {/* key by route so each page eases in on navigation */}
            <div key={location.pathname} className="oi-page">
              <Outlet />
            </div>
            <SessionTimeout />
          </div>
        </main>

        <footer className="px-6 pb-6 pt-2 text-center text-[13px] text-faint">
          © {new Date().getFullYear()} One Intellectt · Candidate Onboarding Portal
        </footer>
      </div>
    </div>
  )
}
