import { apiRequest, apiUpload } from './client'
import type { Matter, MatterDocument, MatterMessage } from './matters'

export type ContactPermissionLevel = 'owner' | 'editor' | 'viewer'

export interface MatterContactPermission {
  id: string
  matter_id: string
  matter_title: string
  client_contact_id: string
  contact_name: string
  contact_email: string
  permission_level: ContactPermissionLevel
  created_at: string
  updated_at: string
}

export async function listClientMatters(token: string): Promise<Matter[]> {
  return apiRequest<Matter[]>('/client-matters', { token })
}

export async function listMyContactPermissions(token: string): Promise<MatterContactPermission[]> {
  return apiRequest<MatterContactPermission[]>('/client-matters/contact-permissions', { token })
}

export async function listClientMatterDocuments(token: string, matterId: string): Promise<MatterDocument[]> {
  return apiRequest<MatterDocument[]>(`/client-matters/${matterId}/documents`, { token })
}

export async function uploadClientMatterDocument(
  token: string,
  matterId: string,
  title: string,
  file: File,
): Promise<MatterDocument> {
  const formData = new FormData()
  formData.append('title', title)
  formData.append('file', file)
  return apiUpload<MatterDocument>(`/client-matters/${matterId}/documents`, formData, token)
}

export async function getClientMatterDocumentDownloadUrl(
  token: string,
  matterId: string,
  documentId: string,
): Promise<string> {
  const data = await apiRequest<{ download_url: string; expires_in_seconds: number }>(
    `/client-matters/${matterId}/documents/${documentId}/download`,
    { token },
  )
  return data.download_url
}

export async function listClientMessages(token: string, matterId: string): Promise<MatterMessage[]> {
  return apiRequest<MatterMessage[]>(`/client-matters/${matterId}/messages`, { token })
}

export async function createClientMessage(token: string, matterId: string, body: string): Promise<MatterMessage> {
  return apiRequest<MatterMessage>(`/client-matters/${matterId}/messages`, { method: 'POST', body: { body }, token })
}

export async function deleteClientMessage(token: string, matterId: string, messageId: string): Promise<void> {
  await apiRequest(`/client-matters/${matterId}/messages/${messageId}`, { method: 'DELETE', token })
}
