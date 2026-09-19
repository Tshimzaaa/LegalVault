import { apiRequest } from './client'
import type { InquiryKind, InquiryStatus } from './inquiries'

export interface OrganizationSummary {
  id: string
  name: string
  email: string
  is_active: boolean
}

export interface OrganizationDetail extends OrganizationSummary {
  phone: string | null
  website: string | null
  address: string | null
  staff_count: number
  contract_count: number
}

export interface CreateOrganizationPayload {
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

export interface CreateOrganizationResponse {
  message: string
  organization_id: string
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

export async function listOrganizations(token: string): Promise<OrganizationSummary[]> {
  return apiRequest<OrganizationSummary[]>('/owner/orgs', { token })
}

export async function getOrganization(token: string, orgId: string): Promise<OrganizationDetail> {
  return apiRequest<OrganizationDetail>(`/owner/orgs/${orgId}`, { token })
}

export async function updateOrganizationStatus(token: string, orgId: string, isActive: boolean): Promise<OrganizationSummary> {
  return apiRequest<OrganizationSummary>(`/owner/orgs/${orgId}/status`, {
    method: 'PATCH',
    body: { is_active: isActive },
    token,
  })
}

export async function createOrganization(token: string, payload: CreateOrganizationPayload): Promise<CreateOrganizationResponse> {
  return apiRequest<CreateOrganizationResponse>('/owner/orgs', { method: 'POST', body: payload, token })
}

export async function deleteOrganization(token: string, orgId: string): Promise<void> {
  await apiRequest(`/owner/orgs/${orgId}`, { method: 'DELETE', token })
}

export interface OrganizationExportResponse {
  exported_at: string
  org: Record<string, unknown>
  staff: Record<string, unknown>[]
  contracts: Record<string, unknown>[]
  audit_log: Record<string, unknown>[]
}

export async function exportOrganization(token: string, orgId: string): Promise<OrganizationExportResponse> {
  return apiRequest<OrganizationExportResponse>(`/owner/orgs/${orgId}/export`, { token })
}

export interface UsageMetrics {
  total_orgs: number
  active_orgs: number
  inactive_orgs: number
  total_staff: number
  total_contracts: number
  contracts_by_status: Record<string, number>
  new_orgs_last_7_days: number
  new_orgs_last_30_days: number
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
  p95_duration_ms: number | null
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

export interface ServiceHealthEntry {
  name: string
  status: 'healthy' | 'degraded'
  request_count: number
  error_rate_percent: number
  avg_duration_ms: number | null
}

export interface DependencyHealth {
  name: string
  status: 'healthy' | 'degraded' | 'down'
  latency_ms: number | null
}

export interface EndpointStat {
  method: string
  path: string
  request_count: number
  error_count: number
  error_rate_percent: number
}

export interface RequestTimeseriesPoint {
  bucket: string
  request_count: number
  average_duration_ms: number | null
}

export interface SystemHealth {
  generated_at: string
  status: 'operational' | 'degraded' | 'down'
  uptime_seconds: number
  window_hours: number
  requests: RequestMetrics
  active_users: number
  online_orgs: number
  dependencies: DependencyHealth[]
  services: ServiceHealthEntry[]
  worst_endpoints: EndpointStat[]
  timeseries: RequestTimeseriesPoint[]
}

export async function getSystemHealth(token: string, hours = 24): Promise<SystemHealth> {
  return apiRequest<SystemHealth>(`/owner/system-health?hours=${hours}`, { token })
}

export interface Inquiry {
  id: string
  kind: InquiryKind
  status: InquiryStatus
  name: string
  email: string
  phone: string | null
  organization_name: string | null
  message: string | null
  owner_note: string | null
  handled_at: string | null
  organization_id: string | null
  created_at: string
}

export interface InquiryList {
  items: Inquiry[]
  total: number
}

export interface InquirySummary {
  new: number
  in_progress: number
  onboarded: number
  closed: number
  new_access_requests: number
  new_contact: number
}

export async function listInquiries(
  token: string,
  options: { status?: InquiryStatus; kind?: InquiryKind; limit?: number; offset?: number } = {},
): Promise<InquiryList> {
  const params = new URLSearchParams()
  if (options.status) params.set('status', options.status)
  if (options.kind) params.set('kind', options.kind)
  params.set('limit', String(options.limit ?? 50))
  params.set('offset', String(options.offset ?? 0))
  return apiRequest<InquiryList>(`/owner/inquiries?${params.toString()}`, { token })
}

export async function getInquirySummary(token: string): Promise<InquirySummary> {
  return apiRequest<InquirySummary>('/owner/inquiries/summary', { token })
}

export async function updateInquiry(
  token: string,
  inquiryId: string,
  patch: { status?: InquiryStatus; owner_note?: string | null; organization_id?: string | null },
): Promise<Inquiry> {
  return apiRequest<Inquiry>(`/owner/inquiries/${inquiryId}`, { method: 'PATCH', body: patch, token })
}

export async function deleteInquiry(token: string, inquiryId: string): Promise<void> {
  await apiRequest(`/owner/inquiries/${inquiryId}`, { method: 'DELETE', token })
}
