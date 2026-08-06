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

export interface FirmExportResponse {
  exported_at: string
  firm: Record<string, unknown>
  staff: Record<string, unknown>[]
  clients: Record<string, unknown>[]
  matters: Record<string, unknown>[]
  audit_log: Record<string, unknown>[]
}

export async function exportFirm(token: string, firmId: string): Promise<FirmExportResponse> {
  return apiRequest<FirmExportResponse>(`/owner/firms/${firmId}/export`, { token })
}

export interface UsageMetrics {
  total_firms: number
  active_firms: number
  inactive_firms: number
  total_staff: number
  total_clients: number
  total_matters: number
  matters_by_status: Record<string, number>
  new_firms_last_7_days: number
  new_firms_last_30_days: number
}

export interface TopErrorPath {
  path: string
  status_code: number
  count: number
}

export interface RequestMetrics {
  window_hours: number
  total_requests: number
  status_2xx: number
  status_3xx: number
  status_4xx: number
  status_5xx: number
  error_rate_percent: number
  average_duration_ms: number | null
  top_error_paths: TopErrorPath[]
}

export interface PlatformMetrics {
  generated_at: string
  usage: UsageMetrics
  requests: RequestMetrics
}

export async function getPlatformMetrics(token: string, hours = 24): Promise<PlatformMetrics> {
  return apiRequest<PlatformMetrics>(`/owner/metrics?hours=${hours}`, { token })
}

export interface RequestErrorEntry {
  id: string
  created_at: string
  method: string
  path: string
  status_code: number
  duration_ms: number
  error_detail: string | null
  actor_type: string | null
  actor_id: string | null
  actor_label: string | null
}

export async function listRecentErrors(
  token: string,
  { hours = 24, limit = 50, offset = 0 }: { hours?: number; limit?: number; offset?: number } = {},
): Promise<RequestErrorEntry[]> {
  const params = new URLSearchParams({ hours: String(hours), limit: String(limit), offset: String(offset) })
  return apiRequest<RequestErrorEntry[]>(`/owner/errors?${params}`, { token })
}
