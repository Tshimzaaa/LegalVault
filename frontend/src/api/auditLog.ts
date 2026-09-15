import { apiRequest } from './client'

export type ActorType = 'staff' | 'owner'

export interface AuditLogEntry {
  id: string
  actor_type: ActorType
  actor_id: string | null
  org_id: string | null
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
  options: { orgId?: string; limit?: number; offset?: number } = {},
): Promise<AuditLogEntry[]> {
  const { orgId, limit = 50, offset = 0 } = options
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (orgId) params.set('org_id', orgId)
  return apiRequest<AuditLogEntry[]>(`/owner/orgs/audit-log?${params.toString()}`, { token })
}

export const auditActionLabel: Record<string, string> = {
  'staff.invited': 'Staff invited',
  'staff.status_updated': 'Staff status updated',
  'staff.force_logout': 'Staff force-logged out',
  'file.upload_blocked_malware': 'Upload blocked (malware detected)',
  'org.created': 'Organization created',
  'org.status_updated': 'Organization status updated',
  'org.deleted': 'Organization deleted',
  'org.data_exported': 'Organization data exported',
  'org.profile_updated': 'Organization profile updated',
  'contract.created': 'Contract created',
  'contract.details_updated': 'Contract details updated',
  'contract.status_updated': 'Contract status updated',
  'contract.deadline_updated': 'Contract deadline updated',
  'contract.staff_assigned': 'Staff assigned to contract',
  'contract.document_uploaded': 'Document uploaded',
  'contract.document_deleted': 'Document deleted',
  'contract.task_created': 'Task created',
  'contract.task_updated': 'Task updated',
  'contract.task_deleted': 'Task deleted',
  'contract_approval.requested': 'Approval requested',
  'contract_approval.decided': 'Approval decided',
  'announcement.created': 'Announcement created',
  'announcement.updated': 'Announcement updated',
  'announcement.deleted': 'Announcement deleted',
  'template.uploaded': 'Template uploaded',
  'template.updated': 'Template updated',
  'template.deleted': 'Template deleted',
  'signed_contract.uploaded': 'Signed contract uploaded',
  'signed_contract.status_updated': 'Signed contract status updated',
  'fallback_clause.created': 'Fallback clause created',
  'fallback_clause.updated': 'Fallback clause updated',
  'fallback_clause.deleted': 'Fallback clause deleted',
  'knowledge_article.created': 'Knowledge article created',
  'knowledge_article.updated': 'Knowledge article updated',
  'knowledge_article.deleted': 'Knowledge article deleted',
  'integration.configured': 'Integration configured',
  'integration.disabled': 'Integration disabled',
  'integration.disconnected': 'Integration disconnected',
  'signature_request.sent': 'Signature request sent',
  'signature_request.voided': 'Signature request voided',
  'signature_request.declined': 'Signature request declined',
  'signature_request.completed': 'Signature completed',
}

export function formatAuditDetails(details: Record<string, unknown> | null): string {
  if (!details) return ''
  return Object.entries(details)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ')
}
