import { useEffect, useRef, useState } from 'react'
import './NotificationBell.css'
import { IconBell } from './icons'
import { listNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead } from '../api/notifications'
import type { Notification } from '../api/notifications'
import { formatDateTime } from '../utils/date'

const POLL_INTERVAL_MS = 30000

interface NotificationBellProps {
  scope: 'staff' | 'client'
}

function NotificationBell({ scope }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loaded, setLoaded] = useState(false)
  const [markError, setMarkError] = useState<string | null>(null)
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // Read the token fresh on every tick — capturing it once above would freeze this
    // closure on the token from mount time, so once it expired every poll thereafter
    // would need a refresh-and-retry round trip instead of a plain 200.
    function poll() {
      const token = localStorage.getItem('access_token')
      if (!token) return
      getUnreadCount(token, scope)
        .then(setUnreadCount)
        .catch(() => {})
    }
    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [scope])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  function handleToggle() {
    const token = localStorage.getItem('access_token')
    const next = !open
    setOpen(next)
    if (next && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPanelPos({ top: rect.bottom + 8, left: rect.left })
    }
    if (next && token) {
      listNotifications(token, scope, { limit: 20 })
        .then((data) => {
          setNotifications(data)
          setLoaded(true)
        })
        .catch(() => setLoaded(true))
    }
  }

  async function handleMarkRead(n: Notification) {
    const token = localStorage.getItem('access_token')
    if (!token || n.is_read) return

    const previousNotifications = notifications
    const previousCount = unreadCount
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
    setUnreadCount((c) => Math.max(0, c - 1))
    setMarkError(null)

    try {
      const updated = await markNotificationRead(token, scope, n.id)
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? updated : x)))
    } catch {
      // Roll back — the read receipt didn't actually save server-side.
      setNotifications(previousNotifications)
      setUnreadCount(previousCount)
      setMarkError('Could not mark as read. Try again.')
    }
  }

  async function handleMarkAllRead() {
    const token = localStorage.getItem('access_token')
    if (!token) return

    const previousNotifications = notifications
    const previousCount = unreadCount
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
    setMarkError(null)

    try {
      await markAllNotificationsRead(token, scope)
    } catch {
      setNotifications(previousNotifications)
      setUnreadCount(previousCount)
      setMarkError('Could not mark all as read. Try again.')
    }
  }

  return (
    <div className="notification-bell-root" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className="notification-bell-btn"
        onClick={handleToggle}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <IconBell />
        {unreadCount > 0 && <span className="notification-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && panelPos && (
        <div className="notification-bell-panel" style={{ top: panelPos.top, left: panelPos.left }}>
          <div className="notification-bell-header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="notification-bell-mark-all" onClick={handleMarkAllRead}>
                Mark All Read
              </button>
            )}
          </div>
          {markError && <p className="notification-bell-error" aria-live="polite">{markError}</p>}
          <div className="notification-bell-list">
            {!loaded && <p className="muted notification-bell-empty">Loading…</p>}
            {loaded && notifications.length === 0 && <p className="muted notification-bell-empty">No notifications yet.</p>}
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`notification-bell-item${n.is_read ? '' : ' unread'}`}
                onClick={() => handleMarkRead(n)}
              >
                <span className="notification-bell-item-title">{n.title}</span>
                <span className="notification-bell-item-body">{n.body}</span>
                <span className="notification-bell-item-time">{formatDateTime(n.created_at)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
