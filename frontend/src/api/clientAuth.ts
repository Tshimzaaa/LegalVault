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

export async function clientLogin(email: string, password: string): Promise<string> {
  const data = await apiRequest<{ access_token: string }>('/client-auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuthRedirect: true,
  })
  return data.access_token
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
