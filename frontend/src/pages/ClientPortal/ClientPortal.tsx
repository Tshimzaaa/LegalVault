import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import '../../styles/dashboard.css'
import Sidebar from '../../components/Sidebar'
import type { NavItem } from '../../components/Sidebar'
import AnnouncementBanner from '../../components/AnnouncementBanner'
import NotificationBell from '../../components/NotificationBell'
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
import ClientDashboard from '../ClientDashboard/ClientDashboard'
import ClientWorkflow from '../ClientWorkflow/ClientWorkflow'
import ClientMatterDetail from '../ClientMatterDetail/ClientMatterDetail'
import ClientSignedContracts from '../ClientSignedContracts/ClientSignedContracts'
import ClientReporting from '../ClientReporting/ClientReporting'
import Resources from '../Resources/Resources'
import LearnedFriend from '../LearnedFriend/LearnedFriend'
import LegalGuide from '../LegalHubGuide/LegalHubGuide'
import MatterAdmin from '../MatterAdmin/MatterAdmin'
import ClientTemplates from '../ClientTemplates/ClientTemplates'
import ClientAccountSettings from '../ClientAccountSettings/ClientAccountSettings'
import ClientIntakeForms from '../ClientIntakeForms/ClientIntakeForms'
import ClientIntakeFormDetail from '../ClientIntakeForms/ClientIntakeFormDetail'
import ClientMyIntakeSubmissions from '../ClientMyIntakeSubmissions/ClientMyIntakeSubmissions'
import ClientIntakeSubmissionDetail from '../ClientMyIntakeSubmissions/ClientIntakeSubmissionDetail'
import ClientKnowledgeBase from '../ClientKnowledgeBase/ClientKnowledgeBase'
import ClientKnowledgeArticleDetail from '../ClientKnowledgeBase/ClientKnowledgeArticleDetail'
import type { ClientContact } from '../../api/clientAuth'

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
        <Routes>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ClientDashboard contact={contact} onLogout={onLogout} />} />
          <Route path="workflow" element={<ClientWorkflow contact={contact} onLogout={onLogout} />} />
          <Route path="matters/:matterId" element={<ClientMatterDetail contact={contact} onLogout={onLogout} />} />
          <Route path="signed-contracts" element={<ClientSignedContracts contact={contact} onLogout={onLogout} />} />
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
            element={<ClientAccountSettings contact={contact} onLogout={onLogout} onContactUpdate={onContactUpdate} />}
          />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </div>
    </div>
  )
}

export default ClientPortal
