import { apiRequest, apiUpload } from './client'

export type ContractType = 'nda' | 'consultancy' | 'supplier' | 'general'
export type ContractPersistedStatus = 'active' | 'archived'
export type ContractLifecycleStatus = ContractPersistedStatus | 'expiring'

export interface SignedContract {
  id: string
  org_id: string
  contract_id: string | null
  title: string
  description: string | null
  agreement_type: ContractType
  signed_date: string
  expiry_date: string | null
  integration_source: string
  status: ContractLifecycleStatus
  original_filename: string
  content_type: string
  created_at: string
}

export interface SignedContractsSummary {
  total: number
  active: number
  expiring_soon: number
}

export interface UploadSignedContractPayload {
  title: string
  agreement_type: ContractType
  signed_date: string
  description?: string
  expiry_date?: string
  integration_source?: string
  contract_id?: string
  file: File
}

export async function listSignedContracts(token: string): Promise<SignedContract[]> {
  return apiRequest<SignedContract[]>('/signed-contracts', { token })
}

export async function getSignedContractsSummary(token: string): Promise<SignedContractsSummary> {
  return apiRequest<SignedContractsSummary>('/signed-contracts/summary', { token })
}

export async function uploadSignedContract(token: string, payload: UploadSignedContractPayload): Promise<SignedContract> {
  const formData = new FormData()
  formData.append('title', payload.title)
  formData.append('agreement_type', payload.agreement_type)
  formData.append('signed_date', payload.signed_date)
  if (payload.description) formData.append('description', payload.description)
  if (payload.expiry_date) formData.append('expiry_date', payload.expiry_date)
  if (payload.integration_source) formData.append('integration_source', payload.integration_source)
  if (payload.contract_id) formData.append('contract_id', payload.contract_id)
  formData.append('file', payload.file)
  return apiUpload<SignedContract>('/signed-contracts', formData, token)
}

export async function getSignedContractDownloadUrl(token: string, contractId: string): Promise<string> {
  const data = await apiRequest<{ download_url: string; expires_in_seconds: number }>(
    `/signed-contracts/${contractId}/download`,
    { token },
  )
  return data.download_url
}

export async function updateSignedContractStatus(
  token: string,
  contractId: string,
  status: ContractPersistedStatus,
): Promise<SignedContract> {
  return apiRequest<SignedContract>(`/signed-contracts/${contractId}/status`, {
    method: 'PATCH',
    body: { status },
    token,
  })
}
