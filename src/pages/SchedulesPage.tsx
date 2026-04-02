import { useEffect, useState } from 'react'
import { Plus, Zap, ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react'
import { useScheduleStore } from '../stores/scheduleStore'
import { usePlaylistStore } from '../stores/playlistStore'
import type { Schedule } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const TYPE_COLORS: Record<string, string> = {
  always:    'bg-gjs-blue/20 border-gjs-blue/40 text-gjs-blue',
  recurring: 'bg-green-500/20 border-green-500/40 text-green-400',
  one_time:  'bg-amber-500/20 border-amber-500/40 text-amber-400',
}

const PRIORITY_LABEL = (p: number) =>
  p >= 90 ? 'Critical' : p >= 50 ? 'High' : p >= 20 ? 'Normal' : 'Low'

// ─── Helpers ──────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day) // shift to Monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function scheduleAppliesToDay(s: Schedule, dayIndex: number): boolean {
  // dayIndex: 0=Mon…6=Sun (matching days_of_week)
  if (s.schedule_type === 'always') return true
  if (s.schedule_type === 'recurring') return s.days_of_week?.includes(dayIndex) ?? false
  if (s.schedule_type === 'one_time') return true // show it if it has any overlap
  return false
}

// ─── Schedule Block ───────────────────────────────────────────────────────

function ScheduleBlock({
  schedule,
  playlistName,
  onDelete,
}: {
  schedule: Schedule
  playlistName: string
  onDelete: () => void
}) {
  const cls = TYPE_COLORS[schedule.schedule_type] ?? TYPE_COLORS.always
  return (
    <div
      className={`group relative flex flex-col gap-0.5 rounded px-2 py-1.5 border text-[11px] cursor-default ${cls}`}
    >
      <span className="font-semibold truncate">{schedule.name}</span>
      <span className="truncate opacity-75">{playlistName}</span>
      {schedule.start_time && schedule.end_time && (
        <span className="opacity-60">
          {schedule.start_time.slice(0, 5)}–{schedule.end_time.slice(0, 5)}
        </span>
      )}
      {schedule.is_override && (
        <span className="absolute top-1 right-1 text-[9px] font-bold uppercase tracking-wide text-red-400">
          Override
        </span>
      )}
      <button
        onClick={onDelete}
        className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
        title="Delete schedule"
      >
        <Trash2 size={10} />
      </button>
    </div>
  )
}

// ─── Create Schedule Dialog ───────────────────────────────────────────────

function CreateScheduleDialog({
  onClose,
  onCreated,
  defaultDayIndex,
}: {
  onClose: () => void
  onCreated: () => void
  defaultDayIndex?: number
}) {
  const { playlists, fetchPlaylists } = usePlaylistStore()
  const { createSchedule } = useScheduleStore()
  const [name, setName] = useState('')
  const [playlistId, setPlaylistId] = useState('')
  const [scheduleType, setScheduleType] = useState<'always' | 'recurring' | 'one_time'>('recurring')
  const [days, setDays] = useState<number[]>(defaultDayIndex !== undefined ? [defaultDayIndex] : [0, 1, 2, 3, 4])
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [priority, setPriority] = useState(0)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { fetchPlaylists() }, [])

  const toggleDay = (i: number) =>
    setDays((d) => d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort())

  const handleSave = async () => {
    if (!name.trim()) { setErr('Name is required'); return }
    if (!playlistId) { setErr('Select a playlist'); return }
    setSaving(true); setErr('')
    try {
      await createSchedule({
        name: name.trim(),
        playlist_id: playlistId,
        schedule_type: scheduleType,
        days_of_week: scheduleType === 'recurring' ? days : [0,1,2,3,4,5,6],
        start_time: scheduleType === 'always' ? null : startTime,
        end_time: scheduleType === 'always' ? null : endTime,
        priority,
        is_active: true,
      } as Partial<Schedule>)
      onCreated()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-dark-bg-2 border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-[14px] font-semibold text-gray-100">New Schedule</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {err && <p className="text-[12px] text-red-400">{err}</p>}

          <div>
            <label className="block text-[12px] text-gray-400 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Morning loop, Evening content…"
              className="w-full bg-dark-bg-1 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-gray-100 focus:outline-none focus:border-gjs-blue/50"
            />
          </div>

          <div>
            <label className="block text-[12px] text-gray-400 mb-1">Playlist</label>
            <select
              value={playlistId}
              onChange={(e) => setPlaylistId(e.target.value)}
              className="w-full bg-dark-bg-1 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-gray-100 focus:outline-none focus:border-gjs-blue/50"
            >
              <option value="">— select playlist —</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] text-gray-400 mb-1">Type</label>
            <div className="flex gap-2">
              {(['always', 'recurring', 'one_time'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setScheduleType(t)}
                  className={`flex-1 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                    scheduleType === t
                      ? 'bg-gjs-blue/20 border-gjs-blue/50 text-gjs-blue'
                      : 'border-white/10 text-gray-400 hover:border-white/20'
                  }`}
                >
                  {t === 'one_time' ? 'One-time' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {scheduleType === 'recurring' && (
            <div>
              <label className="block text-[12px] text-gray-400 mb-1">Days</label>
              <div className="flex gap-1.5">
                {DAY_NAMES.map((d, i) => (
                  <button
                    key={d}
                    onClick={() => toggleDay(i)}
                    className={`flex-1 py-1 rounded text-[11px] font-medium border transition-colors ${
                      days.includes(i)
                        ? 'bg-gjs-blue/20 border-gjs-blue/50 text-gjs-blue'
                        : 'border-white/10 text-gray-500 hover:border-white/20'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {scheduleType !== 'always' && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[12px] text-gray-400 mb-1">Start time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-dark-bg-1 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-gray-100 focus:outline-none focus:border-gjs-blue/50"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[12px] text-gray-400 mb-1">End time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-dark-bg-1 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-gray-100 focus:outline-none focus:border-gjs-blue/50"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[12px] text-gray-400 mb-1">
              Priority <span className="text-gray-500">({priority} — {PRIORITY_LABEL(priority)})</span>
            </label>
            <input
              type="range" min={0} max={100} value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full accent-gjs-blue"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-white/5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-[13px] text-gray-400 hover:text-gray-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg bg-gjs-blue text-white text-[13px] font-medium hover:bg-gjs-blue/80 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Create Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Override Dialog ──────────────────────────────────────────────────────

function OverrideDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { playlists, fetchPlaylists } = usePlaylistStore()
  const { createOverride } = useScheduleStore()
  const [name, setName] = useState('Emergency Override')
  const [playlistId, setPlaylistId] = useState('')
  const [expireMinutes, setExpireMinutes] = useState<number | ''>(60)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { fetchPlaylists() }, [])

  const handleSave = async () => {
    if (!name.trim()) { setErr('Name is required'); return }
    if (!playlistId) { setErr('Select a playlist'); return }
    setSaving(true); setErr('')
    try {
      await createOverride({
        name: name.trim(),
        playlist_id: playlistId,
        priority: 99,
        auto_expire_minutes: expireMinutes !== '' ? Number(expireMinutes) : undefined,
      })
      onCreated()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create override')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl bg-dark-bg-2 border border-red-500/30 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-red-400" />
            <h2 className="text-[14px] font-semibold text-gray-100">Emergency Override</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-[12px] text-gray-400">
            Overrides all scheduled content immediately across the entire org. Takes effect instantly via WebSocket push.
          </p>
          {err && <p className="text-[12px] text-red-400">{err}</p>}

          <div>
            <label className="block text-[12px] text-gray-400 mb-1">Label</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-dark-bg-1 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-gray-100 focus:outline-none focus:border-red-400/50"
            />
          </div>
          <div>
            <label className="block text-[12px] text-gray-400 mb-1">Playlist to show</label>
            <select
              value={playlistId}
              onChange={(e) => setPlaylistId(e.target.value)}
              className="w-full bg-dark-bg-1 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-gray-100 focus:outline-none focus:border-red-400/50"
            >
              <option value="">— select —</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] text-gray-400 mb-1">Auto-expire (minutes, leave blank = permanent)</label>
            <input
              type="number" min={1} max={1440}
              value={expireMinutes}
              onChange={(e) => setExpireMinutes(e.target.value ? Number(e.target.value) : '')}
              placeholder="e.g. 60"
              className="w-full bg-dark-bg-1 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-gray-100 focus:outline-none focus:border-red-400/50"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-white/5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-[13px] text-gray-400 hover:text-gray-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg bg-red-500 text-white text-[13px] font-medium hover:bg-red-400 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Activating…' : 'Activate Override'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function SchedulesPage() {
  const { schedules, loading, fetchSchedules, deleteSchedule } = useScheduleStore()
  const { playlists, fetchPlaylists } = usePlaylistStore()
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [showCreate, setShowCreate] = useState(false)
  const [createDayIndex, setCreateDayIndex] = useState<number | undefined>()
  const [showOverride, setShowOverride] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    fetchSchedules()
    fetchPlaylists()
  }, [])

  const playlistMap = Object.fromEntries(playlists.map((p) => [p.id, p.name]))

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const handleDelete = async (id: string) => {
    await deleteSchedule(id)
    setConfirmDelete(null)
  }

  const overrideSchedules = schedules.filter((s) => s.is_override && s.is_active)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-gray-100">Schedules</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            {schedules.length} schedule{schedules.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOverride(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 text-[13px] font-medium hover:bg-red-500/10 transition-colors"
          >
            <Zap size={13} />
            Emergency Override
          </button>
          <button
            onClick={() => { setCreateDayIndex(undefined); setShowCreate(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gjs-blue text-white text-[13px] font-medium hover:bg-gjs-blue/80 transition-colors"
          >
            <Plus size={13} />
            New Schedule
          </button>
        </div>
      </div>

      {/* Active overrides banner */}
      {overrideSchedules.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center gap-3">
          <Zap size={14} className="text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[13px] font-medium text-red-300">
              {overrideSchedules.length} active override{overrideSchedules.length > 1 ? 's' : ''}
            </p>
            <p className="text-[12px] text-red-400/70">{overrideSchedules.map((s) => s.name).join(', ')}</p>
          </div>
          <button
            onClick={() => overrideSchedules.forEach((s) => deleteSchedule(s.id))}
            className="text-[12px] text-red-400 hover:text-red-200 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Week nav */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          className="p-1.5 rounded-md text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-[13px] text-gray-300 font-medium min-w-[160px] text-center">
          {fmtDate(weekStart)} – {fmtDate(addDays(weekStart, 6))}
        </span>
        <button
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          className="p-1.5 rounded-md text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => setWeekStart(getWeekStart(new Date()))}
          className="ml-2 px-3 py-1 rounded-md text-[12px] text-gray-400 border border-white/10 hover:border-white/20 hover:text-gray-200 transition-colors"
        >
          Today
        </button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-white/5 overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-7 border-b border-white/5 bg-dark-bg-2">
          {weekDays.map((d, i) => {
            const isToday = d.getTime() === today.getTime()
            return (
              <div
                key={i}
                className={`px-2 py-2.5 text-center border-r last:border-r-0 border-white/5 ${
                  isToday ? 'bg-gjs-blue/10' : ''
                }`}
              >
                <p className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? 'text-gjs-blue' : 'text-gray-500'}`}>
                  {DAY_NAMES[i]}
                </p>
                <p className={`text-[13px] font-medium mt-0.5 ${isToday ? 'text-gjs-blue' : 'text-gray-400'}`}>
                  {d.getDate()}
                </p>
              </div>
            )
          })}
        </div>

        {/* Schedule cells */}
        <div className="grid grid-cols-7 min-h-[300px]">
          {weekDays.map((d, dayIdx) => {
            const isToday = d.getTime() === today.getTime()
            const daySchedules = schedules.filter((s) => scheduleAppliesToDay(s, dayIdx))

            return (
              <div
                key={dayIdx}
                className={`p-1.5 space-y-1 border-r last:border-r-0 border-white/5 min-h-[160px] ${
                  isToday ? 'bg-gjs-blue/5' : 'bg-dark-bg-1 hover:bg-white/[0.02]'
                } transition-colors cursor-pointer`}
                onClick={() => { setCreateDayIndex(dayIdx); setShowCreate(true) }}
              >
                {daySchedules.map((s) => (
                  <div key={s.id} onClick={(e) => e.stopPropagation()}>
                    <ScheduleBlock
                      schedule={s}
                      playlistName={playlistMap[s.playlist_id] ?? '—'}
                      onDelete={() => setConfirmDelete(s.id)}
                    />
                  </div>
                ))}
                {daySchedules.length === 0 && (
                  <div className="flex items-center justify-center h-16 opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-[11px] text-gray-600">+ Add</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* All schedules list */}
      <div>
        <h2 className="text-[14px] font-semibold text-gray-300 mb-3">All Schedules</h2>
        {loading ? (
          <p className="text-[13px] text-gray-500">Loading…</p>
        ) : schedules.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-dark-bg-2 px-6 py-10 text-center">
            <p className="text-[14px] text-gray-400">No schedules yet</p>
            <p className="text-[13px] text-gray-600 mt-1">Create a schedule to assign playlists to your displays</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/5 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/5 bg-dark-bg-2">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Name</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Playlist</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Type</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Days</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Time</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Priority</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => {
                  const cls = TYPE_COLORS[s.schedule_type] ?? TYPE_COLORS.always
                  return (
                    <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-gray-200 font-medium">
                        <div className="flex items-center gap-2">
                          {s.is_override && <Zap size={11} className="text-red-400 flex-shrink-0" />}
                          {s.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{playlistMap[s.playlist_id] ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}>
                          {s.schedule_type === 'one_time' ? 'One-time' : s.schedule_type.charAt(0).toUpperCase() + s.schedule_type.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-[12px]">
                        {s.schedule_type === 'always' ? 'Every day' :
                          (s.days_of_week ?? []).map((d) => DAY_NAMES[d]).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-[12px]">
                        {s.start_time && s.end_time
                          ? `${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}`
                          : s.schedule_type === 'always' ? 'All day' : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-[12px]">
                        {s.priority} <span className="text-gray-600">({PRIORITY_LABEL(s.priority)})</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setConfirmDelete(s.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {showCreate && (
        <CreateScheduleDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => fetchSchedules()}
          defaultDayIndex={createDayIndex}
        />
      )}
      {showOverride && (
        <OverrideDialog
          onClose={() => setShowOverride(false)}
          onCreated={() => fetchSchedules()}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-dark-bg-2 border border-white/10 shadow-2xl p-6 space-y-4">
            <h2 className="text-[14px] font-semibold text-gray-100">Delete schedule?</h2>
            <p className="text-[13px] text-gray-400">This will remove the schedule immediately. Active displays will pick up the change on their next manifest sync.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-1.5 text-[13px] text-gray-400 hover:text-gray-200">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="px-4 py-1.5 rounded-lg bg-red-500/80 text-white text-[13px] font-medium hover:bg-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
