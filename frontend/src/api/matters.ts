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
  due_date: string | null
  created_at: string
  updated_at: string
}

export interface CalendarEvent {
  date: string
  type: 'matter_deadline' | 'task_due'
  title: string
  matter_id: string
  matter_title: string
  task_id: string | null
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
  due_date?: string | null
}

export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface MatterTask {
  id: string
  matter_id: string
  title: string
  description: string | null
  assigned_to: string | null
  due_date: string | null
  status: TaskStatus
  created_at: string
  updated_at: string
}

export interface CreateMatterTaskRequest {
  title: string
  description?: string | null
  assigned_to?: string | null
  due_date?: string | null
}

export interface UpdateMatterTaskRequest {
  title?: string
  description?: string | null
  assigned_to?: string | null
  due_date?: string | null
  status?: TaskStatus
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

export async function updateMatterDeadline(token: string, matterId: string, dueDate: string | null): Promise<Matter> {
  return apiRequest<Matter>(`/matters/${matterId}/deadline`, {
    method: 'PATCH',
    body: { due_date: dueDate },
    token,
  })
}

export async function getCalendar(token: string, start?: string, end?: string): Promise<CalendarEvent[]> {
  const params = new URLSearchParams()
  if (start) params.set('start', start)
  if (end) params.set('end', end)
  const qs = params.toString()
  return apiRequest<CalendarEvent[]>(`/matters/calendar${qs ? `?${qs}` : ''}`, { token })
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

export async function deleteMatterDocument(token: string, matterId: string, documentId: string): Promise<void> {
  await apiRequest(`/matters/${matterId}/documents/${documentId}`, { method: 'DELETE', token })
}

export async function listTasks(token: string, matterId: string): Promise<MatterTask[]> {
  return apiRequest<MatterTask[]>(`/matters/${matterId}/tasks`, { token })
}

export async function createTask(
  token: string,
  matterId: string,
  body: CreateMatterTaskRequest,
): Promise<MatterTask> {
  return apiRequest<MatterTask>(`/matters/${matterId}/tasks`, { method: 'POST', body, token })
}

export async function updateTask(
  token: string,
  matterId: string,
  taskId: string,
  body: UpdateMatterTaskRequest,
): Promise<MatterTask> {
  return apiRequest<MatterTask>(`/matters/${matterId}/tasks/${taskId}`, { method: 'PATCH', body, token })
}

export async function deleteTask(token: string, matterId: string, taskId: string): Promise<void> {
  await apiRequest(`/matters/${matterId}/tasks/${taskId}`, { method: 'DELETE', token })
}

export type MessageAuthorType = 'staff' | 'client_contact'

export interface MatterMessage {
  id: string
  matter_id: string
  author_type: MessageAuthorType
  author_id: string
  author_name: string
  body: string
  created_at: string
}

export async function listMessages(token: string, matterId: string): Promise<MatterMessage[]> {
  return apiRequest<MatterMessage[]>(`/matters/${matterId}/messages`, { token })
}

export async function createMessage(token: string, matterId: string, body: string): Promise<MatterMessage> {
  return apiRequest<MatterMessage>(`/matters/${matterId}/messages`, { method: 'POST', body: { body }, token })
}

export async function deleteMessage(token: string, matterId: string, messageId: string): Promise<void> {
  await apiRequest(`/matters/${matterId}/messages/${messageId}`, { method: 'DELETE', token })
}
