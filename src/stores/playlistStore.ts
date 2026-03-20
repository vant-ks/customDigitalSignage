import { create } from 'zustand'
import { api } from '../services/apiClient'
import type { PaginatedResponse, Playlist, PlaylistItem } from '../types'

interface PlaylistFilters {
  search?: string
  is_active?: boolean
  page?: number
}

interface PlaylistState {
  playlists: Playlist[]
  total: number
  page: number
  loading: boolean
  error: string | null
  activePlaylist: Playlist | null
}

interface PlaylistActions {
  fetchPlaylists: (filters?: PlaylistFilters) => Promise<void>
  fetchPlaylist: (id: string) => Promise<void>
  createPlaylist: (data: {
    name: string
    description?: string
    play_mode?: string
    transition_type?: string
    transition_ms?: number
  }) => Promise<Playlist>
  updatePlaylist: (id: string, data: Partial<Playlist>) => Promise<void>
  deletePlaylist: (id: string) => Promise<void>
  addItem: (playlistId: string, data: {
    media_id: string
    position: number
    duration_sec?: number
    weight?: number
    transition_type?: string
    transition_ms?: number
  }) => Promise<PlaylistItem>
  updateItem: (playlistId: string, itemId: string, data: Partial<PlaylistItem>) => Promise<void>
  removeItem: (playlistId: string, itemId: string) => Promise<void>
  reorderItems: (playlistId: string, order: string[]) => Promise<void>
  setActivePlaylist: (playlist: Playlist | null) => void
}

export const usePlaylistStore = create<PlaylistState & PlaylistActions>((set) => ({
  // State
  playlists: [],
  total: 0,
  page: 1,
  loading: false,
  error: null,
  activePlaylist: null,

  fetchPlaylists: async (filters = {}) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.is_active !== undefined) params.set('is_active', String(filters.is_active))
      if (filters.page) params.set('page', String(filters.page))

      const qs = params.toString()
      const data = await api.get<PaginatedResponse<Playlist>>(
        `/api/playlists${qs ? `?${qs}` : ''}`
      )
      set({
        playlists: data.data as Playlist[],
        total: data.total,
        page: data.page,
        loading: false,
      })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch playlists' })
    }
  },

  fetchPlaylist: async (id) => {
    const playlist = await api.get<Playlist>(`/api/playlists/${id}`)
    set({ activePlaylist: playlist })
  },

  createPlaylist: async (data) => {
    const playlist = await api.post<Playlist>('/api/playlists', data)
    set((s) => ({ playlists: [playlist, ...s.playlists], total: s.total + 1 }))
    return playlist
  },

  updatePlaylist: async (id, data) => {
    const updated = await api.patch<Playlist>(`/api/playlists/${id}`, data)
    set((s) => ({
      playlists: s.playlists.map((p) => (p.id === id ? updated : p)),
      activePlaylist: s.activePlaylist?.id === id ? updated : s.activePlaylist,
    }))
  },

  deletePlaylist: async (id) => {
    await api.delete(`/api/playlists/${id}`)
    set((s) => ({
      playlists: s.playlists.filter((p) => p.id !== id),
      total: s.total - 1,
      activePlaylist: s.activePlaylist?.id === id ? null : s.activePlaylist,
    }))
  },

  addItem: async (playlistId, data) => {
    const item = await api.post<PlaylistItem>(`/api/playlists/${playlistId}/items`, data)
    set((s) => {
      if (!s.activePlaylist || s.activePlaylist.id !== playlistId) return s
      return {
        activePlaylist: {
          ...s.activePlaylist,
          items: [...s.activePlaylist.items, item].sort((a, b) => a.position - b.position),
        },
      }
    })
    return item
  },

  updateItem: async (playlistId, itemId, data) => {
    const updated = await api.patch<PlaylistItem>(
      `/api/playlists/${playlistId}/items/${itemId}`, data
    )
    set((s) => {
      if (!s.activePlaylist || s.activePlaylist.id !== playlistId) return s
      return {
        activePlaylist: {
          ...s.activePlaylist,
          items: s.activePlaylist.items.map((i) => (i.id === itemId ? updated : i)),
        },
      }
    })
  },

  removeItem: async (playlistId, itemId) => {
    await api.delete(`/api/playlists/${playlistId}/items/${itemId}`)
    set((s) => {
      if (!s.activePlaylist || s.activePlaylist.id !== playlistId) return s
      return {
        activePlaylist: {
          ...s.activePlaylist,
          items: s.activePlaylist.items
            .filter((i) => i.id !== itemId)
            .map((i, idx) => ({ ...i, position: idx })),
        },
      }
    })
  },

  reorderItems: async (playlistId, order) => {
    await api.patch(`/api/playlists/${playlistId}/items/reorder`, { order })
    set((s) => {
      if (!s.activePlaylist || s.activePlaylist.id !== playlistId) return s
      const byId = Object.fromEntries(s.activePlaylist.items.map((i) => [i.id, i]))
      const reordered = order
        .filter((id) => byId[id])
        .map((id, idx) => ({ ...byId[id], position: idx }))
      return { activePlaylist: { ...s.activePlaylist, items: reordered } }
    })
  },

  setActivePlaylist: (playlist) => set({ activePlaylist: playlist }),
}))
