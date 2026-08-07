import { apiRequest } from './client'

export type SupportRequestType = 'nda' | 'consultancy' | 'supplier' | 'general'
export type SupportRequestPriority = 'high' | 'medium' | 'low'
export type SupportRequestStatus = 'open' | 'in_progress' | 'resolved'

export interface SupportRequest {
  id: string
  firm_id: string
  client_id: string
  contact_id: string
  request_type: SupportRequestType
  counterparty: string | null
  priority: SupportRequestPriority
  needed_by: string | null
  description: string
  reference_documents: string | null
  status: SupportRequestStatus
  created_at: string
  updated_at: string
}

export interface CreateSupportRequestBody {
  request_type: SupportRequestType
  counterparty?: string | null
  priority?: SupportRequestPriority
  needed_by?: string | null
  description: string
  reference_documents?: string | null
}

export async function createSupportRequest(
  token: string,
  body: CreateSupportRequestBody,
): Promise<SupportRequest> {
  return apiRequest<SupportRequest>('/client-support-requests', { method: 'POST', body, token })
}

export async function listMySupportRequests(token: string): Promise<SupportRequest[]> {
  return apiRequest<SupportRequest[]>('/client-support-requests', { token })
}

export async function listSupportRequestsForFirm(token: string): Promise<SupportRequest[]> {
  return apiRequest<SupportRequest[]>('/support-requests', { token })
}

export async function updateSupportRequestStatus(
  token: string,
  supportRequestId: string,
  status: SupportRequestStatus,
): Promise<SupportRequest> {
  return apiRequest<SupportRequest>(`/support-requests/${supportRequestId}/status`, {
    method: 'PATCH',
    body: { status },
    token,
  })
}
