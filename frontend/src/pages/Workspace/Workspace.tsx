import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './Workspace.css'
import Sidebar from '../../components/Sidebar'
import type { NavItem } from '../../components/Sidebar'
import AnnouncementBanner from '../../components/AnnouncementBanner'
import NotificationBell from '../../components/NotificationBell'
import {
  IconGauge,
  IconGavel,
  IconLayers,
  IconUser,
  IconWorkflow,
  IconSignedContract,
  IconReport,
  IconContractData,
  IconTemplates,
  IconShield,
  IconSearch,
  IconClock,
  IconCalendar,
  IconGear,
} from '../../components/icons'
import Dashboard from '../Dashboard/Dashboard'
import NewMatter from '../NewMatter/NewMatter'
import Matters from '../Matters/Matters'
import MatterDetail from '../MatterDetail/MatterDetail'
import Clients from '../Clients/Clients'
import Workflow from '../Workflow/Workflow'
import SignedContracts from '../SignedContracts/SignedContracts'
import Reporting from '../Reporting/Reporting'
import ContractData from '../ContractData/ContractData'
import Templates from '../Templates/Templates'
import Staff from '../Staff/Staff'
import Search from '../Search/Search'
import AuditLog from '../AuditLog/AuditLog'
import Calendar from '../Calendar/Calendar'
import Settings from '../Settings/Settings'
import type { User } from '../../api/auth'

export type StaffPage =
  | 'dashboard'
  | 'new-matter'
  | 'matters'
  | 'clients'
  | 'workflow'
  | 'signed-contracts'
  | 'reporting'
  | 'contract-data'
  | 'templates'
  | 'staff'
  | 'search'
  | 'audit-log'
  | 'calendar'
  | 'settings'

export const staffNavItems: NavItem[] = [
  { label: 'Dashboard', icon: <IconGauge />, page: 'dashboard' },
  { label: 'New Matter', icon: <IconGavel />, page: 'new-matter' },
  { label: 'Matters', icon: <IconLayers />, page: 'matters' },
  { label: 'Clients', icon: <IconUser />, page: 'clients' },
  { label: 'Calendar', icon: <IconCalendar />, page: 'calendar' },
  { label: 'Workflow', icon: <IconWorkflow />, page: 'workflow' },
  { label: 'Signed Contracts', icon: <IconSignedContract />, page: 'signed-contracts' },
  { label: 'Reporting', icon: <IconReport />, page: 'reporting' },
  { label: 'Contract Data', icon: <IconContractData />, page: 'contract-data' },
  { label: 'Templates', icon: <IconTemplates />, page: 'templates' },
  { label: 'Search', icon: <IconSearch />, page: 'search' },
  { label: 'Staff', icon: <IconShield />, page: 'staff' },
  { label: 'Audit Log', icon: <IconClock />, page: 'audit-log' },
  { label: 'Settings', icon: <IconGear />, page: 'settings' },
]

interface WorkspaceProps {
  user: User
  onLogout: () => void
}

function Workspace({ user, onLogout }: WorkspaceProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const activePage = (location.pathname.split('/')[2] as StaffPage) || 'dashboard'
  const navItems = staffNavItems.filter(
    (item) => (item.page !== 'staff' && item.page !== 'audit-log') || user.role === 'admin',
  )

  return (
    <div className="dash-layout">
      <Sidebar
        activePage={activePage}
        onNavigate={(page) => navigate(`/staff/${page}`)}
        navItems={navItems}
        user={user}
        onLogout={onLogout}
        notificationBell={<NotificationBell scope="staff" />}
      />
      <div className="dash-content">
        <AnnouncementBanner scope="staff" />
        <Routes>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard user={user} onLogout={onLogout} />} />
          <Route path="new-matter" element={<NewMatter />} />
          <Route path="matters" element={<Matters />} />
          <Route path="matters/:matterId" element={<MatterDetail />} />
          <Route path="clients" element={<Clients user={user} />} />
          <Route path="workflow" element={<Workflow />} />
          <Route path="signed-contracts" element={<SignedContracts />} />
          <Route path="reporting" element={<Reporting />} />
          <Route path="contract-data" element={<ContractData />} />
          <Route path="templates" element={<Templates />} />
          <Route path="search" element={<Search />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="settings" element={<Settings user={user} />} />
          <Route path="staff" element={<Staff user={user} />} />
          <Route path="audit-log" element={<AuditLog user={user} />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </div>
    </div>
  )
}

export default Workspace
