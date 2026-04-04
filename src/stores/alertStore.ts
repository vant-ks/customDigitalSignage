import { create } from 'zustand'
import { api } from '../services/apiClient'
import type { AlertRule, AlertRuleCreate, Notification, PaginatedResponse } from '../types'

interface AlertState {
  rules: AlertRule[]
  rulesLoading: boolean
  notifications: Notification[]
  notifLoading: boolean
  unreadCount: number
  error: string | null
}

interface AlertActions {
  fetchRules: () => Promise<void>
  createRule: (data: AlertRuleCreate) => Promise<AlertRule>
  updateRule: (id: string, data: Partial<AlertRuleCreate>) => Promise<void>
  deleteRule: (id: string) => Promise<void>
  fetchNotifications: (page?: number, unreadOnly?: boolean) => Promise<void>
  fetchUnreadCount: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

export const useAlertStore = create<AlertState & AlertActions>((set) => ({
  rules: [],
  rulesLoading: false,
  notifications: [],
  notifLoading: false,
  unreadCount: 0,
  error: null,

  fetchRules: async () => {
    set({ rulesLoading: true, error: null })
    try {
      const data = await api.get<AlertRule[]>('/api/alert-rules')
      set({ rules: data, rulesLoading: false })
    } catch (err) {
      set({ rulesLoading: false, error: err instanceof Error ? err.message : 'Failed' })
    }
  },

  createRule: async (data) => {
    const created = await api.post<AlertRule>('/api/alert-rules', data)
    set((s) => ({ rules: [created, ...s.rules] }))
    return created
  },

  updateRule: async (id, data) => {
    const updated = await api.patch<AlertRule>(`/api/alert-rules/${id}`, data)
    set((s) => ({ rules: s.rules.map((r) => (r.id === id ? updated : r)) }))
  },

  deleteRule: async (id) => {
    await api.delete(`/api/alert-rules/${id}`)
    set((s) => ({ rules: s.rules.filter((r) => r.id !== id) }))
  },

  fetchNotifications: async (page = 1, unreadOnly = false) => {
    set({ notifLoading: true })
    try {
      const qs = `page=${page}&page_size=50${unreadOnly ? '&unread_only=true' : ''}`
      const data = await api.get<PaginatedResponse<Notification>>(`/api/notifications?${qs}`)
      set({ notifications: data.data as Notification[], notifLoading: false })
    } catch {
      set({ notifLoading: false })
    }
  },

  fetchUnreadCount: async () => {
    try {
      const data = await api.get<{ count: number }>('/api/notifications/unread-count')
      set({ unreadCount: data.count })
    } catch {
      // non-critical — ignore failures
    }
  },

  markRead: async (id) => {
    const updated = await api.patch<Notification>(`/api/notifications/${id}/read`, {})
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? updated : n)),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }))
  },

  markAllRead: async () => {
    await api.post('/api/notifications/read-all', {})
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }))
  },
}))
