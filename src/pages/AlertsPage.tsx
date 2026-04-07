import { useEffect, useState } from 'react'
import type { ElementType } from 'react'
import {
  Bell,
  Check,
  CheckCheck,
  Plus,
  Trash2,
  X,
  AlertTriangle,
  Info,
  AlertCircle,
} from 'lucide-react'
import { useAlertStore } from '../stores/alertStore'
import { useAuthStore } from '../stores/authStore'
import type { AlertRule, AlertRuleCreate, AlertSeverity, Notification } from '../types'

// ─── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const s = Math.max(0, Date.now() - new Date(iso).getTime())
  const m = Math.floor(s / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const EVENT_TYPE_OPTIONS = [
  { value: 'cpu_high',    label: 'CPU High', hasThreshold: true, unit: '%', defaultGt: 90 },
  { value: 'memory_high', label: 'Memory High', hasThreshold: true, unit: '%', defaultGt: 85 },
  { value: 'disk_high',   label: 'Disk High', hasThreshold: true, unit: '%', defaultGt: 90 },
  { value: 'temp_high',   label: 'CPU Temp High', hasThreshold: true, unit: '°C', defaultGt: 80 },
  { value: 'offline',     label: 'Display Offline', hasThreshold: false },
  { value: 'sync_error',  label: 'Sync Error', hasThreshold: false },
]

const SEVERITY_CFG: Record<
  AlertSeverity,
  { icon: ElementType; text: string; bg: string }
> = {
  info:     { icon: Info,          text: 'text-gjs-blue',        bg: 'bg-gjs-blue/10' },
  warning:  { icon: AlertTriangle, text: 'text-yellow-400',       bg: 'bg-yellow-400/10' },
  critical: { icon: AlertCircle,   text: 'text-red-400',          bg: 'bg-red-400/10' },
}

// ─── Create/Edit Modal ────────────────────────────────────────────────────────

interface RuleFormProps {
  initial?: Partial<AlertRuleCreate>
  onSave: (data: AlertRuleCreate) => Promise<void>
  onCancel: () => void
}

function RuleForm({ initial, onSave, onCancel }: RuleFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [eventType, setEventType] = useState(initial?.event_type ?? 'cpu_high')
  const [thresholdGt, setThresholdGt] = useState<number>(
    (initial?.threshold?.gt as number) ?? 90
  )
  const [cooldown, setCooldown] = useState(initial?.cooldown_min ?? 30)
  const [emailStr, setEmailStr] = useState(
    (initial?.email_recipients ?? []).join(', ')
  )
  const [webhookUrl, setWebhookUrl] = useState(initial?.webhook_url ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedEvent = EVENT_TYPE_OPTIONS.find((e) => e.value === eventType)!

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const channels: string[] = ['dashboard']
      const emailRecipients = emailStr
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
      if (emailRecipients.length > 0) channels.push('email')
      if (webhookUrl.trim()) channels.push('webhook')

      const payload: AlertRuleCreate = {
        name: name.trim(),
        event_type: eventType,
        channels,
        cooldown_min: cooldown,
        is_active: true,
        email_recipients: emailRecipients.length > 0 ? emailRecipients : null,
        webhook_url: webhookUrl.trim() || null,
        ...(selectedEvent.hasThreshold ? { threshold: { gt: thresholdGt } } : {}),
      }
      await onSave(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-2xl bg-light-bg-2 dark:bg-dark-bg-2 border border-gray-300 dark:border-white/10 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[16px] font-semibold text-gray-900 dark:text-gray-100">
            {initial?.name ? 'Edit Alert Rule' : 'New Alert Rule'}
          </h3>
          <button onClick={onCancel} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-200 dark:hover:bg-white/10 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] text-gray-400 mb-1.5">Rule name</label>
            <input
              className="w-full bg-light-bg-3 dark:bg-dark-bg-3 border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-[13px] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gjs-blue/50"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. High CPU Alert"
            />
          </div>

          <div>
            <label className="block text-[12px] text-gray-400 mb-1.5">Event type</label>
            <select
              className="w-full bg-light-bg-3 dark:bg-dark-bg-3 border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-[13px] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gjs-blue/50"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              {EVENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {selectedEvent.hasThreshold && (
            <div>
              <label className="block text-[12px] text-gray-400 mb-1.5">
                Trigger when &gt; ({selectedEvent.unit})
              </label>
              <input
                type="number"
                min={1}
                max={selectedEvent.unit === '°C' ? 120 : 100}
                className="w-full bg-light-bg-3 dark:bg-dark-bg-3 border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-[13px] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gjs-blue/50"
                value={thresholdGt}
                onChange={(e) => setThresholdGt(Number(e.target.value))}
              />
            </div>
          )}

          <div>
            <label className="block text-[12px] text-gray-400 mb-1.5">
              Cooldown (minutes between re-fires)
            </label>
            <input
              type="number"
              min={1}
              max={1440}
              className="w-full bg-light-bg-3 dark:bg-dark-bg-3 border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-[13px] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gjs-blue/50"
              value={cooldown}
              onChange={(e) => setCooldown(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-[12px] text-gray-400 mb-1.5">
              Email recipients <span className="text-gray-600">(comma-separated, optional)</span>
            </label>
            <input
              type="text"
              placeholder="ops@example.com, alerts@example.com"
              className="w-full bg-light-bg-3 dark:bg-dark-bg-3 border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-[13px] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gjs-blue/50"
              value={emailStr}
              onChange={(e) => setEmailStr(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[12px] text-gray-400 mb-1.5">
              Webhook URL <span className="text-gray-600">(optional — Slack, custom endpoint)</span>
            </label>
            <input
              type="url"
              placeholder="https://hooks.slack.com/services/…"
              className="w-full bg-light-bg-3 dark:bg-dark-bg-3 border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-[13px] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gjs-blue/50"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-[13px] text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-gjs-blue text-white text-[13px] font-semibold hover:bg-gjs-blue/80 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Rule Card ────────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
  isViewer,
}: {
  rule: AlertRule
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  isViewer: boolean
}) {
  const eventOpt = EVENT_TYPE_OPTIONS.find((e) => e.value === rule.event_type)
  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        rule.is_active
          ? 'bg-light-bg-2 dark:bg-dark-bg-2 border-gray-200 dark:border-white/5'
          : 'bg-light-bg-2 dark:bg-dark-bg-2 border-gray-200 dark:border-white/5 opacity-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Bell size={13} className={rule.is_active ? 'text-gjs-blue' : 'text-gray-600'} />
            <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">{rule.name}</p>
          </div>
          <p className="text-[12px] text-gray-500">
            {eventOpt?.label ?? rule.event_type}
            {rule.threshold?.gt !== undefined &&
              ` › ${rule.threshold.gt}${eventOpt?.unit ?? ''}`}
          </p>
          <p className="text-[11px] text-gray-600 mt-1">
            Cooldown: {rule.cooldown_min}m
            {rule.last_fired_at && ` · Last fired: ${timeAgo(rule.last_fired_at)}`}
          </p>
          {(rule.email_recipients?.length || rule.webhook_url) && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {rule.email_recipients && rule.email_recipients.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-[10px] text-gray-500">
                  ✉ {rule.email_recipients.length} email{rule.email_recipients.length > 1 ? 's' : ''}
                </span>
              )}
              {rule.webhook_url && (
                <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-[10px] text-gray-500">⚡ webhook</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={isViewer ? undefined : onToggle}
            disabled={isViewer}
            title={isViewer ? 'Read-only' : rule.is_active ? 'Disable' : 'Enable'}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
              isViewer
                ? 'bg-gray-100 dark:bg-white/5 text-gray-600 cursor-default'
                : rule.is_active
                  ? 'bg-status-online/10 text-status-online hover:bg-status-online/20'
                  : 'bg-gray-100 dark:bg-white/5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-200 dark:hover:bg-white/10'
            }`}
          >
            {rule.is_active ? 'Active' : 'Disabled'}
          </button>
          {!isViewer && (
            <>
              <button
                onClick={onEdit}
                className="p-1.5 rounded text-gray-500 hover:text-gray-800 dark:hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
              >
                <Plus size={13} className="rotate-45" />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Notification Row ─────────────────────────────────────────────────────────

function NotificationRow({
  notif,
  onMarkRead,
}: {
  notif: Notification
  onMarkRead: (id: string) => void
}) {
  const cfg = SEVERITY_CFG[notif.severity] ?? SEVERITY_CFG.info
  const Icon = cfg.icon
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 border-b border-gray-200 dark:border-white/5 transition-opacity ${
        notif.is_read ? 'opacity-50' : ''
      }`}
    >
      <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${cfg.bg}`}>
        <Icon size={12} className={cfg.text} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{notif.title}</p>
        {notif.message && (
          <p className="text-[12px] text-gray-500 mt-0.5">{notif.message}</p>
        )}
        <p className="text-[11px] text-gray-600 mt-1">{timeAgo(notif.created_at)}</p>
      </div>
      {!notif.is_read && (
        <button
          onClick={() => onMarkRead(notif.id)}
          title="Mark read"
          className="flex-shrink-0 p-1.5 rounded text-gray-600 hover:text-gjs-blue hover:bg-gjs-blue/10 transition-colors"
        >
          <Check size={13} />
        </button>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'rules' | 'notifications'

export default function AlertsPage() {
  const {
    rules,
    rulesLoading,
    notifications,
    notifLoading,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    fetchNotifications,
    markRead,
    markAllRead,
  } = useAlertStore()

  const isViewer = useAuthStore((s) => s.user?.role === 'viewer')

  const [tab, setTab] = useState<Tab>('rules')
  const [showForm, setShowForm] = useState(false)
  const [editRule, setEditRule] = useState<AlertRule | null>(null)

  useEffect(() => {
    fetchRules()
    fetchNotifications()
  }, [fetchRules, fetchNotifications])

  const handleSave = async (data: AlertRuleCreate) => {
    if (editRule) {
      await updateRule(editRule.id, data)
    } else {
      await createRule(data)
    }
    setShowForm(false)
    setEditRule(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this alert rule?')) return
    await deleteRule(id)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Alerts</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Configure monitoring rules and view notifications
          </p>
        </div>
        {tab === 'rules' && !isViewer && (
          <button
            onClick={() => { setEditRule(null); setShowForm(true) }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gjs-blue text-white text-[13px] font-semibold hover:bg-gjs-blue/80 transition-colors"
          >
            <Plus size={14} />
            New rule
          </button>
        )}
        {tab === 'notifications' && notifications.some((n) => !n.is_read) && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-400 hover:text-gray-900 dark:hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-[13px]"
          >
            <CheckCheck size={14} />
            Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-light-bg-2 dark:bg-dark-bg-2 rounded-lg p-1 w-fit border border-gray-200 dark:border-white/5">
        {(['rules', 'notifications'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-[13px] font-medium capitalize transition-colors ${
              tab === t
                ? 'bg-gjs-blue/20 text-gjs-blue'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Rules tab */}
      {tab === 'rules' && (
        <div className="space-y-3">
          {rulesLoading ? (
            <p className="text-[13px] text-gray-600 py-8 text-center">Loading rules…</p>
          ) : rules.length === 0 ? (
            <div className="rounded-xl bg-light-bg-2 dark:bg-dark-bg-2 border border-gray-200 dark:border-white/5 py-16 text-center">
              <Bell size={28} className="mx-auto text-gray-700 mb-3" />
              <p className="text-[14px] text-gray-500">No alert rules configured.</p>
              <p className="text-[12px] text-gray-600 mt-1">
                Create a rule to start monitoring your fleet.
              </p>
            </div>
          ) : (
            rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                isViewer={!!isViewer}
                onEdit={() => { setEditRule(rule); setShowForm(true) }}
                onDelete={() => handleDelete(rule.id)}
                onToggle={() => updateRule(rule.id, { is_active: !rule.is_active })}
              />
            ))
          )}
        </div>
      )}

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <div className="rounded-xl bg-light-bg-2 dark:bg-dark-bg-2 border border-gray-200 dark:border-white/5 overflow-hidden">
          {notifLoading ? (
            <p className="text-[13px] text-gray-600 py-8 text-center">Loading notifications…</p>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center">
              <Bell size={28} className="mx-auto text-gray-700 mb-3" />
              <p className="text-[14px] text-gray-500">No notifications yet.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationRow key={n.id} notif={n} onMarkRead={markRead} />
            ))
          )}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <RuleForm
          initial={editRule ? { ...editRule, threshold: editRule.threshold ?? undefined } : undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditRule(null) }}
        />
      )}
    </div>
  )
}
