import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './NotificationBell.css'
import { IconBell, IconChevron, IconX } from './icons'
import { listNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead } from '../api/notifications'
import type { Notification } from '../api/notifications'
import { formatDateTime } from '../utils/date'

const POLL_INTERVAL_MS = 30000
const PANEL_WIDTH = 340
const PANEL_MARGIN = 12

// Where a notification leads. A signature request id is not a contract id, so those go to the
// dashboard, where the pending-signature card lives, rather than guessing a contract route.
function notificationPath(n: Notification): string | null {
  if (n.target_type === 'contract' && n.target_id) return `/staff/contracts/${n.target_id}`
  if (n.target_type === 'intake_submission') return '/staff/intake-submissions'
  if (n.target_type === 'signature_request') return '/staff/dashboard'
  return null
}

interface PanelPos {
  top: number
  left: number
  maxHeight: number
}

function computePanelPos(btn: HTMLElement): PanelPos {
  const rect = btn.getBoundingClientRect()
  const width = Math.min(PANEL_WIDTH, window.innerWidth - PANEL_MARGIN * 2)
  const left = Math.max(PANEL_MARGIN, Math.min(rect.left, window.innerWidth - width - PANEL_MARGIN))
  const top = rect.bottom + 8
  return { top, left, maxHeight: Math.min(480, window.innerHeight - top - PANEL_MARGIN) }
}

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loaded, setLoaded] = useState(false)
  const [markError, setMarkError] = useState<string | null>(null)
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null)
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // Read the token fresh on every tick — capturing it once above would freeze this
    // closure on the token from mount time, so once it expired every poll thereafter
    // would need a refresh-and-retry round trip instead of a plain 200.
    function poll() {
      const token = localStorage.getItem('access_token')
      if (!token) return
      getUnreadCount(token)
        .then(setUnreadCount)
        .catch(() => {})
    }
    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

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
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Keeps the panel pinned under the bell button instead of detaching from it when the
  // page scrolls or the viewport is resized while the panel is open.
  useEffect(() => {
    if (!open) return
    function reposition() {
      if (!btnRef.current) return
      setPanelPos(computePanelPos(btnRef.current))
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  function handleToggle() {
    const token = localStorage.getItem('access_token')
    const next = !open
    setOpen(next)
    if (next && btnRef.current) {
      setPanelPos(computePanelPos(btnRef.current))
    }
    if (next && token) {
      listNotifications(token, { limit: 20 })
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
      const updated = await markNotificationRead(token, n.id)
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? updated : x)))
    } catch {
      // Roll back — the read receipt didn't actually save server-side.
      setNotifications(previousNotifications)
      setUnreadCount(previousCount)
      setMarkError('Could not mark as read. Try again.')
    }
  }

  function handleOpen(n: Notification) {
    void handleMarkRead(n)
    const path = notificationPath(n)
    if (path) {
      setOpen(false)
      navigate(path)
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
      await markAllNotificationsRead(token)
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
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="notification-bell-panel"
      >
        <IconBell />
        {unreadCount > 0 && <span className="notification-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && panelPos && (
        <div
          className="notification-bell-panel"
          id="notification-bell-panel"
          role="dialog"
          aria-label="Notifications"
          style={{ top: panelPos.top, maxHeight: panelPos.maxHeight, ['--np-left' as string]: `${panelPos.left}px` }}
        >
          <div className="notification-bell-header">
            <span>Notifications</span>
            <span className="notification-bell-header-actions">
              {unreadCount > 0 && (
                <button type="button" className="notification-bell-mark-all" onClick={handleMarkAllRead}>
                  Mark All Read
                </button>
              )}
              <button type="button" className="notification-bell-close" aria-label="Close notifications" onClick={() => setOpen(false)}>
                <IconX />
              </button>
            </span>
          </div>
          {markError && <p className="notification-bell-error" aria-live="polite">{markError}</p>}
          <div className="notification-bell-list">
            {!loaded && <p className="muted notification-bell-empty">Loading…</p>}
            {loaded && notifications.length === 0 && <p className="muted notification-bell-empty">No notifications yet.</p>}
            {notifications.map((n) => {
              const opens = notificationPath(n) !== null
              return (
                <button
                  key={n.id}
                  type="button"
                  className={`notification-bell-item${n.is_read ? '' : ' unread'}`}
                  onClick={() => handleOpen(n)}
                >
                  <span className="notification-bell-dot" aria-hidden="true" />
                  <span className="notification-bell-item-main">
                    <span className="notification-bell-item-title">
                      {!n.is_read && <span className="visually-hidden">Unread: </span>}
                      {n.title}
                    </span>
                    {n.body && <span className="notification-bell-item-body">{n.body}</span>}
                    <span className="notification-bell-item-time">{formatDateTime(n.created_at)}</span>
                  </span>
                  {opens && (
                    <span className="notification-bell-item-go" aria-hidden="true">
                      <IconChevron />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
