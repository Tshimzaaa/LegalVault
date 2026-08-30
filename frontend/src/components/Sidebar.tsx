import './Sidebar.css'
import { IconLeaf } from './icons'

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
  onNavigate: (page: string) => void
  navItems: NavItem[]
  user: SidebarUser
  onLogout: () => void
  brandName?: string
  brandSub?: string
  notificationBell?: React.ReactNode
}

function Sidebar({
  activePage,
  onNavigate,
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
            <button
              key={item.label}
              type="button"
              className={`nav-item${active ? ' active' : ''}`}
              onClick={() => onNavigate(item.page)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
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
        <button type="button" className="account-logout" onClick={onLogout}>
          Log Out
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
