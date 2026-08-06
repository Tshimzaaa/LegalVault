import { apiRequest } from './client'

export type UserRole = 'admin' | 'lawyer' | 'paralegal' | 'secretary' | 'receptionist'

export interface User {
  id: string
  firm_id: string
  first_name: string
  last_name: string
  email: string
  role: UserRole
  is_active: boolean
  invitation_status: string
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

export async function listUsers(token: string): Promise<User[]> {
  return apiRequest<User[]>('/auth/users', { token })
}

export interface InviteStaffPayload {
  first_name: string
  last_name: string
  email: string
  role: UserRole
}

export interface InviteStaffResponse extends User {
  invitation_token: string | null
}

export async function inviteStaff(token: string, payload: InviteStaffPayload): Promise<InviteStaffResponse> {
  return apiRequest<InviteStaffResponse>('/auth/invite-staff', { method: 'POST', body: payload, token })
}

export async function acceptStaffInvite(inviteToken: string, password: string): Promise<User> {
  return apiRequest<User>('/auth/accept-staff-invite', {
    method: 'POST',
    body: { token: inviteToken, password },
    skipAuthRedirect: true,
  })
}

export async function updateStaffStatus(token: string, staffId: string, isActive: boolean): Promise<User> {
  return apiRequest<User>(`/auth/users/${staffId}/status`, {
    method: 'PATCH',
    body: { is_active: isActive },
    token,
  })
}

export async function forgotPassword(email: string): Promise<void> {
  await apiRequest('/auth/forgot-password', { method: 'POST', body: { email }, skipAuthRedirect: true })
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiRequest('/auth/reset-password', {
    method: 'POST',
    body: { token, new_password: newPassword },
    skipAuthRedirect: true,
  })
}

export interface RegisterPayload {
  admin_secret: string
  law_firm: {
    name: string
    email: string
    phone?: string | null
    website?: string | null
    address?: string | null
  }
  admin: {
    first_name: string
    last_name: string
    email: string
    password: string
  }
}

export interface RegisterResponse {
  message: string
  law_firm_id: string
  user_id: string
  access_token: string
  token_type: string
}

export async function register(payload: RegisterPayload): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: payload,
    skipAuthRedirect: true,
  })
}

export interface FirmProfile {
  id: string
  name: string
  email: string
  phone: string | null
  website: string | null
  address: string | null
  is_active: boolean
}

export interface UpdateFirmProfilePayload {
  name?: string
  email?: string
  phone?: string | null
  website?: string | null
  address?: string | null
}

export async function getFirmProfile(token: string): Promise<FirmProfile> {
  return apiRequest<FirmProfile>('/auth/firm', { token })
}

export async function updateFirmProfile(token: string, payload: UpdateFirmProfilePayload): Promise<FirmProfile> {
  return apiRequest<FirmProfile>('/auth/firm', { method: 'PATCH', body: payload, token })
}
