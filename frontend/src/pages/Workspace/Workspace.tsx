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
  IconInbox,
  IconFilePlus,
  IconMail,
  IconHelp,
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
import SupportRequests from '../SupportRequests/SupportRequests'
import Settings from '../Settings/Settings'
import IntakeFormBuilder from '../IntakeFormBuilder/IntakeFormBuilder'
import IntakeSubmissions from '../IntakeSubmissions/IntakeSubmissions'
import IntakeSubmissionDetail from '../IntakeSubmissions/IntakeSubmissionDetail'
import KnowledgeArticles from '../KnowledgeArticles/KnowledgeArticles'
import Integrations from '../Integrations/Integrations'
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
  | 'support-requests'
  | 'settings'
  | 'intake-forms'
  | 'intake-submissions'
  | 'knowledge-articles'
  | 'integrations'

// Nav items visible only to admins — attempting these as another role now cleanly 403s
// server-side, so we hide the entry rather than show it disabled.
const ADMIN_ONLY_PAGES: StaffPage[] = ['staff', 'audit-log', 'intake-forms', 'integrations']

export const staffNavItems: NavItem[] = [
  { label: 'Dashboard', icon: <IconGauge />, page: 'dashboard' },
  { label: 'New Matter', icon: <IconGavel />, page: 'new-matter' },
  { label: 'Matters', icon: <IconLayers />, page: 'matters' },
  { label: 'Clients', icon: <IconUser />, page: 'clients' },
  { label: 'Calendar', icon: <IconCalendar />, page: 'calendar' },
  { label: 'Workflow', icon: <IconWorkflow />, page: 'workflow' },
  { label: 'Support Requests', icon: <IconInbox />, page: 'support-requests' },
  { label: 'Intake Forms', icon: <IconFilePlus />, page: 'intake-forms' },
  { label: 'Intake Inbox', icon: <IconMail />, page: 'intake-submissions' },
  { label: 'Signed Contracts', icon: <IconSignedContract />, page: 'signed-contracts' },
  { label: 'Reporting', icon: <IconReport />, page: 'reporting' },
  { label: 'Contract Data', icon: <IconContractData />, page: 'contract-data' },
  { label: 'Templates', icon: <IconTemplates />, page: 'templates' },
  { label: 'Knowledge Base', icon: <IconHelp />, page: 'knowledge-articles' },
  { label: 'Search', icon: <IconSearch />, page: 'search' },
  { label: 'Staff', icon: <IconShield />, page: 'staff' },
  { label: 'Audit Log', icon: <IconClock />, page: 'audit-log' },
  { label: 'Integrations', icon: <IconGear />, page: 'integrations' },
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
    (item) => !ADMIN_ONLY_PAGES.includes(item.page as StaffPage) || user.role === 'admin',
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
          <Route path="support-requests" element={<SupportRequests />} />
          <Route path="intake-forms" element={<IntakeFormBuilder user={user} />} />
          <Route path="intake-submissions" element={<IntakeSubmissions />} />
          <Route path="intake-submissions/:submissionId" element={<IntakeSubmissionDetail user={user} />} />
          <Route path="knowledge-articles" element={<KnowledgeArticles user={user} />} />
          <Route path="integrations" element={<Integrations user={user} />} />
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
