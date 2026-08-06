import { apiRequest } from './client'
import type { SignedContract, SignedContractsSummary } from './signedContracts'

export type { SignedContract, SignedContractsSummary }

export async function listClientSignedContracts(token: string): Promise<SignedContract[]> {
  return apiRequest<SignedContract[]>('/client-signed-contracts', { token })
}

export async function getClientSignedContractsSummary(token: string): Promise<SignedContractsSummary> {
  return apiRequest<SignedContractsSummary>('/client-signed-contracts/summary', { token })
}

export async function getClientSignedContractDownloadUrl(token: string, contractId: string): Promise<string> {
  const data = await apiRequest<{ download_url: string; expires_in_seconds: number }>(
    `/client-signed-contracts/${contractId}/download`,
    { token },
  )
  return data.download_url
}
