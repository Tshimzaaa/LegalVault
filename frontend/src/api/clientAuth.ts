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
