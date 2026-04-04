import { useEffect, useState } from 'react'
import { ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../services/apiClient'
import type { AuditLog, PaginatedResponse } from '../types'

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const ENTITY_TYPES = [
  'display', 'group', 'playlist', 'media', 'schedule',
  'alert_rule', 'user', 'storage', 'provisioning_token',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [entityType, setEntityType] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const PAGE_SIZE = 50

  const load = async (p = page) => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        page: String(p),
        page_size: String(PAGE_SIZE),
      })
      if (entityType) qs.set('entity_type', entityType)
      if (fromDate) qs.set('from', new Date(fromDate).toISOString())
      if (toDate) qs.set('to', new Date(toDate).toISOString())

      const data = await api.get<PaginatedResponse<AuditLog>>(`/api/audit?${qs}`)
      setLogs(data.data as AuditLog[])
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, fromDate, toDate])

  const goPage = (p: number) => {
    setPage(p)
    load(p)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-100">Audit Log</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">
          {total > 0 ? `${total.toLocaleString()} events` : 'All admin and manager actions'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          className="bg-dark-bg-2 border border-white/10 rounded-lg px-3 py-1.5 text-[13px] text-gray-300 focus:outline-none focus:border-gjs-blue/50"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
        >
          <option value="">All entity types</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace('_', ' ')}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <label className="text-[12px] text-gray-500">From</label>
          <input
            type="date"
            className="bg-dark-bg-2 border border-white/10 rounded-lg px-3 py-1.5 text-[13px] text-gray-300 focus:outline-none focus:border-gjs-blue/50"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[12px] text-gray-500">To</label>
          <input
            type="date"
            className="bg-dark-bg-2 border border-white/10 rounded-lg px-3 py-1.5 text-[13px] text-gray-300 focus:outline-none focus:border-gjs-blue/50"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        {(entityType || fromDate || toDate) && (
          <button
            onClick={() => { setEntityType(''); setFromDate(''); setToDate('') }}
            className="px-3 py-1.5 rounded-lg text-[13px] text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl bg-dark-bg-2 border border-white/5 overflow-hidden">
        {error && (
          <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20 text-[13px] text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-[13px] text-gray-600">Loading audit log…</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList size={28} className="mx-auto text-gray-700 mb-3" />
            <p className="text-[14px] text-gray-500">No audit events found.</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 text-[11px] uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-medium">Time</th>
                <th className="text-left px-4 py-2.5 font-medium">Action</th>
                <th className="text-left px-4 py-2.5 font-medium">Entity</th>
                <th className="text-left px-4 py-2.5 font-medium">IP Address</th>
                <th className="text-left px-4 py-2.5 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-white/5 hover:bg-dark-bg-3 transition-colors"
                >
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                    {fmt(log.created_at)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-gjs-blue bg-gjs-blue/10 px-1.5 py-0.5 rounded text-[11px]">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400">
                    <span className="font-mono">{log.entity_type}</span>
                    {log.entity_id && (
                      <span className="text-gray-600 text-[11px] ml-1.5 font-mono">
                        {log.entity_id.slice(0, 8)}…
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 font-mono">
                    {log.ip_address ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 max-w-[240px] truncate">
                    {log.details && Object.keys(log.details).length > 0
                      ? Object.entries(log.details)
                          .slice(0, 2)
                          .map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`)
                          .join(' · ')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-[12px] text-gray-600">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => goPage(page - 1)}
                disabled={page <= 1}
                className="p-1.5 rounded text-gray-500 hover:text-gray-200 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => goPage(page + 1)}
                disabled={page >= totalPages}
                className="p-1.5 rounded text-gray-500 hover:text-gray-200 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
