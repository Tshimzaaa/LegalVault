import { apiRequest } from './client'

export type AnnouncementSeverity = 'info' | 'warning' | 'critical'

export interface Announcement {
  id: string
  title: string
  body: string
  severity: AnnouncementSeverity
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AnnouncementPayload {
  title?: string
  body?: string
  severity?: AnnouncementSeverity
  is_active?: boolean
}

export async function listOwnerAnnouncements(token: string): Promise<Announcement[]> {
  return apiRequest<Announcement[]>('/owner/announcements', { token })
}

export async function createAnnouncement(token: string, payload: AnnouncementPayload): Promise<Announcement> {
  return apiRequest<Announcement>('/owner/announcements', { method: 'POST', body: payload, token })
}

export async function updateAnnouncement(
  token: string,
  announcementId: string,
  payload: AnnouncementPayload,
): Promise<Announcement> {
  return apiRequest<Announcement>(`/owner/announcements/${announcementId}`, {
    method: 'PATCH',
    body: payload,
    token,
  })
}

export async function deleteAnnouncement(token: string, announcementId: string): Promise<void> {
  await apiRequest(`/owner/announcements/${announcementId}`, { method: 'DELETE', token })
}

export async function listAnnouncements(token: string): Promise<Announcement[]> {
  return apiRequest<Announcement[]>('/announcements', { token })
}
