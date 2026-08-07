import { apiRequest } from './client'

export interface ClientContact {
  id: string
  client_id: string
  first_name: string
  last_name: string
  email: string
  is_active: boolean
  invitation_status: string
  last_login: string | null
}

export interface ClientAuthTokens {
  accessToken: string
  refreshToken: string
}

export async function clientLogin(email: string, password: string): Promise<ClientAuthTokens> {
  const data = await apiRequest<{ access_token: string; refresh_token: string }>('/client-auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuthRedirect: true,
  })
  return { accessToken: data.access_token, refreshToken: data.refresh_token }
}

/** Silently exchanges a refresh token for a fresh access/refresh pair. skipAuthRedirect since a
 * failed refresh is the expected end of a session, not something the global 401 handler should
 * react to — the caller (App's refresh handler) decides what happens next. */
export async function refreshClientToken(refreshToken: string): Promise<ClientAuthTokens> {
  const data = await apiRequest<{ access_token: string; refresh_token: string }>('/client-auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken },
    skipAuthRedirect: true,
  })
  return { accessToken: data.access_token, refreshToken: data.refresh_token }
}

/** Revokes the refresh token server-side so a logged-out session can't be silently resumed. */
export async function logoutClient(refreshToken: string): Promise<void> {
  await apiRequest('/client-auth/logout', {
    method: 'POST',
    body: { refresh_token: refreshToken },
    skipAuthRedirect: true,
  })
}

export async function getCurrentContact(token: string): Promise<ClientContact> {
  return apiRequest<ClientContact>('/client-auth/me', { token })
}

export async function clientForgotPassword(email: string): Promise<void> {
  await apiRequest('/client-auth/forgot-password', { method: 'POST', body: { email }, skipAuthRedirect: true })
}

export async function clientResetPassword(token: string, newPassword: string): Promise<void> {
  await apiRequest('/client-auth/reset-password', {
    method: 'POST',
    body: { token, new_password: newPassword },
    skipAuthRedirect: true,
  })
}

export async function acceptInvite(token: string, password: string): Promise<ClientContact> {
  return apiRequest<ClientContact>('/client-auth/accept-invite', {
    method: 'POST',
    body: { token, password },
    skipAuthRedirect: true,
  })
}
