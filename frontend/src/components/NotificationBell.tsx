import { useEffect, useRef, useState } from 'react'
import './NotificationBell.css'
import { IconBell } from './icons'
import { listNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead } from '../api/notifications'
import type { Notification } from '../api/notifications'

const POLL_INTERVAL_MS = 30000

interface NotificationBellProps {
  scope: 'staff' | 'client'
}

function NotificationBell({ scope }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loaded, setLoaded] = useState(false)
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const token = localStorage.getItem('access_token')

  useEffect(() => {
    if (!token) return
    function poll() {
      if (!token) return
      getUnreadCount(token, scope)
        .then(setUnreadCount)
        .catch(() => {})
    }
    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function handleToggle() {
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
    if (!token || n.is_read) return
    try {
      const updated = await markNotificationRead(token, scope, n.id)
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? updated : x)))
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch {
      // ignore
    }
  }

  async function handleMarkAllRead() {
    if (!token) return
    try {
      await markAllNotificationsRead(token, scope)
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch {
      // ignore
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
                Mark all read
              </button>
            )}
          </div>
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
                <span className="notification-bell-item-time">{new Date(n.created_at).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
