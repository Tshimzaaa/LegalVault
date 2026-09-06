import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import '../../styles/dashboard.css'
import Sidebar from '../../components/Sidebar'
import AnnouncementBanner from '../../components/AnnouncementBanner'
import NotificationBell from '../../components/NotificationBell'
import { ADMIN_ONLY_PAGES, staffNavItems } from './staffNav'
import type { StaffPage } from './staffNav'
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
import IntakeFormBuilder from '../IntakeFormBuilder/IntakeFormBuilder'
import IntakeSubmissions from '../IntakeSubmissions/IntakeSubmissions'
import IntakeSubmissionDetail from '../IntakeSubmissions/IntakeSubmissionDetail'
import KnowledgeArticles from '../KnowledgeArticles/KnowledgeArticles'
import Integrations from '../Integrations/Integrations'
import type { User } from '../../api/auth'

interface WorkspaceProps {
  user: User
  onLogout: () => void
}

function Workspace({ user, onLogout }: WorkspaceProps) {
  const location = useLocation()
  const activePage = (location.pathname.split('/')[2] as StaffPage) || 'dashboard'
  const navItems = staffNavItems.filter(
    (item) => !ADMIN_ONLY_PAGES.includes(item.page as StaffPage) || user.role === 'admin',
  )

  return (
    <div className="dash-layout">
      <Sidebar
        activePage={activePage}
        basePath="/staff"
        navItems={navItems}
        user={user}
        onLogout={onLogout}
        notificationBell={<NotificationBell scope="staff" />}
      />
      <div className="dash-content" id="main-content">
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
