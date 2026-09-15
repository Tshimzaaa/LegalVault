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

export async function listNotifications(
  token: string,
  options: { unreadOnly?: boolean; limit?: number; offset?: number } = {},
): Promise<Notification[]> {
  const { unreadOnly, limit = 20, offset = 0 } = options
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (unreadOnly) params.set('unread_only', 'true')
  return apiRequest<Notification[]>(`/notifications?${params.toString()}`, { token })
}

export async function getUnreadCount(token: string): Promise<number> {
  const data = await apiRequest<{ unread_count: number }>('/notifications/unread-count', { token })
  return data.unread_count
}

export async function markNotificationRead(token: string, notificationId: string): Promise<Notification> {
  return apiRequest<Notification>(`/notifications/${notificationId}/read`, { method: 'PATCH', token })
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  await apiRequest('/notifications/read-all', { method: 'POST', token })
}
