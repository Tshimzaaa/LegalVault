import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './Sidebar.css'
import { IconLeaf } from './icons'
import ThemeToggle from './ThemeToggle'

export interface NavItem {
  label: string
  icon: React.ReactNode
  page: string
}

export interface SidebarUser {
  first_name: string
  last_name: string
  email: string
}

interface SidebarProps {
  activePage: string
  /** Route prefix each nav item's page is appended to, e.g. "/staff" or "/client". */
  basePath: string
  navItems: NavItem[]
  user: SidebarUser
  onLogout: () => void
  brandName?: string
  brandSub?: string
  notificationBell?: React.ReactNode
}

function Sidebar({
  activePage,
  basePath,
  navItems,
  user,
  onLogout,
  brandName = 'LEGAL',
  brandSub = 'matter management platform',
  notificationBell,
}: SidebarProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <>
      <div className="sidebar-mobile-bar">
        <button
          type="button"
          className="sidebar-mobile-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="dash-sidebar"
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`sidebar-menu-icon${open ? ' open' : ''}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
        <span className="sidebar-mobile-brand">
          <span className="brand-mark">
            <IconLeaf />
          </span>
          <span className="brand-name">{brandName}</span>
        </span>
        {notificationBell && <span className="sidebar-mobile-bell">{notificationBell}</span>}
      </div>

      <div className={`sidebar-backdrop${open ? ' open' : ''}`} onClick={close} />

      <aside id="dash-sidebar" className={`dash-sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">
            <IconLeaf />
          </span>
          <span className="brand-text">
            <span className="brand-name">{brandName}</span>
            <span className="brand-sub">{brandSub}</span>
          </span>
          {notificationBell && <span className="sidebar-brand-bell">{notificationBell}</span>}
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const active = item.page === activePage
            return (
              <Link
                key={item.label}
                to={`${basePath}/${item.page}`}
                className={`nav-item${active ? ' active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={close}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-account">
          <div className="account-info">
            <span className="account-name">
              {user.first_name} {user.last_name}
            </span>
            <span className="account-email">{user.email}</span>
          </div>
          <div className="account-actions">
            <ThemeToggle />
            <button type="button" className="account-logout" onClick={onLogout}>
              Log Out
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
