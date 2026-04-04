import { useEffect, useState } from 'react'
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Monitor,
  RefreshCw,
  Thermometer,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useMonitoringStore, type TelemetryPeriod } from '../stores/monitoringStore'
import type { Display, TelemetryDataPoint } from '../types'

// ─── helpers ──────────────────────────────────────────────────────────────────

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

function fmtUptime(sec: number | null): string {
  if (sec === null) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function metricColor(val: number | null, warn = 75, crit = 90): string {
  if (val === null) return 'text-gray-600'
  if (val >= crit) return 'text-red-400'
  if (val >= warn) return 'text-yellow-400'
  return 'text-status-online'
}

function MiniBar({
  value,
  warn = 75,
  crit = 90,
}: {
  value: number | null
  warn?: number
  crit?: number
}) {
  if (value === null) return <span className="text-gray-600 text-[12px]">—</span>
  const color =
    value >= crit ? 'bg-red-400' : value >= warn ? 'bg-yellow-400' : 'bg-status-online'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className={`text-[12px] font-mono tabular-nums ${metricColor(value, warn, crit)}`}>
        {value.toFixed(0)}%
      </span>
    </div>
  )
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

interface SummaryCardsProps {
  displays: Display[]
}

function SummaryCards({ displays }: SummaryCardsProps) {
  const total = displays.length
  const online = displays.filter((d) => d.status === 'online').length
  const offline = displays.filter((d) => d.status === 'offline').length
  const error = displays.filter((d) => d.status === 'error').length

  const cards = [
    {
      label: 'Total Displays',
      value: total,
      icon: Monitor,
      color: 'text-gray-300',
      bg: 'bg-white/5',
    },
    {
      label: 'Online',
      value: online,
      icon: Activity,
      color: 'text-status-online',
      bg: 'bg-status-online/10',
    },
    {
      label: 'Offline',
      value: offline,
      icon: WifiOff,
      color: 'text-status-offline',
      bg: 'bg-status-offline/10',
    },
    {
      label: 'Errors',
      value: error,
      icon: Activity,
      color: 'text-status-warning',
      bg: 'bg-status-warning/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map(({ label, value, icon: Icon, color, bg }) => (
        <div
          key={label}
          className="rounded-xl bg-dark-bg-2 border border-white/5 px-5 py-4"
        >
          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${bg} mb-3`}>
            <Icon size={16} className={color} />
          </div>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          <p className="text-[12px] text-gray-500 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Health Grid ──────────────────────────────────────────────────────────────

function HealthGrid({ displays }: { displays: Display[] }) {
  if (displays.length === 0) {
    return (
      <div className="text-center py-16 text-gray-600 text-[14px]">
        No displays provisioned yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-white/5 text-gray-500 text-[12px] uppercase tracking-wider">
            <th className="text-left pb-2.5 pr-4 font-medium">Display</th>
            <th className="text-left pb-2.5 pr-4 font-medium">Status</th>
            <th className="text-left pb-2.5 pr-4 font-medium">CPU</th>
            <th className="text-left pb-2.5 pr-4 font-medium">Memory</th>
            <th className="text-left pb-2.5 pr-4 font-medium">Disk</th>
            <th className="text-left pb-2.5 pr-4 font-medium">Temp</th>
            <th className="text-left pb-2.5 pr-4 font-medium">Network</th>
            <th className="text-left pb-2.5 pr-4 font-medium">Uptime</th>
            <th className="text-right pb-2.5 font-medium">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {displays.map((d) => {
            const t = d.latest_telemetry
            return (
              <tr
                key={d.id}
                className="border-b border-white/5 hover:bg-dark-bg-3 transition-colors"
              >
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <Monitor size={13} className="text-gray-600 flex-shrink-0" />
                    <div>
                      <p className="text-gray-100 font-medium truncate max-w-[140px]">{d.name}</p>
                      {d.location_name && (
                        <p className="text-[11px] text-gray-600 truncate max-w-[140px]">
                          {d.location_name}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <StatusDot status={d.status} />
                </td>
                <td className="py-3 pr-4">
                  <MiniBar value={t?.cpu_percent ?? null} />
                </td>
                <td className="py-3 pr-4">
                  <MiniBar value={t?.memory_percent ?? null} />
                </td>
                <td className="py-3 pr-4">
                  <MiniBar value={t?.disk_percent ?? null} />
                </td>
                <td className="py-3 pr-4">
                  {t?.cpu_temp_c !== null && t?.cpu_temp_c !== undefined ? (
                    <span
                      className={`flex items-center gap-1 text-[12px] font-mono ${metricColor(t.cpu_temp_c, 70, 85)}`}
                    >
                      <Thermometer size={11} />
                      {t.cpu_temp_c.toFixed(0)}°C
                    </span>
                  ) : (
                    <span className="text-gray-600 text-[12px]">—</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  {t?.net_connected !== null && t?.net_connected !== undefined ? (
                    <span
                      className={`flex items-center gap-1 text-[12px] ${t.net_connected ? 'text-status-online' : 'text-status-offline'}`}
                    >
                      {t.net_connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                      {t.net_type ?? (t.net_connected ? 'connected' : 'disconnected')}
                    </span>
                  ) : (
                    <span className="text-gray-600 text-[12px]">—</span>
                  )}
                </td>
                <td className="py-3 pr-4 text-[12px] text-gray-400 font-mono">
                  {fmtUptime(t?.uptime_sec ?? null)}
                </td>
                <td className="py-3 text-right text-[12px] text-gray-500">
                  {timeAgo(d.last_heartbeat)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const cfg: Record<string, { dot: string; label: string }> = {
    online:  { dot: 'bg-status-online',   label: 'Online' },
    offline: { dot: 'bg-status-offline',  label: 'Offline' },
    error:   { dot: 'bg-status-warning',  label: 'Error' },
    pending: { dot: 'bg-yellow-400',       label: 'Pending' },
    syncing: { dot: 'bg-status-syncing',  label: 'Syncing' },
  }
  const c = cfg[status] ?? cfg.offline
  return (
    <span className="flex items-center gap-1.5 text-[12px] text-gray-400">
      <span
        className={`w-1.5 h-1.5 rounded-full ${c.dot} ${status === 'online' ? 'animate-pulse' : ''}`}
      />
      {c.label}
    </span>
  )
}

// ─── Telemetry Sparkline Detail ───────────────────────────────────────────────

function TelemetrySparkline({
  data,
  metric,
  color,
}: {
  data: TelemetryDataPoint[]
  metric: keyof TelemetryDataPoint
  color: string
}) {
  if (data.length < 2) {
    return <span className="text-[11px] text-gray-600">No data</span>
  }

  const values = data
    .map((d) => d[metric] as number | null)
    .filter((v): v is number => v !== null)
  if (values.length < 2) return <span className="text-[11px] text-gray-600">No data</span>

  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const W = 80
  const H = 28
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W
      const y = H - ((v - min) / range) * H
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
    </svg>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

const PERIODS: { label: string; value: TelemetryPeriod }[] = [
  { label: '1h', value: '1h' },
  { label: '6h', value: '6h' },
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
]

function DetailPanel({ display }: { display: Display }) {
  const { fetchTelemetry, telemetryHistory, telemetryLoading } = useMonitoringStore()
  const [period, setPeriod] = useState<TelemetryPeriod>('24h')

  useEffect(() => {
    fetchTelemetry(display.id, period)
  }, [display.id, period, fetchTelemetry])

  const data = telemetryHistory[display.id] ?? []
  const loading = telemetryLoading[display.id] ?? false
  const latest = data[data.length - 1] ?? null

  return (
    <div className="rounded-xl bg-dark-bg-2 border border-white/5 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Monitor size={14} className="text-gjs-blue" />
          <span className="text-[14px] font-semibold text-gray-100">{display.name}</span>
        </div>
        {/* Period selector */}
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-2.5 py-1 rounded text-[12px] transition-colors ${
                period === p.value
                  ? 'bg-gjs-blue/20 text-gjs-blue font-semibold'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-[13px] text-gray-600 py-4">Loading telemetry...</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {(
            [
              { label: 'CPU', metric: 'cpu_percent', icon: Cpu, warn: 75, crit: 90 },
              { label: 'Memory', metric: 'memory_percent', icon: MemoryStick, warn: 80, crit: 95 },
              { label: 'Disk', metric: 'disk_percent', icon: HardDrive, warn: 80, crit: 90 },
            ] as const
          ).map(({ label, metric, icon: Icon, warn, crit }) => (
            <div key={label} className="rounded-lg bg-dark-bg-3 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Icon size={12} className="text-gray-500" />
                <span className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</span>
              </div>
              <div className="flex items-end justify-between">
                <span
                  className={`text-xl font-bold font-mono ${metricColor(
                    latest?.[metric] ?? null,
                    warn,
                    crit
                  )}`}
                >
                  {latest?.[metric] !== null && latest?.[metric] !== undefined
                    ? `${(latest[metric] as number).toFixed(0)}%`
                    : '—'}
                </span>
                <TelemetrySparkline
                  data={data}
                  metric={metric}
                  color={
                    (latest?.[metric] ?? 0) >= crit
                      ? '#f87171'
                      : (latest?.[metric] ?? 0) >= warn
                        ? '#facc15'
                        : '#4ade80'
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-4 text-[12px]">
        <div className="rounded-lg bg-dark-bg-3 p-3">
          <p className="text-gray-500 mb-1">Uptime</p>
          <p className="text-gray-100 font-mono">{fmtUptime(latest?.uptime_sec ?? null)}</p>
        </div>
        <div className="rounded-lg bg-dark-bg-3 p-3">
          <p className="text-gray-500 mb-1">Network</p>
          <p className={latest?.net_connected ? 'text-status-online' : 'text-status-offline'}>
            {latest?.net_connected ? (latest.net_type ?? 'Connected') : 'Offline'}
          </p>
        </div>
        <div className="rounded-lg bg-dark-bg-3 p-3">
          <p className="text-gray-500 mb-1">Playback</p>
          <p className="text-gray-100 capitalize">{latest?.playback_status ?? '—'}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const { displays, loading, error, fetchFleet } = useMonitoringStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedDisplay = displays.find((d) => d.id === selectedId) ?? null

  useEffect(() => {
    fetchFleet()
    const interval = setInterval(fetchFleet, 30_000)
    return () => clearInterval(interval)
  }, [fetchFleet])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Fleet Monitoring</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Real-time health across {displays.length} display{displays.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={fetchFleet}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-gray-100 hover:bg-white/10 transition-colors text-[13px] disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-[13px] text-red-400">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <SummaryCards displays={displays} />

      {/* Telemetry detail for selected display */}
      {selectedDisplay && <DetailPanel display={selectedDisplay} />}

      {/* Health grid */}
      <div className="rounded-xl bg-dark-bg-2 border border-white/5 p-5">
        <h2 className="text-[14px] font-semibold text-gray-200 mb-4">Display Health</h2>
        {loading && displays.length === 0 ? (
          <div className="text-center py-10 text-gray-600 text-[13px]">Loading fleet data…</div>
        ) : (
          <HealthGrid
            displays={displays.map((d) => ({
              ...d,
              // Highlight selected
              _selected: d.id === selectedId,
            }) as Display & { _selected: boolean })}
          />
        )}
        {displays.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <p className="text-[12px] text-gray-600">
              Click a display name to view telemetry detail.
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {displays.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedId((prev) => (prev === d.id ? null : d.id))}
                  className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                    selectedId === d.id
                      ? 'bg-gjs-blue/20 border-gjs-blue/40 text-gjs-blue'
                      : 'border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20'
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
