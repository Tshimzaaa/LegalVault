import { apiRequest } from './client'

export interface FirmSummary {
  id: string
  name: string
  email: string
  is_active: boolean
}

export interface FirmDetail extends FirmSummary {
  phone: string | null
  website: string | null
  address: string | null
  staff_count: number
  client_count: number
  matter_count: number
}

export interface CreateFirmPayload {
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

export interface CreateFirmResponse {
  message: string
  law_firm_id: string
  user_id: string
}

export async function ownerLogin(secret: string): Promise<string> {
  const data = await apiRequest<{ access_token: string }>('/owner/login', {
    method: 'POST',
    body: { secret },
    skipAuthRedirect: true,
  })
  return data.access_token
}

export async function listFirms(token: string): Promise<FirmSummary[]> {
  return apiRequest<FirmSummary[]>('/owner/firms', { token })
}

export async function getFirm(token: string, firmId: string): Promise<FirmDetail> {
  return apiRequest<FirmDetail>(`/owner/firms/${firmId}`, { token })
}

export async function updateFirmStatus(token: string, firmId: string, isActive: boolean): Promise<FirmSummary> {
  return apiRequest<FirmSummary>(`/owner/firms/${firmId}/status`, {
    method: 'PATCH',
    body: { is_active: isActive },
    token,
  })
}

export async function createFirm(token: string, payload: CreateFirmPayload): Promise<CreateFirmResponse> {
  return apiRequest<CreateFirmResponse>('/owner/firms', { method: 'POST', body: payload, token })
}

export async function deleteFirm(token: string, firmId: string): Promise<void> {
  await apiRequest(`/owner/firms/${firmId}`, { method: 'DELETE', token })
}
