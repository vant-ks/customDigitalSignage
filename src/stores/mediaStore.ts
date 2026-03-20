import { create } from 'zustand'
import { api } from '../services/apiClient'
import type { MediaAsset, PaginatedResponse } from '../types'

export interface StorageProvider {
  id: string
  org_id: string
  provider_type: 'dropbox' | 'gdrive' | 'onedrive'
  label: string
  root_folder: string | null
  is_active: boolean
  last_sync_at: string | null
  created_at: string
  updated_at: string
}

export interface FileEntry {
  name: string
  path: string
  is_folder: boolean
  size_bytes: number | null
  modified_at: string | null
  mime_type: string | null
  thumbnail_url: string | null
}

interface MediaFilters {
  file_type?: string
  folder?: string
  search?: string
  tags?: string
  processing_status?: string
  page?: number
}

interface MediaState {
  assets: MediaAsset[]
  total: number
  page: number
  loading: boolean
  error: string | null
  providers: StorageProvider[]
  browseEntries: FileEntry[]
  browseHasMore: boolean
  browseCursor: string | null
  browseLoading: boolean
}

interface MediaActions {
  fetchAssets: (filters?: MediaFilters) => Promise<void>
  registerAsset: (data: {
    storage_id: string
    name: string
    source_path: string
    file_type: string
    mime_type?: string
    folder?: string
    tags?: string[]
  }) => Promise<MediaAsset>
  updateAsset: (id: string, data: Partial<Pick<MediaAsset, 'name' | 'folder' | 'tags' | 'template_data'>>) => Promise<void>
  deleteAsset: (id: string) => Promise<void>
  getDownloadUrl: (id: string) => Promise<string>
  fetchProviders: () => Promise<void>
  getOAuthUrl: (providerType: string, redirectUri: string) => Promise<{ auth_url: string; state: string }>
  exchangeOAuth: (code: string, state: string, label: string) => Promise<StorageProvider>
  disconnectProvider: (id: string) => Promise<void>
  browseProvider: (providerId: string, path?: string, cursor?: string | null) => Promise<void>
  clearBrowse: () => void
}

export const useMediaStore = create<MediaState & MediaActions>((set) => ({
  // State
  assets: [],
  total: 0,
  page: 1,
  loading: false,
  error: null,
  providers: [],
  browseEntries: [],
  browseHasMore: false,
  browseCursor: null,
  browseLoading: false,

  // ── Asset actions ──────────────────────────────────────────────────────

  fetchAssets: async (filters = {}) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (filters.file_type) params.set('file_type', filters.file_type)
      if (filters.folder) params.set('folder', filters.folder)
      if (filters.search) params.set('search', filters.search)
      if (filters.tags) params.set('tags', filters.tags)
      if (filters.processing_status) params.set('processing_status', filters.processing_status)
      if (filters.page) params.set('page', String(filters.page))

      const qs = params.toString()
      const data = await api.get<PaginatedResponse<MediaAsset>>(
        `/api/media${qs ? `?${qs}` : ''}`
      )
      set({
        assets: data.data as MediaAsset[],
        total: data.total,
        page: data.page,
        loading: false,
      })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch media' })
    }
  },

  registerAsset: async (data) => {
    const asset = await api.post<MediaAsset>('/api/media', data)
    set((s) => ({ assets: [asset, ...s.assets], total: s.total + 1 }))
    return asset
  },

  updateAsset: async (id, data) => {
    const updated = await api.patch<MediaAsset>(`/api/media/${id}`, data)
    set((s) => ({
      assets: s.assets.map((a) => (a.id === id ? updated : a)),
    }))
  },

  deleteAsset: async (id) => {
    await api.delete(`/api/media/${id}`)
    set((s) => ({ assets: s.assets.filter((a) => a.id !== id), total: s.total - 1 }))
  },

  getDownloadUrl: async (id) => {
    const data = await api.get<{ download_url: string }>(`/api/media/${id}/download-url`)
    return data.download_url
  },

  // ── Provider actions ───────────────────────────────────────────────────

  fetchProviders: async () => {
    const providers = await api.get<StorageProvider[]>('/api/storage-providers')
    set({ providers })
  },

  getOAuthUrl: async (providerType, redirectUri) => {
    const params = new URLSearchParams({ redirect_uri: redirectUri })
    return api.get<{ auth_url: string; state: string }>(
      `/api/storage-providers/auth-url/${providerType}?${params}`
    )
  },

  exchangeOAuth: async (code, state, label) => {
    const provider = await api.post<StorageProvider>('/api/storage-providers/oauth/exchange', {
      code,
      state,
      label,
    })
    set((s) => ({ providers: [...s.providers, provider] }))
    return provider
  },

  disconnectProvider: async (id) => {
    await api.delete(`/api/storage-providers/${id}`)
    set((s) => ({ providers: s.providers.filter((p) => p.id !== id) }))
  },

  browseProvider: async (providerId, path = '/', cursor = null) => {
    set({ browseLoading: true })
    try {
      const params = new URLSearchParams({ path })
      if (cursor) params.set('cursor', cursor)
      const data = await api.get<{
        entries: FileEntry[]
        cursor: string | null
        has_more: boolean
      }>(`/api/storage-providers/${providerId}/browse?${params}`)
      set((s) => ({
        browseEntries: cursor ? [...s.browseEntries, ...data.entries] : data.entries,
        browseHasMore: data.has_more,
        browseCursor: data.cursor,
        browseLoading: false,
      }))
    } catch (err) {
      set({ browseLoading: false, error: err instanceof Error ? err.message : 'Browse failed' })
    }
  },

  clearBrowse: () => set({ browseEntries: [], browseHasMore: false, browseCursor: null }),
}))
