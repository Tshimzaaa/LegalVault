import { apiRequest } from './client'

export type ActorType = 'staff' | 'owner'

export interface AuditLogEntry {
  id: string
  actor_type: ActorType
  actor_id: string | null
  firm_id: string | null
  action: string
  target_type: string
  target_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export async function listAuditLog(token: string, limit = 50, offset = 0): Promise<AuditLogEntry[]> {
  return apiRequest<AuditLogEntry[]>(`/audit-log?limit=${limit}&offset=${offset}`, { token })
}

export async function listOwnerAuditLog(
  token: string,
  options: { firmId?: string; limit?: number; offset?: number } = {},
): Promise<AuditLogEntry[]> {
  const { firmId, limit = 50, offset = 0 } = options
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (firmId) params.set('firm_id', firmId)
  return apiRequest<AuditLogEntry[]>(`/owner/firms/audit-log?${params.toString()}`, { token })
}

export const auditActionLabel: Record<string, string> = {
  'staff.invited': 'Staff invited',
  'staff.status_updated': 'Staff status updated',
  'client.status_updated': 'Client status updated',
  'client.deleted': 'Client deleted',
  'contact.status_updated': 'Contact status updated',
  'contact.deleted': 'Contact deleted',
  'firm.created': 'Firm created',
  'firm.status_updated': 'Firm status updated',
  'firm.deleted': 'Firm deleted',
  'matter.created': 'Matter created',
  'matter.status_updated': 'Matter status updated',
  'matter.visibility_updated': 'Matter visibility updated',
  'matter.staff_assigned': 'Staff assigned to matter',
  'matter.document_uploaded': 'Document uploaded',
  'matter.task_created': 'Task created',
  'matter.task_updated': 'Task updated',
  'matter.task_deleted': 'Task deleted',
}

export function formatAuditDetails(details: Record<string, unknown> | null): string {
  if (!details) return ''
  return Object.entries(details)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ')
}
