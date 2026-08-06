import { apiRequest } from './client'

export interface Notification {
  id: string
  type: string
  title: string
  body: string
  target_type: string | null
  target_id: string | null
  is_read: boolean
  created_at: string
}

const basePath = (scope: 'staff' | 'client') => (scope === 'staff' ? '/notifications' : '/client-notifications')

export async function listNotifications(
  token: string,
  scope: 'staff' | 'client',
  options: { unreadOnly?: boolean; limit?: number; offset?: number } = {},
): Promise<Notification[]> {
  const { unreadOnly, limit = 20, offset = 0 } = options
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (unreadOnly) params.set('unread_only', 'true')
  return apiRequest<Notification[]>(`${basePath(scope)}?${params.toString()}`, { token })
}

export async function getUnreadCount(token: string, scope: 'staff' | 'client'): Promise<number> {
  const data = await apiRequest<{ unread_count: number }>(`${basePath(scope)}/unread-count`, { token })
  return data.unread_count
}

export async function markNotificationRead(
  token: string,
  scope: 'staff' | 'client',
  notificationId: string,
): Promise<Notification> {
  return apiRequest<Notification>(`${basePath(scope)}/${notificationId}/read`, { method: 'PATCH', token })
}

export async function markAllNotificationsRead(token: string, scope: 'staff' | 'client'): Promise<void> {
  await apiRequest(`${basePath(scope)}/read-all`, { method: 'POST', token })
}
