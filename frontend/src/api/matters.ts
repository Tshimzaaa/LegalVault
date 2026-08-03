import { apiRequest, apiUpload } from './client'

export type MatterStatus = 'intake' | 'in_review' | 'awaiting_signature' | 'signed' | 'closed' | 'declined'

export interface Matter {
  id: string
  firm_id: string
  client_id: string
  title: string
  description: string | null
  status: MatterStatus
  is_visible_to_client: boolean
  created_at: string
  updated_at: string
}

export type MatterRole = 'lead_lawyer' | 'paralegal' | 'secretary' | 'reviewer'

export interface MatterAssignment {
  id: string
  matter_id: string
  user_id: string
  role_on_matter: MatterRole
}

export interface MatterDocument {
  id: string
  matter_id: string
  uploaded_by: string | null
  uploaded_by_contact_id: string | null
  title: string
  version: number
  original_filename: string
  content_type: string
  created_at: string
}

export interface CreateMatterRequest {
  client_id: string
  title: string
  description?: string | null
}

export async function listMatters(token: string): Promise<Matter[]> {
  return apiRequest<Matter[]>('/matters', { token })
}

export async function getMatter(token: string, matterId: string): Promise<Matter> {
  return apiRequest<Matter>(`/matters/${matterId}`, { token })
}

export async function createMatter(token: string, body: CreateMatterRequest): Promise<Matter> {
  return apiRequest<Matter>('/matters', { method: 'POST', body, token })
}

export async function updateMatterStatus(token: string, matterId: string, status: MatterStatus): Promise<Matter> {
  return apiRequest<Matter>(`/matters/${matterId}/status`, { method: 'PATCH', body: { status }, token })
}

export async function updateMatterVisibility(
  token: string,
  matterId: string,
  isVisibleToClient: boolean,
): Promise<Matter> {
  return apiRequest<Matter>(`/matters/${matterId}/visibility`, {
    method: 'PATCH',
    body: { is_visible_to_client: isVisibleToClient },
    token,
  })
}

export async function listAssignments(token: string, matterId: string): Promise<MatterAssignment[]> {
  return apiRequest<MatterAssignment[]>(`/matters/${matterId}/assignments`, { token })
}

export async function assignStaff(
  token: string,
  matterId: string,
  body: { user_id: string; role_on_matter: MatterRole },
): Promise<MatterAssignment> {
  return apiRequest<MatterAssignment>(`/matters/${matterId}/assignments`, { method: 'POST', body, token })
}

export async function listMatterDocuments(token: string, matterId: string): Promise<MatterDocument[]> {
  return apiRequest<MatterDocument[]>(`/matters/${matterId}/documents`, { token })
}

export async function uploadMatterDocument(
  token: string,
  matterId: string,
  title: string,
  file: File,
): Promise<MatterDocument> {
  const formData = new FormData()
  formData.append('title', title)
  formData.append('file', file)
  return apiUpload<MatterDocument>(`/matters/${matterId}/documents`, formData, token)
}

export async function getMatterDocumentDownloadUrl(
  token: string,
  matterId: string,
  documentId: string,
): Promise<string> {
  const data = await apiRequest<{ download_url: string; expires_in_seconds: number }>(
    `/matters/${matterId}/documents/${documentId}/download`,
    { token },
  )
  return data.download_url
}
