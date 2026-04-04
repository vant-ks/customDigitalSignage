import { create } from 'zustand'
import { api } from '../services/apiClient'
import type { Display, TelemetryDataPoint, TelemetryResponse } from '../types'

export type TelemetryPeriod = '1h' | '6h' | '24h' | '7d' | '30d'

interface MonitoringState {
  // Fleet summary
  displays: Display[]
  loading: boolean
  error: string | null
  // Per-display telemetry history (keyed by display_id)
  telemetryHistory: Record<string, TelemetryDataPoint[]>
  telemetryLoading: Record<string, boolean>
}

interface MonitoringActions {
  fetchFleet: () => Promise<void>
  fetchTelemetry: (displayId: string, period?: TelemetryPeriod) => Promise<void>
}

export const useMonitoringStore = create<MonitoringState & MonitoringActions>((set) => ({
  displays: [],
  loading: false,
  error: null,
  telemetryHistory: {},
  telemetryLoading: {},

  fetchFleet: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api.get<{ data: Display[]; total: number }>(
        '/api/displays?per_page=500'
      )
      set({ displays: data.data, loading: false })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch fleet',
      })
    }
  },

  fetchTelemetry: async (displayId, period = '24h') => {
    set((s) => ({ telemetryLoading: { ...s.telemetryLoading, [displayId]: true } }))
    try {
      const data = await api.get<TelemetryResponse>(
        `/api/displays/${displayId}/telemetry?period=${period}`
      )
      set((s) => ({
        telemetryHistory: { ...s.telemetryHistory, [displayId]: data.data },
        telemetryLoading: { ...s.telemetryLoading, [displayId]: false },
      }))
    } catch {
      set((s) => ({ telemetryLoading: { ...s.telemetryLoading, [displayId]: false } }))
    }
  },
}))
