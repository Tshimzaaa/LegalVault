import { apiRequest } from './client'

export type SignatureRecipientType = 'staff'
export type SignatureRequestStatus = 'pending' | 'completed' | 'declined' | 'voided'
export type SignatureRecipientStatus = 'pending' | 'signed' | 'declined'

export interface SignatureRecipient {
  id: string
  recipient_type: SignatureRecipientType | null
  recipient_id: string | null
  external_name: string | null
  external_email: string | null
  name: string
  email: string
  signing_order: number
  status: SignatureRecipientStatus
  signing_url: string
  signed_at: string | null
}

export interface SignatureRequest {
  id: string
  contract_id: string
  source_document_id: string
  title: string
  status: SignatureRequestStatus
  requested_by: string
  completed_at: string | null
  signed_contract_id: string | null
  recipients: SignatureRecipient[]
  created_at: string
}

export interface SignatureRecipientInput {
  recipient_id?: string
  external_name?: string
  external_email?: string
}

export interface CreateSignatureRequestBody {
  source_document_id: string
  title: string
  recipients: SignatureRecipientInput[]
}

export async function listSignatureRequests(token: string, contractId: string): Promise<SignatureRequest[]> {
  return apiRequest<SignatureRequest[]>(`/contracts/${contractId}/signatures`, { token })
}

export async function sendForSignature(
  token: string,
  contractId: string,
  body: CreateSignatureRequestBody,
): Promise<SignatureRequest> {
  return apiRequest<SignatureRequest>(`/contracts/${contractId}/signatures`, { method: 'POST', body, token })
}

export async function voidSignatureRequest(
  token: string,
  contractId: string,
  signatureRequestId: string,
): Promise<SignatureRequest> {
  return apiRequest<SignatureRequest>(`/contracts/${contractId}/signatures/${signatureRequestId}/void`, {
    method: 'POST',
    token,
  })
}

export async function listMyPendingStaffSignatures(token: string): Promise<SignatureRequest[]> {
  return apiRequest<SignatureRequest[]>('/signatures/mine', { token })
}
