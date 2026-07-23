import { apiRequest } from './client'

export interface User {
  id: string
  firm_id: string
  first_name: string
  last_name: string
  email: string
  role: string
  is_active: boolean
  last_login: string | null
}

export async function login(email: string, password: string): Promise<string> {
  const data = await apiRequest<{ access_token: string }>('/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuthRedirect: true,
  })
  return data.access_token
}

export async function getCurrentUser(token: string): Promise<User> {
  return apiRequest<User>('/auth/me', { token })
}
