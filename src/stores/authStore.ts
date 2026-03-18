import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '../services/apiClient'
import { wsService } from '../services/wsService'
import type { User, Organization, AuthResponse } from '../types'

interface LoginCredentials {
  org_slug: string
  email: string
  password: string
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  organization: Organization | null
  isAuthenticated: boolean
}

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  setTokens: (accessToken: string, refreshToken: string) => void
  setUser: (user: User, organization: Organization) => void
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      // State
      accessToken: null,
      refreshToken: null,
      user: null,
      organization: null,
      isAuthenticated: false,

      // Actions
      login: async (credentials) => {
        const data = await api.post<AuthResponse>('/api/auth/login', credentials)
        set({
          accessToken: data.tokens.access_token,
          refreshToken: data.tokens.refresh_token,
          user: data.user,
          organization: data.organization,
          isAuthenticated: true,
        })
        wsService.connect(data.tokens.access_token)
      },

      logout: () => {
        wsService.disconnect()
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          organization: null,
          isAuthenticated: false,
        })
      },

      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken })
        // Reconnect WS with new token if already was connected
        if (get().isAuthenticated) {
          wsService.connect(accessToken)
        }
      },

      setUser: (user, organization) => {
        set({ user, organization })
      },
    }),
    {
      name: 'vant-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        organization: state.organization,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
