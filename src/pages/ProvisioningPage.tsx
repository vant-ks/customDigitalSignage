import { useEffect, useState } from 'react'
import {
  Cpu,
  Download,
  Trash2,
  ChevronRight,
  CheckCircle,
  Copy,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { useProvisioningStore } from '../stores/provisioningStore'
import { useDisplayStore } from '../stores/displayStore'
import type { ProvisioningToken } from '../types'

// ─── Hardware options ─────────────────────────────────────────────────────────

const HARDWARE_OPTIONS = [
  { value: 'pi4', label: 'Raspberry Pi 4', desc: '4-core ARM, 4–8 GB RAM' },
  { value: 'pi5', label: 'Raspberry Pi 5', desc: '4-core ARM, up to 8 GB RAM' },
  { value: 'nuc', label: 'Intel NUC', desc: 'i3/i5/i7 compact PC' },
  { value: 'x86', label: 'Generic x86', desc: 'Any Linux x86-64 machine' },
  { value: 'mac_mini', label: 'Mac Mini', desc: 'Apple Silicon or Intel' },
]

const RESOLUTION_PRESETS = [
  { label: '1920 × 1080 (Full HD)', w: 1920, h: 1080 },
  { label: '3840 × 2160 (4K UHD)', w: 3840, h: 2160 },
  { label: '1280 × 720 (HD)', w: 1280, h: 720 },
  { label: 'Custom', w: 0, h: 0 },
]

const FALLBACK_OPTIONS = [
  { value: 'last_known_good', label: 'Last known-good media' },
  { value: 'blank', label: 'Blank screen' },
]

// ─── Wizard form state ────────────────────────────────────────────────────────

interface WizardForm {
  // Step 1
  display_name: string
  group_id: string
  location_name: string
  tags: string
  // Step 2
  hardware_type: string
  // Step 3
  resolution_preset: string
  resolution_w: number
  resolution_h: number
  orientation: 'landscape' | 'portrait'
  // Step 4
  cache_max_gb: number
  cache_fallback: string
  // Step 5
  expires_hours: number
}

const INITIAL_FORM: WizardForm = {
  display_name: '',
  group_id: '',
  location_name: '',
  tags: '',
  hardware_type: 'pi4',
  resolution_preset: '1920 × 1080 (Full HD)',
  resolution_w: 1920,
  resolution_h: 1080,
  orientation: 'landscape',
  cache_max_gb: 10,
  cache_fallback: 'last_known_good',
  expires_hours: 24,
}

const STEPS = ['Display Info', 'Hardware', 'Display Config', 'Cache Policy', 'Summary']

// ─── Token status badge ───────────────────────────────────────────────────────

function TokenBadge({ token }: { token: ProvisioningToken }) {
  const now = new Date()
  const expired = new Date(token.expires_at) < now
  if (token.is_used) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-400">
        Used
      </span>
    )
  }
  if (expired) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-400">
        Expired
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gjs-blue/20 px-2 py-0.5 text-xs text-gjs-blue">
      Active
    </span>
  )
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="ml-2 rounded p-1 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
      title="Copy"
    >
      {copied ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProvisioningPage() {
  const { tokens, loading, error, createdToken, fetchTokens, createToken, revokeToken, downloadConfig, clearCreatedToken } =
    useProvisioningStore()
  const { groups, fetchGroups } = useDisplayStore()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<WizardForm>(INITIAL_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    fetchTokens()
    fetchGroups()
  }, [fetchTokens, fetchGroups])

  // ── Form helpers ────────────────────────────────────────────────────────────

  const set = <K extends keyof WizardForm>(key: K, value: WizardForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleResolutionPreset = (label: string) => {
    const preset = RESOLUTION_PRESETS.find((p) => p.label === label)!
    setForm((f) => ({
      ...f,
      resolution_preset: label,
      resolution_w: label === 'Custom' ? f.resolution_w : preset.w,
      resolution_h: label === 'Custom' ? f.resolution_h : preset.h,
    }))
  }

  const canAdvance = (): boolean => {
    if (step === 0) return form.display_name.trim().length >= 2
    if (step === 1) return form.hardware_type !== ''
    if (step === 2) return form.resolution_w > 0 && form.resolution_h > 0
    return true
  }

  const handleGenerate = async () => {
    setCreating(true)
    setCreateError(null)
    try {
      const tags = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      await createToken({
        hardware_type: form.hardware_type,
        expires_hours: form.expires_hours,
        config: {
          display_name: form.display_name,
          group_id: form.group_id || null,
          location_name: form.location_name || null,
          tags,
          resolution_w: form.resolution_w,
          resolution_h: form.resolution_h,
          orientation: form.orientation,
          cache_policy: {
            max_gb: form.cache_max_gb,
            fallback: form.cache_fallback,
          },
        },
      })
      setStep(5) // success step
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to generate token')
    } finally {
      setCreating(false)
    }
  }

  const handleReset = () => {
    clearCreatedToken()
    setForm(INITIAL_FORM)
    setStep(0)
    setCreateError(null)
  }

  const handleRevoke = async (id: string) => {
    setRevoking(id)
    try {
      await revokeToken(id)
    } finally {
      setRevoking(null)
    }
  }

  const handleDownload = async (id: string) => {
    setDownloading(id)
    try {
      await downloadConfig(id)
    } finally {
      setDownloading(null)
    }
  }

  // ── Wizard step renders ─────────────────────────────────────────────────────

  const renderStep0 = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Display Name *</label>
        <input
          value={form.display_name}
          onChange={(e) => set('display_name', e.target.value)}
          placeholder="e.g. Lobby South Screen"
          className="w-full rounded-lg bg-dark-bg-1 border border-white/10 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gjs-blue/50 focus:outline-none focus:ring-1 focus:ring-gjs-blue/30"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Group (optional)</label>
        <select
          value={form.group_id}
          onChange={(e) => set('group_id', e.target.value)}
          className="w-full rounded-lg bg-dark-bg-1 border border-white/10 px-3 py-2 text-sm text-gray-100 focus:border-gjs-blue/50 focus:outline-none"
        >
          <option value="">— No group —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Location (optional)</label>
        <input
          value={form.location_name}
          onChange={(e) => set('location_name', e.target.value)}
          placeholder="e.g. Building A, Floor 2"
          className="w-full rounded-lg bg-dark-bg-1 border border-white/10 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gjs-blue/50 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Tags (comma separated, optional)</label>
        <input
          value={form.tags}
          onChange={(e) => set('tags', e.target.value)}
          placeholder="indoor, retail, kiosk"
          className="w-full rounded-lg bg-dark-bg-1 border border-white/10 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gjs-blue/50 focus:outline-none"
        />
      </div>
    </div>
  )

  const renderStep1 = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {HARDWARE_OPTIONS.map((hw) => (
        <button
          key={hw.value}
          onClick={() => set('hardware_type', hw.value)}
          className={`flex flex-col gap-1 rounded-xl border p-4 text-left transition-all ${
            form.hardware_type === hw.value
              ? 'border-gjs-blue bg-gjs-blue/10 text-white'
              : 'border-white/8 bg-dark-bg-1 text-gray-300 hover:border-white/20'
          }`}
        >
          <div className="flex items-center gap-2">
            <Cpu size={16} className={form.hardware_type === hw.value ? 'text-gjs-blue' : 'text-gray-500'} />
            <span className="text-sm font-medium">{hw.label}</span>
          </div>
          <span className="text-xs text-gray-500">{hw.desc}</span>
        </button>
      ))}
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Resolution</label>
        <select
          value={form.resolution_preset}
          onChange={(e) => handleResolutionPreset(e.target.value)}
          className="w-full rounded-lg bg-dark-bg-1 border border-white/10 px-3 py-2 text-sm text-gray-100 focus:border-gjs-blue/50 focus:outline-none"
        >
          {RESOLUTION_PRESETS.map((p) => (
            <option key={p.label} value={p.label}>
              {p.label}
            </option>
          ))}
        </select>
        {form.resolution_preset === 'Custom' && (
          <div className="mt-2 flex gap-2">
            <input
              type="number"
              value={form.resolution_w}
              onChange={(e) => set('resolution_w', Number(e.target.value))}
              placeholder="Width"
              className="w-1/2 rounded-lg bg-dark-bg-1 border border-white/10 px-3 py-2 text-sm text-gray-100 focus:border-gjs-blue/50 focus:outline-none"
            />
            <input
              type="number"
              value={form.resolution_h}
              onChange={(e) => set('resolution_h', Number(e.target.value))}
              placeholder="Height"
              className="w-1/2 rounded-lg bg-dark-bg-1 border border-white/10 px-3 py-2 text-sm text-gray-100 focus:border-gjs-blue/50 focus:outline-none"
            />
          </div>
        )}
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Orientation</label>
        <div className="flex gap-3">
          {(['landscape', 'portrait'] as const).map((o) => (
            <button
              key={o}
              onClick={() => set('orientation', o)}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium capitalize transition-all ${
                form.orientation === o
                  ? 'border-gjs-blue bg-gjs-blue/10 text-white'
                  : 'border-white/10 bg-dark-bg-1 text-gray-400 hover:border-white/20'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between mb-2">
          <label className="text-sm text-gray-400">Max local cache size</label>
          <span className="text-sm font-semibold text-gjs-blue">{form.cache_max_gb} GB</span>
        </div>
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={form.cache_max_gb}
          onChange={(e) => set('cache_max_gb', Number(e.target.value))}
          className="w-full accent-gjs-blue"
        />
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>1 GB</span>
          <span>100 GB</span>
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Offline fallback behavior</label>
        <select
          value={form.cache_fallback}
          onChange={(e) => set('cache_fallback', e.target.value)}
          className="w-full rounded-lg bg-dark-bg-1 border border-white/10 px-3 py-2 text-sm text-gray-100 focus:border-gjs-blue/50 focus:outline-none"
        >
          {FALLBACK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Token expiry</label>
        <select
          value={form.expires_hours}
          onChange={(e) => set('expires_hours', Number(e.target.value))}
          className="w-full rounded-lg bg-dark-bg-1 border border-white/10 px-3 py-2 text-sm text-gray-100 focus:border-gjs-blue/50 focus:outline-none"
        >
          <option value={24}>24 hours</option>
          <option value={48}>48 hours</option>
          <option value={168}>7 days</option>
          <option value={720}>30 days</option>
        </select>
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-4 text-sm">
      <h3 className="text-base font-semibold text-white">Review before generating</h3>
      <div className="rounded-xl bg-dark-bg-1 border border-white/8 divide-y divide-white/5">
        {[
          ['Display Name', form.display_name],
          ['Group', groups.find((g) => g.id === form.group_id)?.name || '—'],
          ['Location', form.location_name || '—'],
          ['Tags', form.tags || '—'],
          ['Hardware', HARDWARE_OPTIONS.find((h) => h.value === form.hardware_type)?.label || '—'],
          ['Resolution', `${form.resolution_w} × ${form.resolution_h}`],
          ['Orientation', form.orientation],
          ['Cache Limit', `${form.cache_max_gb} GB`],
          ['Offline Fallback', FALLBACK_OPTIONS.find((o) => o.value === form.cache_fallback)?.label || '—'],
          ['Token Expiry', `${form.expires_hours}h`],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between px-4 py-2.5">
            <span className="text-gray-500">{label}</span>
            <span className="text-gray-200 font-medium">{value}</span>
          </div>
        ))}
      </div>
      {createError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          <AlertCircle size={15} />
          {createError}
        </div>
      )}
    </div>
  )

  // ── Success (step 5) ────────────────────────────────────────────────────────

  const renderSuccess = () => {
    if (!createdToken) return null
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <CheckCircle className="text-green-400 flex-shrink-0" size={24} />
          <div>
            <p className="font-semibold text-white">Token generated successfully</p>
            <p className="text-sm text-gray-400">
              Copy the token or download the config file to your device.
            </p>
          </div>
        </div>

        {/* Token string */}
        <div>
          <label className="block text-xs text-gray-500 mb-1 uppercase tracking-widest">
            Provisioning Token
          </label>
          <div className="flex items-center gap-2 rounded-xl bg-dark-bg-1 border border-white/10 px-4 py-3">
            <code className="flex-1 text-sm text-gjs-blue font-mono break-all">
              {createdToken.token}
            </code>
            <CopyButton text={createdToken.token} />
          </div>
        </div>

        {/* Expiry notice */}
        <p className="text-xs text-gray-500">
          Expires{' '}
          <span className="text-gray-300">
            {new Date(createdToken.expires_at).toLocaleString()}
          </span>
          . Single-use — consumed on first device registration.
        </p>

        {/* Download config */}
        <button
          onClick={() => handleDownload(createdToken.id)}
          disabled={downloading === createdToken.id}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gjs-blue px-4 py-3 text-sm font-semibold text-white hover:bg-gjs-blue/90 disabled:opacity-60 transition-colors"
        >
          {downloading === createdToken.id ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          Download config.yaml
        </button>

        <button
          onClick={handleReset}
          className="w-full rounded-xl border border-white/10 px-4 py-2.5 text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          Provision another display
        </button>
      </div>
    )
  }

  // ── Page layout ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Cpu size={22} className="text-gjs-blue" />
        <div>
          <h1 className="text-xl font-bold text-white">Provisioning</h1>
          <p className="text-sm text-gray-400">Generate single-use tokens to register new displays</p>
        </div>
      </div>

      {/* Wizard card */}
      <div className="rounded-2xl bg-dark-bg-2 border border-white/5 overflow-hidden">
        {/* Steps bar (hidden on success) */}
        {step < 5 && (
          <div className="flex border-b border-white/5">
            {STEPS.map((label, i) => (
              <div
                key={label}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
                  i === step
                    ? 'bg-gjs-blue/10 text-gjs-blue border-b-2 border-gjs-blue'
                    : i < step
                    ? 'text-green-400'
                    : 'text-gray-600'
                }`}
              >
                {i < step && <CheckCircle size={12} />}
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </div>
            ))}
          </div>
        )}

        {/* Step content */}
        <div className="p-6">
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderSuccess()}
        </div>

        {/* Footer nav (hidden on success) */}
        {step < 5 && (
          <div className="flex justify-between gap-3 border-t border-white/5 px-6 py-4">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-400 hover:bg-white/5 disabled:opacity-30 transition-colors"
            >
              Back
            </button>
            {step < 4 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance()}
                className="flex items-center gap-1.5 rounded-lg bg-gjs-blue px-5 py-2 text-sm font-semibold text-white hover:bg-gjs-blue/90 disabled:opacity-40 transition-colors"
              >
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={creating}
                className="flex items-center gap-2 rounded-lg bg-gjs-blue px-5 py-2 text-sm font-semibold text-white hover:bg-gjs-blue/90 disabled:opacity-50 transition-colors"
              >
                {creating && <RefreshCw size={14} className="animate-spin" />}
                Generate Token
              </button>
            )}
          </div>
        )}
      </div>

      {/* Token history */}
      <div className="rounded-2xl bg-dark-bg-2 border border-white/5 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">Token History</h2>
          <button
            onClick={() => fetchTokens()}
            disabled={loading}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 m-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {tokens.length === 0 && !loading ? (
          <div className="px-6 py-10 text-center text-sm text-gray-600">
            No provisioning tokens yet. Generate one above to get started.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="flex items-center gap-4 px-6 py-4 hover:bg-white/2 transition-colors"
              >
                {/* Token string */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <code className="text-xs font-mono text-gray-300 truncate max-w-xs">
                      {token.token}
                    </code>
                    <CopyButton text={token.token} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{token.hardware_type ?? '—'}</span>
                    <span>·</span>
                    <span>
                      Expires{' '}
                      {new Date(token.expires_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {!!token.config?.display_name && (
                      <>
                        <span>·</span>
                        <span className="text-gray-400">{String(token.config.display_name)}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status + actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <TokenBadge token={token} />

                  {!token.is_used && (
                    <button
                      onClick={() => handleDownload(token.id)}
                      disabled={downloading === token.id}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gjs-blue/20 hover:text-gjs-blue transition-colors"
                      title="Download config.yaml"
                    >
                      {downloading === token.id ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Download size={14} />
                      )}
                    </button>
                  )}

                  {!token.is_used && (
                    <button
                      onClick={() => handleRevoke(token.id)}
                      disabled={revoking === token.id}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                      title="Revoke token"
                    >
                      {revoking === token.id ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
