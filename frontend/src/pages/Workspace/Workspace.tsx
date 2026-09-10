import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import '../../styles/dashboard.css'
import Sidebar from '../../components/Sidebar'
import AnnouncementBanner from '../../components/AnnouncementBanner'
import NotificationBell from '../../components/NotificationBell'
import RouteSkeleton from '../../components/RouteSkeleton'
import { ADMIN_ONLY_PAGES, staffNavItems } from './staffNav'
import type { StaffPage } from './staffNav'
import type { User } from '../../api/auth'

// Lazy so each staff page's code (and its dependencies, e.g. react-markdown for Knowledge
// Base) only downloads when that page is actually visited, instead of all ~18 shipping in
// one bundle on every staff login.
const Dashboard = lazy(() => import('../Dashboard/Dashboard'))
const NewMatter = lazy(() => import('../NewMatter/NewMatter'))
const Matters = lazy(() => import('../Matters/Matters'))
const MatterDetail = lazy(() => import('../MatterDetail/MatterDetail'))
const Clients = lazy(() => import('../Clients/Clients'))
const Workflow = lazy(() => import('../Workflow/Workflow'))
const SignedContracts = lazy(() => import('../SignedContracts/SignedContracts'))
const Reporting = lazy(() => import('../Reporting/Reporting'))
const ContractData = lazy(() => import('../ContractData/ContractData'))
const Templates = lazy(() => import('../Templates/Templates'))
const Staff = lazy(() => import('../Staff/Staff'))
const Search = lazy(() => import('../Search/Search'))
const AuditLog = lazy(() => import('../AuditLog/AuditLog'))
const Calendar = lazy(() => import('../Calendar/Calendar'))
const Settings = lazy(() => import('../Settings/Settings'))
const IntakeFormBuilder = lazy(() => import('../IntakeFormBuilder/IntakeFormBuilder'))
const IntakeSubmissions = lazy(() => import('../IntakeSubmissions/IntakeSubmissions'))
const IntakeSubmissionDetail = lazy(() => import('../IntakeSubmissions/IntakeSubmissionDetail'))
const KnowledgeArticles = lazy(() => import('../KnowledgeArticles/KnowledgeArticles'))
const Integrations = lazy(() => import('../Integrations/Integrations'))

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
        <Suspense fallback={<RouteSkeleton />}>
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
        </Suspense>
      </div>
    </div>
  )
}

export default Workspace
