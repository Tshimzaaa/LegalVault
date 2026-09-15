import { apiRequest, apiUpload } from './client'

export type ContractStage = 'intake' | 'in_review' | 'awaiting_signature' | 'signed' | 'closed' | 'declined'

export interface Contract {
  id: string
  org_id: string
  title: string
  description: string | null
  status: ContractStage
  due_date: string | null
  created_at: string
  updated_at: string
}

export interface CalendarEvent {
  date: string
  type: 'contract_deadline' | 'task_due'
  title: string
  contract_id: string
  contract_title: string
  task_id: string | null
}

// Valid next statuses per current status — must stay in sync with
// CONTRACT_STATUS_TRANSITIONS in backend/app/modules/contracts/service.py (no shared
// codegen between the two apps in this repo). The backend is the source of truth and
// rejects anything not listed here regardless of what the UI allows.
export const CONTRACT_STATUS_TRANSITIONS: Record<ContractStage, ContractStage[]> = {
  intake: ['in_review', 'declined'],
  in_review: ['awaiting_signature', 'declined', 'intake'],
  awaiting_signature: ['signed', 'declined', 'in_review'],
  signed: ['closed'],
  closed: [],
  declined: [],
}

// Transitions that can't be applied directly — requestContractApproval() instead of
// updateContractStage(). Must stay in sync with GATED_TRANSITIONS in contracts/service.py.
export const GATED_TRANSITIONS: [ContractStage, ContractStage][] = [
  ['awaiting_signature', 'signed'],
  ['signed', 'closed'],
]

export function isGatedTransition(from: ContractStage, to: ContractStage): boolean {
  return GATED_TRANSITIONS.some(([f, t]) => f === from && t === to)
}

export type ContractRole = 'lead_lawyer' | 'paralegal' | 'secretary' | 'reviewer'

export interface ContractAssignment {
  id: string
  contract_id: string
  user_id: string
  role_on_contract: ContractRole
}

export interface ContractDocument {
  id: string
  contract_id: string
  uploaded_by: string | null
  title: string
  version: number
  original_filename: string
  content_type: string
  created_at: string
}

export interface CreateContractRequest {
  title: string
  description?: string | null
  due_date?: string | null
}

export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface ContractTask {
  id: string
  contract_id: string
  title: string
  description: string | null
  assigned_to: string | null
  due_date: string | null
  status: TaskStatus
  created_at: string
  updated_at: string
}

export interface CreateContractTaskRequest {
  title: string
  description?: string | null
  assigned_to?: string | null
  due_date?: string | null
}

export interface UpdateContractTaskRequest {
  title?: string
  description?: string | null
  assigned_to?: string | null
  due_date?: string | null
  status?: TaskStatus
}

export type ContractApprovalStatus = 'pending' | 'approved' | 'rejected'
export type ApprovalDecision = 'approved' | 'rejected'

export interface ContractApproval {
  id: string
  contract_id: string
  requested_by: string
  from_status: ContractStage
  to_status: ContractStage
  status: ContractApprovalStatus
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
  created_at: string
  updated_at: string
}

export async function listContracts(token: string): Promise<Contract[]> {
  return apiRequest<Contract[]>('/contracts', { token })
}

export async function getContract(token: string, contractId: string): Promise<Contract> {
  return apiRequest<Contract>(`/contracts/${contractId}`, { token })
}

export async function createContract(token: string, body: CreateContractRequest): Promise<Contract> {
  return apiRequest<Contract>('/contracts', { method: 'POST', body, token })
}

export async function updateContractDetails(
  token: string,
  contractId: string,
  body: { title: string; description?: string | null },
): Promise<Contract> {
  return apiRequest<Contract>(`/contracts/${contractId}`, { method: 'PATCH', body, token })
}

export async function updateContractStage(token: string, contractId: string, status: ContractStage): Promise<Contract> {
  return apiRequest<Contract>(`/contracts/${contractId}/status`, { method: 'PATCH', body: { status }, token })
}

export async function requestContractApproval(
  token: string,
  contractId: string,
  toStatus: ContractStage,
): Promise<ContractApproval> {
  return apiRequest<ContractApproval>(`/contracts/${contractId}/approvals`, {
    method: 'POST',
    body: { to_status: toStatus },
    token,
  })
}

export async function listContractApprovals(token: string, contractId: string): Promise<ContractApproval[]> {
  return apiRequest<ContractApproval[]>(`/contracts/${contractId}/approvals`, { token })
}

export async function decideContractApproval(
  token: string,
  contractId: string,
  approvalId: string,
  decision: ApprovalDecision,
  note?: string,
): Promise<ContractApproval> {
  return apiRequest<ContractApproval>(`/contracts/${contractId}/approvals/${approvalId}`, {
    method: 'PATCH',
    body: { decision, note: note || null },
    token,
  })
}

export async function listPendingApprovals(token: string): Promise<ContractApproval[]> {
  return apiRequest<ContractApproval[]>('/contracts/approvals/pending', { token })
}

export async function updateContractDeadline(token: string, contractId: string, dueDate: string | null): Promise<Contract> {
  return apiRequest<Contract>(`/contracts/${contractId}/deadline`, {
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
  return apiRequest<CalendarEvent[]>(`/contracts/calendar${qs ? `?${qs}` : ''}`, { token })
}

export async function listAssignments(token: string, contractId: string): Promise<ContractAssignment[]> {
  return apiRequest<ContractAssignment[]>(`/contracts/${contractId}/assignments`, { token })
}

export async function assignStaff(
  token: string,
  contractId: string,
  body: { user_id: string; role_on_contract: ContractRole },
): Promise<ContractAssignment> {
  return apiRequest<ContractAssignment>(`/contracts/${contractId}/assignments`, { method: 'POST', body, token })
}

export async function listContractDocuments(token: string, contractId: string): Promise<ContractDocument[]> {
  return apiRequest<ContractDocument[]>(`/contracts/${contractId}/documents`, { token })
}

export async function uploadContractDocument(
  token: string,
  contractId: string,
  title: string,
  file: File,
): Promise<ContractDocument> {
  const formData = new FormData()
  formData.append('title', title)
  formData.append('file', file)
  return apiUpload<ContractDocument>(`/contracts/${contractId}/documents`, formData, token)
}

export async function getContractDocumentDownloadUrl(
  token: string,
  contractId: string,
  documentId: string,
): Promise<string> {
  const data = await apiRequest<{ download_url: string; expires_in_seconds: number }>(
    `/contracts/${contractId}/documents/${documentId}/download`,
    { token },
  )
  return data.download_url
}

export async function deleteContractDocument(token: string, contractId: string, documentId: string): Promise<void> {
  await apiRequest(`/contracts/${contractId}/documents/${documentId}`, { method: 'DELETE', token })
}

export async function listTasks(token: string, contractId: string): Promise<ContractTask[]> {
  return apiRequest<ContractTask[]>(`/contracts/${contractId}/tasks`, { token })
}

export async function createTask(
  token: string,
  contractId: string,
  body: CreateContractTaskRequest,
): Promise<ContractTask> {
  return apiRequest<ContractTask>(`/contracts/${contractId}/tasks`, { method: 'POST', body, token })
}

export async function updateTask(
  token: string,
  contractId: string,
  taskId: string,
  body: UpdateContractTaskRequest,
): Promise<ContractTask> {
  return apiRequest<ContractTask>(`/contracts/${contractId}/tasks/${taskId}`, { method: 'PATCH', body, token })
}

export async function deleteTask(token: string, contractId: string, taskId: string): Promise<void> {
  await apiRequest(`/contracts/${contractId}/tasks/${taskId}`, { method: 'DELETE', token })
}

export type MessageAuthorType = 'staff'

export interface ContractMessage {
  id: string
  contract_id: string
  author_type: MessageAuthorType
  author_id: string
  author_name: string
  body: string
  created_at: string
}

export async function listMessages(token: string, contractId: string): Promise<ContractMessage[]> {
  return apiRequest<ContractMessage[]>(`/contracts/${contractId}/messages`, { token })
}

export async function createMessage(token: string, contractId: string, body: string): Promise<ContractMessage> {
  return apiRequest<ContractMessage>(`/contracts/${contractId}/messages`, { method: 'POST', body: { body }, token })
}

export async function deleteMessage(token: string, contractId: string, messageId: string): Promise<void> {
  await apiRequest(`/contracts/${contractId}/messages/${messageId}`, { method: 'DELETE', token })
}
