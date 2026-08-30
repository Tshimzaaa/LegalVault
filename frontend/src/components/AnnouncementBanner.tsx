import { useEffect, useState } from 'react'
import './AnnouncementBanner.css'
import { IconMegaphone, IconX } from './icons'
import { listAnnouncements, listClientAnnouncements } from '../api/announcements'
import type { Announcement, AnnouncementSeverity } from '../api/announcements'

const severityColor: Record<AnnouncementSeverity, string> = {
  info: '#3987e5',
  warning: '#eab308',
  critical: '#ef4444',
}

const DISMISSED_KEY = 'dismissed_announcements'

function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]')
  } catch {
    return []
  }
}

interface AnnouncementBannerProps {
  scope: 'staff' | 'client'
}

function AnnouncementBanner({ scope }: AnnouncementBannerProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [dismissed, setDismissed] = useState<string[]>(getDismissed())

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    const fetcher = scope === 'staff' ? listAnnouncements : listClientAnnouncements
    fetcher(token)
      .then(setAnnouncements)
      .catch(() => setAnnouncements([]))
  }, [scope])

  function dismiss(id: string) {
    const next = [...dismissed, id]
    setDismissed(next)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next))
  }

  const visible = announcements.filter((a) => a.is_active && !dismissed.includes(a.id))
  if (visible.length === 0) return null

  return (
    <div className="announcement-banner-stack" aria-live="polite">
      {visible.map((a) => (
        <div key={a.id} className="announcement-banner" style={{ borderColor: severityColor[a.severity] }}>
          <span className="announcement-banner-icon" style={{ color: severityColor[a.severity] }}>
            <IconMegaphone />
          </span>
          <div className="announcement-banner-text">
            <strong>{a.title}</strong>
            <span>{a.body}</span>
          </div>
          <button type="button" className="icon-btn" onClick={() => dismiss(a.id)} aria-label="Dismiss announcement">
            <IconX />
          </button>
        </div>
      ))}
    </div>
  )
}

export default AnnouncementBanner
