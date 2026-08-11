import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, apiUpload, ApiError, setRefreshHandler, setUnauthorizedHandler } from './client'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

describe('apiRequest', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    // Reset module-level handler state between tests — these are plain singletons.
    setRefreshHandler(async () => null)
    setUnauthorizedHandler(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns parsed JSON on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ id: '1' }))

    const result = await apiRequest<{ id: string }>('/things', { token: 'tok' })

    expect(result).toEqual({ id: '1' })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })

  it('returns undefined for a 204 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null, 204))

    const result = await apiRequest('/things/1', { method: 'DELETE', token: 'tok' })

    expect(result).toBeUndefined()
  })

  it('throws ApiError with the server detail message on failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: 'Nope, not allowed.' }, 403))

    await expect(apiRequest('/things', { token: 'tok' })).rejects.toMatchObject(
      new ApiError(403, 'Nope, not allowed.'),
    )
  })

  it('on 401, refreshes the token and retries once with the new token', async () => {
    const refresh = vi.fn().mockResolvedValue('new-token')
    setRefreshHandler(refresh)

    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))

    const result = await apiRequest('/things', { token: 'old-token' })

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledTimes(2)
    const [, secondInit] = vi.mocked(fetch).mock.calls[1]
    expect((secondInit?.headers as Record<string, string>).Authorization).toBe('Bearer new-token')
  })

  it('calls the unauthorized handler when refresh fails to produce a token', async () => {
    setRefreshHandler(async () => null)
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, 401))

    await expect(apiRequest('/things', { token: 'old-token' })).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    // No retry attempted since there was no new token to retry with.
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not attempt a refresh when skipAuthRedirect is set', async () => {
    const refresh = vi.fn().mockResolvedValue('new-token')
    setRefreshHandler(refresh)

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: 'bad creds' }, 401))

    await expect(apiRequest('/auth/login', { skipAuthRedirect: true })).rejects.toBeInstanceOf(ApiError)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('dedupes concurrent refreshes — two 401s in flight share one refresh call', async () => {
    let resolveRefresh: (token: string) => void
    const refresh = vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          resolveRefresh = resolve
        }),
    )
    setRefreshHandler(refresh)

    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, 401)) // request A, first attempt
      .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, 401)) // request B, first attempt
      .mockResolvedValueOnce(jsonResponse({ a: true })) // request A, retry
      .mockResolvedValueOnce(jsonResponse({ b: true })) // request B, retry

    const requestA = apiRequest('/a', { token: 'old' })
    const requestB = apiRequest('/b', { token: 'old' })

    // Let both requests reach the point of awaiting the refresh before resolving it.
    await Promise.resolve()
    await Promise.resolve()
    resolveRefresh!('new-token')

    const [resultA, resultB] = await Promise.all([requestA, requestB])

    expect(resultA).toEqual({ a: true })
    expect(resultB).toEqual({ b: true })
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})

describe('apiUpload', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    setRefreshHandler(async () => null)
    setUnauthorizedHandler(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the form data with an Authorization header and returns parsed JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ id: 'doc-1' }, 201))

    const form = new FormData()
    form.append('title', 'A document')

    const result = await apiUpload<{ id: string }>('/templates', form, 'tok')

    expect(result).toEqual({ id: 'doc-1' })
    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(init?.body).toBe(form)
  })

  it('retries once after a refresh on 401', async () => {
    setRefreshHandler(async () => 'new-token')
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ id: 'doc-2' }, 201))

    const result = await apiUpload('/templates', new FormData(), 'old-token')

    expect(result).toEqual({ id: 'doc-2' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
