export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

/** Called whenever a request comes back 401. Wired up once by the app shell so it can clear the session and redirect to login. */
let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

export interface ApiRequestOptions {
  method?: string
  body?: unknown
  token?: string | null
  /** Skip the global 401 handler, e.g. for the login request itself. */
  skipAuthRedirect?: boolean
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, skipAuthRedirect } = options

  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && !skipAuthRedirect) {
    onUnauthorized?.()
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => null)
    throw new ApiError(res.status, errorData?.detail || `Request failed (${res.status})`)
  }

  if (res.status === 204) return undefined as T

  return res.json()
}
