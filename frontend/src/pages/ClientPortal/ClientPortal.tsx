import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import '../../styles/dashboard.css'
import Sidebar from '../../components/Sidebar'
import type { NavItem } from '../../components/Sidebar'
import AnnouncementBanner from '../../components/AnnouncementBanner'
import NotificationBell from '../../components/NotificationBell'
import RouteSkeleton from '../../components/RouteSkeleton'
import {
  IconGauge,
  IconFilePlus,
  IconWorkflow,
  IconSignedContract,
  IconReport,
  IconHelp,
  IconLearnedFriend,
  IconGrid,
  IconShield,
  IconTemplates,
  IconUser,
  IconInbox,
} from '../../components/icons'
import type { ClientContact } from '../../api/clientAuth'

// Lazy so each client page's code only downloads when actually visited, instead of all 14
// (including react-markdown for the Knowledge Base) shipping in one bundle on every login.
const ClientDashboard = lazy(() => import('../ClientDashboard/ClientDashboard'))
const ClientWorkflow = lazy(() => import('../ClientWorkflow/ClientWorkflow'))
const ClientMatterDetail = lazy(() => import('../ClientMatterDetail/ClientMatterDetail'))
const ClientSignedContracts = lazy(() => import('../ClientSignedContracts/ClientSignedContracts'))
const ClientReporting = lazy(() => import('../ClientReporting/ClientReporting'))
const Resources = lazy(() => import('../Resources/Resources'))
const LearnedFriend = lazy(() => import('../LearnedFriend/LearnedFriend'))
const LegalGuide = lazy(() => import('../LegalHubGuide/LegalHubGuide'))
const MatterAdmin = lazy(() => import('../MatterAdmin/MatterAdmin'))
const ClientTemplates = lazy(() => import('../ClientTemplates/ClientTemplates'))
const ClientAccountSettings = lazy(() => import('../ClientAccountSettings/ClientAccountSettings'))
const ClientIntakeForms = lazy(() => import('../ClientIntakeForms/ClientIntakeForms'))
const ClientIntakeFormDetail = lazy(() => import('../ClientIntakeForms/ClientIntakeFormDetail'))
const ClientMyIntakeSubmissions = lazy(() => import('../ClientMyIntakeSubmissions/ClientMyIntakeSubmissions'))
const ClientIntakeSubmissionDetail = lazy(() => import('../ClientMyIntakeSubmissions/ClientIntakeSubmissionDetail'))
const ClientKnowledgeBase = lazy(() => import('../ClientKnowledgeBase/ClientKnowledgeBase'))
const ClientKnowledgeArticleDetail = lazy(() => import('../ClientKnowledgeBase/ClientKnowledgeArticleDetail'))

export type ClientPage =
  | 'dashboard'
  | 'workflow'
  | 'signed-contracts'
  | 'reporting'
  | 'resources'
  | 'learned-friend'
  | 'guide'
  | 'matter-admin'
  | 'templates'
  | 'account-settings'
  | 'intake-forms'
  | 'my-intake-submissions'
  | 'knowledge-base'

export const clientNavItems: NavItem[] = [
  { label: 'Dashboard', icon: <IconGauge />, page: 'dashboard' },
  { label: 'Workflow', icon: <IconWorkflow />, page: 'workflow' },
  { label: 'New Request', icon: <IconFilePlus />, page: 'intake-forms' },
  { label: 'My Requests', icon: <IconInbox />, page: 'my-intake-submissions' },
  { label: 'Signed Contracts', icon: <IconSignedContract />, page: 'signed-contracts' },
  { label: 'Data & Reporting', icon: <IconReport />, page: 'reporting' },
  { label: 'Resources', icon: <IconHelp />, page: 'resources' },
  { label: 'Knowledge Base', icon: <IconHelp />, page: 'knowledge-base' },
  { label: 'My Learned Friend', icon: <IconLearnedFriend />, page: 'learned-friend' },
  { label: 'How to Use LegalHub', icon: <IconGrid />, page: 'guide' },
  { label: 'Matter Admin', icon: <IconShield />, page: 'matter-admin' },
  { label: 'Templates', icon: <IconTemplates />, page: 'templates' },
  { label: 'Account Settings', icon: <IconUser />, page: 'account-settings' },
]

interface ClientPortalProps {
  contact: ClientContact
  onLogout: () => void
  onContactUpdate: (contact: ClientContact) => void
}

function ClientPortal({ contact, onLogout, onContactUpdate }: ClientPortalProps) {
  const location = useLocation()
  const rawPage = location.pathname.split('/')[2]
  // Matter detail lives under /client/matters/:id but highlights the Workflow tab it was opened from.
  const activePage: ClientPage = rawPage === 'matters' ? 'workflow' : (rawPage as ClientPage) || 'dashboard'

  return (
    <div className="dash-layout">
      <Sidebar
        activePage={activePage}
        basePath="/client"
        navItems={clientNavItems}
        user={contact}
        onLogout={onLogout}
        brandName="Legal"
        brandSub="client portal"
        notificationBell={<NotificationBell scope="client" />}
      />
      <div className="dash-content" id="main-content">
        <AnnouncementBanner scope="client" />
        <Suspense fallback={<RouteSkeleton />}>
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ClientDashboard contact={contact} onLogout={onLogout} />} />
            <Route path="workflow" element={<ClientWorkflow contact={contact} onLogout={onLogout} />} />
            <Route path="matters/:matterId" element={<ClientMatterDetail contact={contact} onLogout={onLogout} />} />
            <Route
              path="signed-contracts"
              element={<ClientSignedContracts contact={contact} onLogout={onLogout} />}
            />
            <Route path="reporting" element={<ClientReporting contact={contact} onLogout={onLogout} />} />
            <Route path="resources" element={<Resources contact={contact} onLogout={onLogout} />} />
            <Route path="learned-friend" element={<LearnedFriend contact={contact} onLogout={onLogout} />} />
            <Route path="guide" element={<LegalGuide contact={contact} onLogout={onLogout} />} />
            <Route path="matter-admin" element={<MatterAdmin contact={contact} onLogout={onLogout} />} />
            <Route path="intake-forms" element={<ClientIntakeForms contact={contact} onLogout={onLogout} />} />
            <Route
              path="intake-forms/:formId"
              element={<ClientIntakeFormDetail contact={contact} onLogout={onLogout} />}
            />
            <Route
              path="my-intake-submissions"
              element={<ClientMyIntakeSubmissions contact={contact} onLogout={onLogout} />}
            />
            <Route
              path="my-intake-submissions/:submissionId"
              element={<ClientIntakeSubmissionDetail contact={contact} onLogout={onLogout} />}
            />
            <Route path="knowledge-base" element={<ClientKnowledgeBase contact={contact} onLogout={onLogout} />} />
            <Route
              path="knowledge-base/:articleId"
              element={<ClientKnowledgeArticleDetail contact={contact} onLogout={onLogout} />}
            />
            <Route path="templates" element={<ClientTemplates contact={contact} onLogout={onLogout} />} />
            <Route
              path="account-settings"
              element={
                <ClientAccountSettings contact={contact} onLogout={onLogout} onContactUpdate={onContactUpdate} />
              }
            />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  )
}

export default ClientPortal
