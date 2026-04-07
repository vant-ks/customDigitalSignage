import { useEffect, useState } from 'react'
import { Building2, KeyRound, Trash2, UserPlus, Users } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { api } from '../services/apiClient'
import type { User, Organization } from '../types'

// ─── helpers ──────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'team' | 'org'

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[12px] text-gray-400 mb-1.5">{children}</label>
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full bg-light-bg-3 dark:bg-dark-bg-3 border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-[13px] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gjs-blue/50 disabled:opacity-50"
    />
  )
}

function SaveBtn({ loading, label = 'Save changes' }: { loading: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="px-4 py-2 rounded-lg bg-gjs-blue text-white text-[13px] font-semibold hover:bg-gjs-blue/80 transition-colors disabled:opacity-50"
    >
      {loading ? 'Saving…' : label}
    </button>
  )
}

// ─── Profile tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const storeUser = useAuthStore((s) => s.user)
  const storeOrg = useAuthStore((s) => s.organization)
  const setUser = useAuthStore((s) => s.setUser)

  const [name, setName] = useState(storeUser?.name ?? '')
  const [email, setEmail] = useState(storeUser?.email ?? '')
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pwSaving, setPwSaving] = useState(false)

  const handleProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setProfileMsg(null)
    try {
      const updated = await api.patch<User>('/api/users/me', { name, email })
      if (storeOrg) setUser(updated, storeOrg)
      setProfileMsg({ ok: true, text: 'Profile updated.' })
    } catch (err) {
      setProfileMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: 'Passwords do not match' }); return }
    setPwSaving(true)
    setPwMsg(null)
    try {
      await api.post('/api/users/me/change-password', {
        current_password: curPw,
        new_password: newPw,
      })
      setPwMsg({ ok: true, text: 'Password changed.' })
      setCurPw(''); setNewPw(''); setConfirmPw('')
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed to change password' })
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Profile info */}
      <div className="rounded-xl bg-light-bg-2 dark:bg-dark-bg-2 border border-gray-200 dark:border-white/5 p-5">
        <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 mb-4">Profile information</h3>
        <form onSubmit={handleProfile} className="space-y-4">
          <div>
            <Label>Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Email address</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Role</Label>
            <Input value={storeUser?.role ?? ''} disabled />
          </div>
          {profileMsg && (
            <p className={`text-[12px] ${profileMsg.ok ? 'text-status-online' : 'text-red-400'}`}>{profileMsg.text}</p>
          )}
          <SaveBtn loading={saving} />
        </form>
      </div>

      {/* Change password */}
      <div className="rounded-xl bg-light-bg-2 dark:bg-dark-bg-2 border border-gray-200 dark:border-white/5 p-5">
        <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <KeyRound size={14} className="text-gray-500" />
          Change password
        </h3>
        <form onSubmit={handlePassword} className="space-y-4">
          <div>
            <Label>Current password</Label>
            <Input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" />
          </div>
          <div>
            <Label>New password</Label>
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <Label>Confirm new password</Label>
            <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
          </div>
          {pwMsg && (
            <p className={`text-[12px] ${pwMsg.ok ? 'text-status-online' : 'text-red-400'}`}>{pwMsg.text}</p>
          )}
          <SaveBtn loading={pwSaving} label="Update password" />
        </form>
      </div>
    </div>
  )
}

// ─── Team tab ─────────────────────────────────────────────────────────────────

function TeamTab() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'manager' | 'viewer'>('viewer')
  const [invitePw, setInvitePw] = useState('')
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [inviting, setInviting] = useState(false)
  const currentUserId = useAuthStore((s) => s.user?.id)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const data = await api.get<User[]>('/api/users')
      setUsers(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setInviteMsg(null)
    try {
      await api.post('/api/users', {
        name: inviteName,
        email: inviteEmail,
        role: inviteRole,
        password: invitePw,
      })
      setInviteMsg({ ok: true, text: 'User created.' })
      setInviteName(''); setInviteEmail(''); setInvitePw('')
      setShowInvite(false)
      fetchUsers()
    } catch (err) {
      setInviteMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed to create user' })
    } finally {
      setInviting(false)
    }
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('Remove this user?')) return
    try {
      await api.delete(`/api/users/${userId}`)
      setUsers((prev) => prev.filter((u) => u.id !== userId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      const updated = await api.patch<User>(`/api/users/${userId}`, { role })
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  const ROLE_BADGE: Record<string, string> = {
    admin: 'bg-gjs-blue/15 text-gjs-blue',
    manager: 'bg-yellow-400/10 text-yellow-400',
    viewer: 'bg-gray-100 dark:bg-white/5 text-gray-400',
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-gray-500">{users.length} member{users.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => { setShowInvite(true); setInviteMsg(null) }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gjs-blue text-white text-[13px] font-semibold hover:bg-gjs-blue/80 transition-colors"
        >
          <UserPlus size={13} />
          Add user
        </button>
      </div>

      {showInvite && (
        <div className="rounded-xl bg-light-bg-2 dark:bg-dark-bg-2 border border-gray-300 dark:border-white/10 p-5">
          <h4 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 mb-4">New team member</h4>
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} required />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
              </div>
              <div>
                <Label>Password (temporary)</Label>
                <Input type="password" value={invitePw} onChange={(e) => setInvitePw(e.target.value)} required minLength={8} />
              </div>
              <div>
                <Label>Role</Label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'manager' | 'viewer')}
                  className="w-full bg-light-bg-3 dark:bg-dark-bg-3 border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-[13px] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gjs-blue/50"
                >
                  <option value="viewer">Viewer</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
            </div>
            {inviteMsg && (
              <p className={`text-[12px] ${inviteMsg.ok ? 'text-status-online' : 'text-red-400'}`}>{inviteMsg.text}</p>
            )}
            <div className="flex gap-2">
              <SaveBtn loading={inviting} label="Create user" />
              <button type="button" onClick={() => setShowInvite(false)} className="px-4 py-2 rounded-lg text-[13px] text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl bg-light-bg-2 dark:bg-dark-bg-2 border border-gray-200 dark:border-white/5 overflow-hidden">
        {loading ? (
          <p className="text-[13px] text-gray-600 py-8 text-center">Loading…</p>
        ) : (
          users.map((u, i) => (
            <div
              key={u.id}
              className={`flex items-center gap-3 px-4 py-3 ${i < users.length - 1 ? 'border-b border-gray-200 dark:border-white/5' : ''}`}
            >
              <div className="w-8 h-8 rounded-full bg-gjs-blue/20 flex items-center justify-center text-gjs-blue text-[13px] font-bold flex-shrink-0">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{u.name}</p>
                <p className="text-[12px] text-gray-500">{u.email}</p>
              </div>
              {u.id === currentUserId ? (
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${ROLE_BADGE[u.role]}`}>{u.role}</span>
              ) : (
                <select
                  value={u.role}
                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                  className="bg-light-bg-3 dark:bg-dark-bg-3 border border-gray-300 dark:border-white/10 rounded-lg px-2 py-1 text-[12px] text-gray-700 dark:text-gray-300 focus:outline-none focus:border-gjs-blue/50"
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="viewer">Viewer</option>
                </select>
              )}
              {u.id !== currentUserId && (
                <button
                  onClick={() => handleDelete(u.id)}
                  className="p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Org tab ──────────────────────────────────────────────────────────────────

function OrgTab() {
  const [org, setOrgState] = useState<Organization | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    api.get<Organization>('/api/users/org').then((data) => {
      setOrgState(data)
      setName(data.name)
    })
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    try {
      const updated = await api.patch<Organization>('/api/users/org', { name })
      setOrgState(updated)
      setMsg({ ok: true, text: 'Organization updated.' })
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  if (!org) return <p className="text-[13px] text-gray-600">Loading…</p>

  return (
    <div className="space-y-4 max-w-lg">
      <div className="rounded-xl bg-light-bg-2 dark:bg-dark-bg-2 border border-gray-200 dark:border-white/5 p-5">
        <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Building2 size={14} className="text-gray-500" />
          Organization settings
        </h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label>Organization name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Slug (read-only)</Label>
            <Input value={org.slug} disabled />
          </div>
          <div>
            <Label>Plan</Label>
            <Input value={org.plan} disabled />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Max displays</Label>
              <Input value={org.max_displays} disabled />
            </div>
            <div>
              <Label>Max storage (GB)</Label>
              <Input value={org.max_storage_gb} disabled />
            </div>
          </div>
          {msg && (
            <p className={`text-[12px] ${msg.ok ? 'text-status-online' : 'text-red-400'}`}>{msg.text}</p>
          )}
          <SaveBtn loading={saving} />
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const role = useAuthStore((s) => s.user?.role)
  const [tab, setTab] = useState<Tab>('profile')

  const tabs: { id: Tab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { id: 'profile', label: 'Profile', icon: KeyRound },
    { id: 'team', label: 'Team', icon: Users, adminOnly: true },
    { id: 'org', label: 'Organization', icon: Building2, adminOnly: true },
  ]

  const visibleTabs = tabs.filter((t) => !t.adminOnly || role === 'admin')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Manage your profile, team, and organization</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-light-bg-2 dark:bg-dark-bg-2 rounded-lg p-1 w-fit border border-gray-200 dark:border-white/5 mb-6">
        {visibleTabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                tab === t.id ? 'bg-gjs-blue/20 text-gjs-blue' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon size={13} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'profile' && <ProfileTab />}
      {tab === 'team' && role === 'admin' && <TeamTab />}
      {tab === 'org' && role === 'admin' && <OrgTab />}
    </div>
  )
}
