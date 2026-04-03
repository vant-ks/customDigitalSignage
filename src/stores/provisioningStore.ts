import { create } from 'zustand'
import { api } from '../services/apiClient'
import { useAuthStore } from './authStore'
import type { ProvisioningToken } from '../types'

interface ProvisioningTokenCreate {
  display_id?: string | null
  hardware_type?: string | null
  config?: Record<string, unknown>
  expires_hours?: number
}

interface ProvisioningState {
  tokens: ProvisioningToken[]
  loading: boolean
  error: string | null
  // Newly-created token (shown in wizard success step)
  createdToken: ProvisioningToken | null
}

interface ProvisioningActions {
  fetchTokens: (isUsed?: boolean) => Promise<void>
  createToken: (data: ProvisioningTokenCreate) => Promise<ProvisioningToken>
  revokeToken: (id: string) => Promise<void>
  downloadConfig: (id: string) => Promise<void>
  clearCreatedToken: () => void
}

export const useProvisioningStore = create<ProvisioningState & ProvisioningActions>((set, get) => ({
  tokens: [],
  loading: false,
  error: null,
  createdToken: null,

  fetchTokens: async (isUsed?: boolean) => {
    set({ loading: true, error: null })
    try {
      const qs = isUsed !== undefined ? `?is_used=${isUsed}` : ''
      const data = await api.get<ProvisioningToken[]>(`/api/provisioning/tokens${qs}`)
      set({ tokens: data, loading: false })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch tokens' })
    }
  },

  createToken: async (data) => {
    const token = await api.post<ProvisioningToken>('/api/provisioning/tokens', {
      expires_hours: 24,
      config: {},
      ...data,
    })
    set((s) => ({ tokens: [token, ...s.tokens], createdToken: token }))
    return token
  },

  revokeToken: async (id) => {
    await api.delete(`/api/provisioning/tokens/${id}`)
    set((s) => ({ tokens: s.tokens.filter((t) => t.id !== id) }))
  },

  /**
   * Download config.yaml for a token — triggers a browser file download.
   * Uses a raw fetch with the current access token since the response is YAML text,
   * not JSON, so the normal api helper can't parse it.
   */
  downloadConfig: async (id) => {
    const { accessToken } = useAuthStore.getState()
    const res = await fetch(`/api/provisioning/tokens/${id}/config.yaml`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error('Failed to download config')

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const token = get().tokens.find((t) => t.id === id) ?? get().createdToken
    a.download = token ? `config-${token.token.slice(0, 16)}.yaml` : 'config.yaml'
    a.click()
    URL.revokeObjectURL(url)
  },

  clearCreatedToken: () => set({ createdToken: null }),
}))

