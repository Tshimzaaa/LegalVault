import { useEffect, useRef, useState } from 'react'
import './ProfileMenu.css'
import type { SidebarUser } from './Sidebar'

interface ProfileMenuProps {
  user: SidebarUser
  onLogout: () => void
}

function ProfileMenu({ user, onLogout }: ProfileMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const initials = `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase()

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

  return (
    <div className="profile-menu-root" ref={rootRef}>
      <button
        type="button"
        className="profile-avatar-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="profile-menu-panel"
      >
        {initials}
      </button>

      {open && (
        <div className="profile-menu" id="profile-menu-panel" role="menu">
          <div className="profile-menu-header">
            <span className="profile-menu-avatar">{initials}</span>
            <span className="profile-menu-name">
              {user.first_name} {user.last_name}
            </span>
            <span className="profile-menu-email">{user.email}</span>
          </div>
          <div className="profile-menu-divider" />
          <button
            type="button"
            className="profile-menu-logout"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onLogout()
            }}
          >
            Log Out
          </button>
        </div>
      )}
    </div>
  )
}

export default ProfileMenu
