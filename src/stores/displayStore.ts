import { create } from 'zustand'
import { api } from '../services/apiClient'
import { wsService } from '../services/wsService'
import type {
  Display,
  DisplayGroup,
  PaginatedResponse,
  StatusChangePayload,
  WSMessage,
} from '../types'

interface DisplayFilters {
  status?: string
  group_id?: string
  search?: string
  tags?: string[]
  page?: number
  per_page?: number
}

interface DisplayState {
  displays: Display[]
  groups: DisplayGroup[]
  total: number
  page: number
  perPage: number
  loading: boolean
  error: string | null
}

interface DisplayActions {
  fetchDisplays: (filters?: DisplayFilters) => Promise<void>
  fetchGroups: () => Promise<void>
  createDisplay: (data: Partial<Display>) => Promise<Display>
  updateDisplay: (id: string, data: Partial<Display>) => Promise<void>
  deleteDisplay: (id: string) => Promise<void>
  handleWSMessage: (msg: WSMessage) => void
  subscribeToWS: () => () => void
}

export const useDisplayStore = create<DisplayState & DisplayActions>((set, get) => ({
  // State
  displays: [],
  groups: [],
  total: 0,
  page: 1,
  perPage: 20,
  loading: false,
  error: null,

  // Actions
  fetchDisplays: async (filters = {}) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.group_id) params.set('group_id', filters.group_id)
      if (filters.search) params.set('search', filters.search)
      if (filters.tags?.length) params.set('tags', filters.tags.join(','))
      if (filters.page) params.set('page', String(filters.page))
      if (filters.per_page) params.set('per_page', String(filters.per_page))

      const qs = params.toString()
      const data = await api.get<PaginatedResponse<Display>>(
        `/api/displays${qs ? `?${qs}` : ''}`
      )
      set({
        displays: data.data as Display[],
        total: data.total,
        page: data.page,
        perPage: data.page_size,
        loading: false,
      })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch displays' })
    }
  },

  fetchGroups: async () => {
    try {
      const data = await api.get<PaginatedResponse<DisplayGroup>>('/api/display-groups?per_page=100')
      set({ groups: data.data as DisplayGroup[] })
    } catch (err) {
      console.error('[displayStore] fetchGroups error', err)
    }
  },

  createDisplay: async (data) => {
    const created = await api.post<Display>('/api/displays', data)
    set((state) => ({ displays: [created, ...state.displays], total: state.total + 1 }))
    return created
  },

  updateDisplay: async (id, data) => {
    const updated = await api.patch<Display>(`/api/displays/${id}`, data)
    set((state) => ({
      displays: state.displays.map((d) => (d.id === id ? { ...d, ...updated } : d)),
    }))
  },

  deleteDisplay: async (id) => {
    await api.delete(`/api/displays/${id}`)
    set((state) => ({
      displays: state.displays.filter((d) => d.id !== id),
      total: state.total - 1,
    }))
  },

  handleWSMessage: (msg) => {
    if (msg.type === 'status_change') {
      const payload = msg.payload as StatusChangePayload
      // Match by device_token since StatusChangePayload doesn't carry display_id
      set((state) => ({
        displays: state.displays.map((d) =>
          d.device_token === payload.deviceToken
            ? {
                ...d,
                status: payload.status,
                last_heartbeat: payload.heartbeat,
              }
            : d
        ),
      }))
    }
  },

  subscribeToWS: () => {
    const unsubStatus = wsService.on<WSMessage>('status_change', get().handleWSMessage)
    return () => {
      unsubStatus()
    }
  },
}))
