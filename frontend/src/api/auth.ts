const BASE_URL = 'http://127.0.0.1:8000'

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
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => null)
    throw new Error(errorData?.detail || 'Login failed')
  }

  const data = await res.json()
  return data.access_token
}

export async function getCurrentUser(token: string): Promise<User> {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new Error('Not authenticated')
  }

  return res.json()
}
