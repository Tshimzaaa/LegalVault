export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

/** Called whenever a request comes back 401 and a token refresh wasn't possible. Wired up once by the app shell so it can clear the session and redirect to login. */
let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

/**
 * Called on a 401 to silently obtain a fresh access token (via the staff refresh-token
 * endpoint) before giving up and logging the user out. Returns the new access token, or null if
 * no refresh was possible/it failed. Wired up once by the app shell, alongside the actor's session.
 */
let refreshHandler: (() => Promise<string | null>) | null = null

export function setRefreshHandler(handler: () => Promise<string | null>) {
  refreshHandler = handler
}

// Concurrent 401s must share one in-flight refresh — refresh tokens are single-use/rotated, so
// firing it twice would have the second call invalidate the token the first one just issued.
let refreshInFlight: Promise<string | null> | null = null

function refreshAccessToken(): Promise<string | null> {
  if (!refreshHandler) return Promise.resolve(null)
  if (!refreshInFlight) {
    refreshInFlight = refreshHandler().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

export interface ApiRequestOptions {
  method?: string
  body?: unknown
  token?: string | null
  /** Skip the global 401 handler (and refresh attempt), e.g. for the login request itself. */
  skipAuthRedirect?: boolean
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function rawFetch(path: string, method: string, token: string | null | undefined, body: unknown): Promise<Response> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  return fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

async function finish<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => null)
    throw new ApiError(res.status, errorData?.detail || `Request failed (${res.status})`)
  }

  if (res.status === 204) return undefined as T

  return res.json()
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, skipAuthRedirect } = options

  let res = await rawFetch(path, method, token, body)

  if (res.status === 401 && !skipAuthRedirect) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      res = await rawFetch(path, method, newToken, body)
    }
    if (res.status === 401) {
      onUnauthorized?.()
    }
  }

  return finish<T>(res)
}

/** Multipart form upload — apiRequest always JSON-encodes its body, which can't carry a File. */
export async function apiUpload<T>(path: string, formData: FormData, token: string): Promise<T> {
  const doUpload = (t: string) =>
    fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
      body: formData,
    })

  let res = await doUpload(token)

  if (res.status === 401) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      res = await doUpload(newToken)
    }
    if (res.status === 401) {
      onUnauthorized?.()
    }
  }

  return finish<T>(res)
}
