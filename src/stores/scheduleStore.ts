import { create } from 'zustand'
import { api } from '../services/apiClient'
import type { PaginatedResponse, Schedule } from '../types'

interface ScheduleFilters {
  display_id?: string
  group_id?: string
  is_active?: boolean
  page?: number
}

interface ScheduleState {
  schedules: Schedule[]
  total: number
  page: number
  loading: boolean
  error: string | null
}

interface ScheduleActions {
  fetchSchedules: (filters?: ScheduleFilters) => Promise<void>
  createSchedule: (data: Partial<Schedule>) => Promise<Schedule>
  updateSchedule: (id: string, data: Partial<Schedule>) => Promise<void>
  deleteSchedule: (id: string) => Promise<void>
  createOverride: (data: {
    name: string
    playlist_id: string
    display_id?: string
    group_id?: string
    priority?: number
    auto_expire_minutes?: number
  }) => Promise<Schedule>
}

export const useScheduleStore = create<ScheduleState & ScheduleActions>((set, get) => ({
  schedules: [],
  total: 0,
  page: 1,
  loading: false,
  error: null,

  fetchSchedules: async (filters = {}) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (filters.display_id) params.set('display_id', filters.display_id)
      if (filters.group_id) params.set('group_id', filters.group_id)
      if (filters.is_active !== undefined) params.set('is_active', String(filters.is_active))
      if (filters.page) params.set('page', String(filters.page))
      const qs = params.toString()
      const data = await api.get<PaginatedResponse<Schedule>>(
        `/api/schedules${qs ? `?${qs}` : ''}`
      )
      set({ schedules: data.data as Schedule[], total: data.total, page: data.page, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch schedules' })
    }
  },

  createSchedule: async (data) => {
    const schedule = await api.post<Schedule>('/api/schedules', data)
    set((s) => ({ schedules: [schedule, ...s.schedules], total: s.total + 1 }))
    return schedule
  },

  updateSchedule: async (id, data) => {
    const updated = await api.patch<Schedule>(`/api/schedules/${id}`, data)
    set((s) => ({
      schedules: s.schedules.map((sc) => (sc.id === id ? updated : sc)),
    }))
  },

  deleteSchedule: async (id) => {
    await api.delete(`/api/schedules/${id}`)
    set((s) => ({
      schedules: s.schedules.filter((sc) => sc.id !== id),
      total: s.total - 1,
    }))
  },

  createOverride: async (data) => {
    const schedule = await api.post<Schedule>('/api/schedules/override', data)
    set((s) => ({ schedules: [schedule, ...s.schedules], total: s.total + 1 }))
    return schedule
  },
}))
