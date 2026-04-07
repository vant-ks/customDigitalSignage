import { useEffect, useState, useMemo } from 'react'
import { LayoutGrid, List, Search, Plus, Monitor } from 'lucide-react'
import { useDisplayStore } from '../stores/displayStore'
import type { Display } from '../types'

// ─── helpers ──────────────────────────────────────────────────────────────

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'Never'
  const s = Math.max(0, Date.now() - new Date(iso).getTime())
  const m = Math.floor(s / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const STATUS_CFG: Record<
  string,
  { label: string; dot: string; bg: string; text: string }
> = {
  online:  { label: 'Online',  dot: 'bg-status-online',   bg: 'bg-status-online/10',   text: 'text-status-online' },
  offline: { label: 'Offline', dot: 'bg-status-offline',  bg: 'bg-status-offline/10',  text: 'text-status-offline' },
  error:   { label: 'Error',   dot: 'bg-status-warning',  bg: 'bg-status-warning/10',   text: 'text-status-warning' },
  pending: { label: 'Pending', dot: 'bg-yellow-400',       bg: 'bg-yellow-400/10',       text: 'text-yellow-400' },
  syncing: { label: 'Syncing', dot: 'bg-status-syncing',  bg: 'bg-status-syncing/10',  text: 'text-status-syncing' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.offline
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === 'online' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  )
}

// ─── Display Card (grid view) ─────────────────────────────────────────────

function DisplayCard({ display }: { display: Display }) {
  const isPortrait = display.orientation === 'portrait'
  return (
    <div className="group rounded-xl bg-light-bg-2 dark:bg-dark-bg-2 border border-gray-200 dark:border-white/5 hover:border-gjs-blue/30 hover:shadow-lg transition-all overflow-hidden cursor-pointer">
      {/* Thumbnail area */}
      <div className="relative h-[110px] bg-gradient-to-br from-dark-bg-1 to-dark-bg-3 flex items-center justify-center overflow-hidden">
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#5eb7f1 1px, transparent 1px), linear-gradient(90deg, #5eb7f1 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        {/* Screen shape */}
        <div
          className={`border border-gray-300 dark:border-white/10 rounded ${display.status === 'online' ? 'bg-status-online/5' : ''}`}
          style={isPortrait ? { width: 36, height: 62 } : { width: 72, height: 42 }}
        />
        {/* Status badge */}
        <div className="absolute top-2.5 right-2.5">
          <StatusBadge status={display.status} />
        </div>
        {isPortrait && (
          <span className="absolute bottom-2 left-2.5 text-[10px] text-gjs-blue font-bold tracking-widest">
            PORTRAIT
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3.5">
        <div className="flex items-center gap-2">
          <Monitor size={14} className="text-gray-500 flex-shrink-0" />
          <span className="text-[14px] font-medium text-gray-900 dark:text-gray-100 truncate">{display.name}</span>
        </div>
        {display.location_name && (
          <p className="text-[12px] text-gray-500 mt-1 truncate">{display.location_name}</p>
        )}
        <div className="flex items-center gap-3 mt-2.5 text-[12px] text-gray-600">
          {display.resolution_w && display.resolution_h && (
            <span className="font-mono">{display.resolution_w}×{display.resolution_h}</span>
          )}
          {display.ip_address && (
            <span className="font-mono text-gray-700">{display.ip_address}</span>
          )}
          <span className="ml-auto">{timeAgo(display.last_heartbeat)}</span>
        </div>
        {display.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {display.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] font-semibold px-2 py-0.5 rounded bg-gjs-blue/10 text-gjs-blue"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Display Row (list view) ───────────────────────────────────────────────

function DisplayRow({ display }: { display: Display }) {
  return (
    <div className="flex items-center px-4 py-3 border-b border-gray-200 dark:border-white/5 hover:bg-light-bg-3 dark:hover:bg-light-bg-3 dark:hover:bg-dark-bg-3 cursor-pointer transition-colors">
      <div className="flex items-center gap-3 flex-[2.5]">
        <Monitor size={15} className="text-gray-600" />
        <div>
          <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{display.name}</p>
          {display.location_name && <p className="text-[12px] text-gray-500">{display.location_name}</p>}
        </div>
      </div>
      <div className="flex-1">
        <StatusBadge status={display.status} />
      </div>
      <div className="flex-1 text-[13px] text-gray-400">{display.hardware_type ?? '—'}</div>
      <div className="flex-1 text-[12px] font-mono text-gray-400">
        {display.resolution_w && display.resolution_h
          ? `${display.resolution_w}×${display.resolution_h}`
          : '—'}
      </div>
      <div className="flex-[0.8] text-[12px] text-gray-500 text-right">{timeAgo(display.last_heartbeat)}</div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { key: 'all', label: 'Total' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
  { key: 'error', label: 'Errors' },
  { key: 'pending', label: 'Pending' },
]

export default function DisplaysPage() {
  const { displays, groups, loading, error, fetchDisplays, fetchGroups, subscribeToWS } =
    useDisplayStore()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    fetchDisplays()
    fetchGroups()
    const unsubWS = subscribeToWS()
    return unsubWS
  }, [fetchDisplays, fetchGroups, subscribeToWS])

  const summary = useMemo(
    () => ({
      all: displays.length,
      online: displays.filter((d) => d.status === 'online').length,
      offline: displays.filter((d) => d.status === 'offline').length,
      error: displays.filter((d) => d.status === 'error').length,
      pending: displays.filter((d) => d.status === 'pending').length,
    }),
    [displays]
  )

  const filtered = useMemo(() => {
    return displays.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (groupFilter !== 'all' && d.group_id !== groupFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          d.name.toLowerCase().includes(q) ||
          d.location_name?.toLowerCase().includes(q) ||
          d.tags?.some((t) => t.toLowerCase().includes(q))
        )
      }
      return true
    })
  }, [displays, statusFilter, groupFilter, search])

  const summaryColor: Record<string, string> = {
    all: 'text-gjs-blue',
    online: 'text-status-online',
    offline: 'text-status-offline',
    error: 'text-status-warning',
    pending: 'text-yellow-400',
  }

  return (
    <div className="p-6">
      {/* Fleet summary cards */}
      <div className="flex flex-wrap gap-3 mb-6">
        {STATUS_FILTERS.map((sf) => (
          <button
            key={sf.key}
            onClick={() => setStatusFilter(sf.key)}
            className={`flex-1 min-w-[130px] px-4 py-4 rounded-xl bg-light-bg-2 dark:bg-dark-bg-2 border text-left transition-all ${
              statusFilter === sf.key
                ? 'border-gjs-blue/50 shadow-md'
                : 'border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-gray-300 dark:hover:border-white/10'
            }`}
          >
            <div className={`text-[30px] font-light leading-none ${summaryColor[sf.key]}`}>
              {summary[sf.key as keyof typeof summary]}
            </div>
            <div className="text-[12px] text-gray-400 mt-2 font-medium">{sf.label}</div>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-light-bg-3 dark:bg-dark-bg-3 border border-gray-200 dark:border-white/5 min-w-[220px]">
            <Search size={14} className="text-gray-600 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search displays…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-[13px] text-gray-900 dark:text-gray-100 placeholder-gray-600 outline-none w-full"
            />
          </div>
          {/* Group filter */}
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-light-bg-3 dark:bg-dark-bg-3 border border-gray-200 dark:border-white/5 text-[13px] text-gray-900 dark:text-gray-100 outline-none cursor-pointer"
          >
            <option value="all">All Groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-white/5">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center justify-center px-2.5 py-2 ${
                viewMode === 'grid'
                  ? 'bg-gjs-blue/15 text-gjs-blue'
                  : 'bg-light-bg-3 dark:bg-dark-bg-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center justify-center px-2.5 py-2 ${
                viewMode === 'list'
                  ? 'bg-gjs-blue/15 text-gjs-blue'
                  : 'bg-light-bg-3 dark:bg-dark-bg-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <List size={15} />
            </button>
          </div>

          {/* Add display */}
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-vant-navy to-gjs-blue text-white text-[13px] font-semibold hover:opacity-90 transition">
            <Plus size={14} />
            Add Display
          </button>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="text-center py-20 text-gray-500 text-[14px]">Loading displays…</div>
      )}
      {error && !loading && (
        <div className="text-center py-20 text-red-400 text-[14px]">{error}</div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-20">
          <Monitor size={48} className="mx-auto mb-4 text-gray-700" />
          <p className="text-[18px] text-gray-400">No displays match</p>
          <p className="text-[13px] text-gray-600 mt-2">Adjust your filters or add a new display</p>
        </div>
      )}

      {/* Grid view */}
      {!loading && !error && filtered.length > 0 && viewMode === 'grid' && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map((d) => (
            <DisplayCard key={d.id} display={d} />
          ))}
        </div>
      )}

      {/* List view */}
      {!loading && !error && filtered.length > 0 && viewMode === 'list' && (
        <div className="rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden">
          {/* Header */}
          <div className="flex px-4 py-2.5 bg-light-bg-3 dark:bg-dark-bg-3 border-b border-gray-200 dark:border-white/5 text-[11px] text-gray-500 font-semibold uppercase tracking-widest">
            <span className="flex-[2.5]">Display</span>
            <span className="flex-1">Status</span>
            <span className="flex-1">Hardware</span>
            <span className="flex-1">Resolution</span>
            <span className="flex-[0.8] text-right">Last Seen</span>
          </div>
          {filtered.map((d) => (
            <DisplayRow key={d.id} display={d} />
          ))}
        </div>
      )}
    </div>
  )
}
