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
const NewContract = lazy(() => import('../NewContract/NewContract'))
const Contracts = lazy(() => import('../Contracts/Contracts'))
const ContractDetail = lazy(() => import('../ContractDetail/ContractDetail'))
const Workflow = lazy(() => import('../Workflow/Workflow'))
const SignedContracts = lazy(() => import('../SignedContracts/SignedContracts'))
const Reporting = lazy(() => import('../Reporting/Reporting'))
const Templates = lazy(() => import('../Templates/Templates'))
const FallbackClauses = lazy(() => import('../FallbackClauses/FallbackClauses'))
const LearnedFriend = lazy(() => import('../LearnedFriend/LearnedFriend'))
const IntakeFormBuilder = lazy(() => import('../IntakeFormBuilder/IntakeFormBuilder'))
const IntakeSubmissions = lazy(() => import('../IntakeSubmissions/IntakeSubmissions'))
const Staff = lazy(() => import('../Staff/Staff'))
const Search = lazy(() => import('../Search/Search'))
const AuditLog = lazy(() => import('../AuditLog/AuditLog'))
const Calendar = lazy(() => import('../Calendar/Calendar'))
const Settings = lazy(() => import('../Settings/Settings'))
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
        notificationBell={<NotificationBell />}
      />
      <div className="dash-content" id="main-content">
        <AnnouncementBanner />
        <Suspense fallback={<RouteSkeleton />}>
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard user={user} onLogout={onLogout} />} />
            <Route path="new-contract" element={<NewContract />} />
            <Route path="contracts" element={<Contracts />} />
            <Route path="contracts/:contractId" element={<ContractDetail />} />
            <Route path="workflow" element={<Workflow />} />
            <Route path="signed-contracts" element={<SignedContracts />} />
            <Route path="reporting" element={<Reporting user={user} />} />
            <Route path="templates" element={<Templates />} />
            <Route path="fallback-clauses" element={<FallbackClauses />} />
            <Route path="learned-friend" element={<LearnedFriend />} />
            <Route path="intake-forms" element={<IntakeFormBuilder />} />
            <Route path="intake-submissions" element={<IntakeSubmissions />} />
            <Route path="search" element={<Search />} />
            <Route path="calendar" element={<Calendar />} />
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
