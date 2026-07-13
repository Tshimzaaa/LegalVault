import './Sidebar.css'
import {
  IconLeaf,
  IconGauge,
  IconGavel,
  IconWorkflow,
  IconSignedContract,
  IconReport,
  IconContractData,
  IconTemplates,
} from './icons'
import type { User } from '../api/auth'

export type Page =
  | 'dashboard'
  | 'new-matter'
  | 'workflow'
  | 'signed-contracts'
  | 'reporting'
  | 'contract-data'
  | 'templates'

interface NavItem {
  label: string
  icon: React.ReactNode
  page: Page
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: <IconGauge />, page: 'dashboard' },
  { label: 'New Matter', icon: <IconGavel />, page: 'new-matter' },
  { label: 'Workflow', icon: <IconWorkflow />, page: 'workflow' },
  { label: 'Signed Contracts', icon: <IconSignedContract />, page: 'signed-contracts' },
  { label: 'Reporting', icon: <IconReport />, page: 'reporting' },
  { label: 'Contract Data', icon: <IconContractData />, page: 'contract-data' },
  { label: 'Templates', icon: <IconTemplates />, page: 'templates' },
]

interface SidebarProps {
  activePage: Page
  onNavigate: (page: Page) => void
  user: User
  onLogout: () => void
}

function Sidebar({ activePage, onNavigate, user, onLogout }: SidebarProps) {
  return (
    <aside className="dash-sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">
          <IconLeaf />
        </span>
        <span className="brand-text">
          <span className="brand-name">LEGAL</span>
          <span className="brand-sub">matter management platform</span>
        </span>
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
          Log out
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
