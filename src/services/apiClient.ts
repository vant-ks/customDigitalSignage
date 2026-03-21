/**
 * Fetch wrapper with JWT interceptor, auto-refresh, and retry.
 * All API calls go through this client.
 */

import { useAuthStore } from '../stores/authStore'

const API_BASE = '/api'

class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public raw?: unknown,
  ) {
    super(detail)
    this.name = 'ApiError'
  }
}

async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) return body.detail.map((e: { msg: string }) => e.msg).join('; ')
    return res.statusText
  } catch {
    return res.statusText
  }
}

let isRefreshing = false
let refreshQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = []

async function performRefresh(): Promise<string> {
  const store = useAuthStore.getState()
  const refreshToken = store.refreshToken
  if (!refreshToken) throw new ApiError(401, 'No refresh token')

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!res.ok) {
    store.logout()
    throw new ApiError(401, 'Session expired')
  }

  const data = await res.json()
  store.setTokens(data.tokens.access_token, data.tokens.refresh_token)
  return data.tokens.access_token
}

async function getAccessToken(): Promise<string> {
  const store = useAuthStore.getState()
  const token = store.accessToken
  if (token) return token
  return performRefresh()
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = await getAccessToken()

  // For multipart uploads the caller passes headers:{} to suppress Content-Type
  // so the browser can set it with the correct boundary. Otherwise default to JSON.
  const isMultipart = options.body instanceof FormData
  const defaultHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(isMultipart ? {} : { 'Content-Type': 'application/json' }),
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  })

  if (res.status === 401 && retry) {
    // Token may have expired mid-session — attempt refresh once
    if (isRefreshing) {
      const newToken = await new Promise<string>((resolve, reject) => {
        refreshQueue.push({ resolve, reject })
      })
      return apiRequest<T>(path, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${newToken}` },
      }, false)
    }

    isRefreshing = true
    try {
      const newToken = await performRefresh()
      refreshQueue.forEach(({ resolve }) => resolve(newToken))
      refreshQueue = []
      return apiRequest<T>(path, options, false)
    } catch (err) {
      refreshQueue.forEach(({ reject }) => reject(err))
      refreshQueue = []
      throw err
    } finally {
      isRefreshing = false
    }
  }

  if (res.status === 204) return undefined as T

  if (!res.ok) {
    const detail = await parseErrorDetail(res)
    throw new ApiError(res.status, detail)
  }

  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
  /** Multipart upload — browser sets Content-Type with boundary automatically */
  upload: <T>(path: string, formData: FormData) =>
    apiRequest<T>(path, { method: 'POST', body: formData }),
}

export { ApiError }
