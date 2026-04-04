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
  Activity,
  Bell,
  ClipboardList,
} from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useAlertStore } from '../../stores/alertStore'

const NAV_ITEMS = [
  { label: 'Monitoring', href: '/monitoring', icon: Activity },
  { label: 'Displays', href: '/displays', icon: Monitor },
  { label: 'Playlists', href: '/playlists', icon: Play },
  { label: 'Media', href: '/media', icon: Image },
  { label: 'Schedules', href: '/schedules', icon: Calendar },
  { label: 'Provisioning', href: '/provisioning', icon: Cpu },
  { label: 'Alerts', href: '/alerts', icon: Bell },
  { label: 'Audit Log', href: '/audit', icon: ClipboardList },
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

// ─── Notification Bell ────────────────────────────────────────────────────────

function NotificationBell() {
  const { unreadCount, notifications, fetchUnreadCount, fetchNotifications, markRead, markAllRead } =
    useAlertStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30_000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  useEffect(() => {
    if (open) fetchNotifications()
  }, [open, fetchNotifications])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-1.5 rounded-md text-gray-400 hover:text-gray-100 hover:bg-white/10 transition-colors"
        title="Notifications"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-80 rounded-xl bg-dark-bg-2 border border-white/10 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
            <span className="text-[13px] font-semibold text-gray-200">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] text-gjs-blue hover:text-gjs-blue/70"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-[13px] text-gray-600 text-center py-8">No notifications</p>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-2.5 px-4 py-2.5 border-b border-white/5 text-[12px] ${
                    n.is_read ? 'opacity-50' : ''
                  }`}
                >
                  <span
                    className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      n.severity === 'critical'
                        ? 'bg-red-400'
                        : n.severity === 'warning'
                          ? 'bg-yellow-400'
                          : 'bg-gjs-blue'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-200 truncate">{n.title}</p>
                    <p className="text-gray-600 text-[11px] mt-0.5">
                      {new Date(n.created_at).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="flex-shrink-0 p-0.5 text-gray-600 hover:text-gjs-blue"
                    >
                      ✓
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="px-4 py-2 border-t border-white/5">
            <Link
              to="/alerts"
              onClick={() => setOpen(false)}
              className="text-[12px] text-gjs-blue hover:text-gjs-blue/70"
            >
              View all →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
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
            <NotificationBell />
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
