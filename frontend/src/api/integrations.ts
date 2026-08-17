import { apiRequest } from './client'

export type IntegrationProvider = 'signinghub' | 'trackado' | 'contract_express' | 'cloud_storage'

export interface Integration {
  provider: IntegrationProvider
  is_enabled: boolean
  is_configured: boolean
  connected_at: string | null
}

export async function listIntegrations(token: string): Promise<Integration[]> {
  return apiRequest<Integration[]>('/integrations', { token })
}

export async function updateIntegration(
  token: string,
  provider: IntegrationProvider,
  credentials: Record<string, string>,
  isEnabled: boolean,
): Promise<Integration> {
  return apiRequest<Integration>(`/integrations/${provider}`, {
    method: 'PUT',
    body: { credentials, is_enabled: isEnabled },
    token,
  })
}

export async function disableIntegration(token: string, provider: IntegrationProvider): Promise<Integration> {
  return apiRequest<Integration>(`/integrations/${provider}/disable`, { method: 'POST', token })
}

export async function deleteIntegration(token: string, provider: IntegrationProvider): Promise<Integration> {
  return apiRequest<Integration>(`/integrations/${provider}`, { method: 'DELETE', token })
}
