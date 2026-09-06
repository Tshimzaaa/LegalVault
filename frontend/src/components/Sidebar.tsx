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
  return (
    <aside className="dash-sidebar">
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
  )
}

export default Sidebar
