import { apiRequest } from './client'

export type UserRole = 'admin' | 'lawyer' | 'paralegal' | 'secretary' | 'receptionist'

export interface User {
  id: string
  org_id: string
  first_name: string
  last_name: string
  email: string
  role: UserRole
  is_active: boolean
  invitation_status: string
  last_login: string | null
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const data = await apiRequest<{ access_token: string; refresh_token: string }>('/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuthRedirect: true,
  })
  return { accessToken: data.access_token, refreshToken: data.refresh_token }
}

/** Silently exchanges a refresh token for a fresh access/refresh pair. skipAuthRedirect since a
 * failed refresh is the expected end of a session, not something the global 401 handler should
 * react to — the caller (App's refresh handler) decides what happens next. */
export async function refreshStaffToken(refreshToken: string): Promise<AuthTokens> {
  const data = await apiRequest<{ access_token: string; refresh_token: string }>('/auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken },
    skipAuthRedirect: true,
  })
  return { accessToken: data.access_token, refreshToken: data.refresh_token }
}

/** Revokes the refresh token server-side so a logged-out session can't be silently resumed. */
export async function logoutStaff(refreshToken: string): Promise<void> {
  await apiRequest('/auth/logout', {
    method: 'POST',
    body: { refresh_token: refreshToken },
    skipAuthRedirect: true,
  })
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

export async function forceLogoutStaff(token: string, staffId: string): Promise<void> {
  await apiRequest(`/auth/users/${staffId}/force-logout`, { method: 'POST', token })
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
  organization: {
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
  organization_id: string
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

export interface OrganizationProfile {
  id: string
  name: string
  email: string
  phone: string | null
  website: string | null
  address: string | null
  is_active: boolean
}

export interface UpdateOrganizationProfilePayload {
  name?: string
  email?: string
  phone?: string | null
  website?: string | null
  address?: string | null
}

export async function getOrganizationProfile(token: string): Promise<OrganizationProfile> {
  return apiRequest<OrganizationProfile>('/auth/org', { token })
}

export async function updateOrganizationProfile(token: string, payload: UpdateOrganizationProfilePayload): Promise<OrganizationProfile> {
  return apiRequest<OrganizationProfile>('/auth/org', { method: 'PATCH', body: payload, token })
}
