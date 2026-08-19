import { apiRequest } from './client'

export type SignatureRecipientType = 'staff' | 'client_contact'
export type SignatureRequestStatus = 'pending' | 'completed' | 'declined' | 'voided'
export type SignatureRecipientStatus = 'pending' | 'signed' | 'declined'

export interface SignatureRecipient {
  id: string
  recipient_type: SignatureRecipientType
  recipient_id: string
  name: string
  email: string
  signing_order: number
  status: SignatureRecipientStatus
  signing_url: string
  signed_at: string | null
}

export interface SignatureRequest {
  id: string
  matter_id: string
  client_id: string
  source_document_id: string
  title: string
  status: SignatureRequestStatus
  requested_by: string
  completed_at: string | null
  signed_contract_id: string | null
  recipients: SignatureRecipient[]
  created_at: string
}

export interface CreateSignatureRequestBody {
  source_document_id: string
  title: string
  recipients: { recipient_type: SignatureRecipientType; recipient_id: string }[]
}

export async function listSignatureRequests(token: string, matterId: string): Promise<SignatureRequest[]> {
  return apiRequest<SignatureRequest[]>(`/matters/${matterId}/signatures`, { token })
}

export async function sendForSignature(
  token: string,
  matterId: string,
  body: CreateSignatureRequestBody,
): Promise<SignatureRequest> {
  return apiRequest<SignatureRequest>(`/matters/${matterId}/signatures`, { method: 'POST', body, token })
}

export async function voidSignatureRequest(
  token: string,
  matterId: string,
  signatureRequestId: string,
): Promise<SignatureRequest> {
  return apiRequest<SignatureRequest>(`/matters/${matterId}/signatures/${signatureRequestId}/void`, {
    method: 'POST',
    token,
  })
}

export async function listMyPendingStaffSignatures(token: string): Promise<SignatureRequest[]> {
  return apiRequest<SignatureRequest[]>('/signatures/mine', { token })
}

export async function listMyPendingClientSignatures(token: string): Promise<SignatureRequest[]> {
  return apiRequest<SignatureRequest[]>('/client-signatures', { token })
}
