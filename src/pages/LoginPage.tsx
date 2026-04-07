import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const [orgSlug, setOrgSlug] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login({ org_slug: orgSlug.trim(), email: email.trim(), password })
      navigate('/displays', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-light-bg-1 dark:bg-dark-bg-1 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-lg bg-vant-orange flex items-center justify-center">
            <span className="text-white text-lg font-bold leading-none">V</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] text-gray-500 uppercase tracking-widest">VANT</span>
            <span className="text-[18px] font-semibold text-gray-900 dark:text-gray-100 leading-tight">Signage</span>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-light-bg-2 dark:bg-dark-bg-2 rounded-xl border border-gray-200 dark:border-white/5 p-7 space-y-4"
        >
          <h1 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 mb-2">Sign in to your account</h1>

          {error && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] px-3 py-2">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-[12px] text-gray-400 font-medium" htmlFor="org_slug">
              Organization
            </label>
            <input
              id="org_slug"
              type="text"
              autoComplete="organization"
              required
              value={orgSlug}
              onChange={(e) => setOrgSlug(e.target.value)}
              placeholder="your-org-slug"
              className="w-full rounded-md bg-light-bg-3 dark:bg-dark-bg-3 border border-gray-300 dark:border-white/10 text-[13px] text-gray-900 dark:text-gray-100 placeholder-gray-600 px-3 py-2 outline-none focus:border-gjs-blue focus:ring-1 focus:ring-gjs-blue transition"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[12px] text-gray-400 font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md bg-light-bg-3 dark:bg-dark-bg-3 border border-gray-300 dark:border-white/10 text-[13px] text-gray-900 dark:text-gray-100 placeholder-gray-600 px-3 py-2 outline-none focus:border-gjs-blue focus:ring-1 focus:ring-gjs-blue transition"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[12px] text-gray-400 font-medium" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md bg-light-bg-3 dark:bg-dark-bg-3 border border-gray-300 dark:border-white/10 text-[13px] text-gray-900 dark:text-gray-100 placeholder-gray-600 px-3 py-2 outline-none focus:border-gjs-blue focus:ring-1 focus:ring-gjs-blue transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 rounded-md bg-gjs-blue hover:bg-gjs-blue/90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-semibold py-2.5 transition"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center mt-5 text-[11px] text-gray-600">
          VANT Signage Platform — GJS Media
        </p>
      </div>
    </div>
  )
}
