import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Monitor,
  Play,
  Image,
  Calendar,
  Cpu,
  Settings,
  LogOut,
  Sun,
  Moon,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'

const NAV_ITEMS = [
  { label: 'Displays', href: '/displays', icon: Monitor },
  { label: 'Playlists', href: '/playlists', icon: Play },
  { label: 'Media', href: '/media', icon: Image },
  { label: 'Schedules', href: '/schedules', icon: Calendar },
  { label: 'Provisioning', href: '/provisioning', icon: Cpu },
  { label: 'Settings', href: '/settings', icon: Settings },
]

function useTheme() {
  const [dark, setDark] = useState(() => {
    return document.documentElement.classList.contains('dark')
  })

  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('vant-theme', next ? 'dark' : 'light')
  }

  return { dark, toggle }
}

export default function DashboardShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, organization, logout } = useAuthStore()
  const { dark, toggle } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-dark-bg-1 text-gray-100 dark:bg-dark-bg-1 light:bg-light-bg">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-dark-bg-2 border-r border-white/5 transition-all duration-200 ${
          collapsed ? 'w-14' : 'w-56'
        }`}
      >
        {/* Logo / org name */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5 min-h-[56px]">
          <div className="flex-shrink-0 w-6 h-6 rounded bg-vant-orange flex items-center justify-center">
            <span className="text-white text-xs font-bold">V</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="text-[11px] text-gray-400 uppercase tracking-widest truncate">
                VANT Signage
              </span>
              <span className="text-[13px] font-semibold text-gray-100 truncate">
                {organization?.name ?? '—'}
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 px-1.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active =
              href === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(href)
            return (
              <Link
                key={href}
                to={href}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 px-2.5 py-2 rounded-md text-[13px] transition-colors ${
                  active
                    ? 'bg-gjs-blue/15 text-gjs-blue'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-100'
                }`}
              >
                <Icon size={16} className="flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="mx-1.5 mb-1 flex items-center justify-center py-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronRight
            size={14}
            className={`transition-transform ${collapsed ? '' : 'rotate-180'}`}
          />
        </button>

        {/* User / bottom actions */}
        <div className="border-t border-white/5 px-1.5 py-2 space-y-0.5">
          <button
            onClick={toggle}
            title="Toggle theme"
            className="w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-[13px] text-gray-400 hover:bg-white/5 hover:text-gray-100 transition-colors"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
            {!collapsed && <span>{dark ? 'Light mode' : 'Dark mode'}</span>}
          </button>
          <button
            onClick={handleLogout}
            title="Log out"
            className="w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-[13px] text-gray-400 hover:bg-white/5 hover:text-red-400 transition-colors"
          >
            <LogOut size={16} />
            {!collapsed && <span>Log out</span>}
          </button>
        </div>

        {/* User chip */}
        {!collapsed && user && (
          <div className="border-t border-white/5 px-3 py-2.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-vant-navy flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
              {user.name?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="overflow-hidden">
              <p className="text-[12px] font-medium text-gray-200 truncate">{user.name}</p>
              <p className="text-[11px] text-gray-500 truncate">{user.role}</p>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 h-14 bg-dark-bg-2 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2 text-[13px] text-gray-400">
            {/* Breadcrumb rendered by pages via portal or context if needed */}
          </div>
          <div className="flex items-center gap-3 text-[12px] text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-status-online inline-block" />
            API connected
          </div>
        </header>

        {/* Page outlet */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
