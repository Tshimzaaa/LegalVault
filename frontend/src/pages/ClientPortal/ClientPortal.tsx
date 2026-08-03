import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import type { NavItem } from '../../components/Sidebar'
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
  IconGear,
  IconTemplates,
} from '../../components/icons'
import ClientDashboard from '../ClientDashboard/ClientDashboard'
import RequestSupport from '../RequestSupport/RequestSupport'
import ClientWorkflow from '../ClientWorkflow/ClientWorkflow'
import ClientMatterDetail from '../ClientMatterDetail/ClientMatterDetail'
import ClientSignedContracts from '../ClientSignedContracts/ClientSignedContracts'
import ClientReporting from '../ClientReporting/ClientReporting'
import Resources from '../Resources/Resources'
import LearnedFriend from '../LearnedFriend/LearnedFriend'
import LegalGuide from '../LightHubGuide/LightHubGuide'
import MatterAdmin from '../MatterAdmin/MatterAdmin'
import Integrations from '../Integrations/Integrations'
import ClientTemplates from '../ClientTemplates/ClientTemplates'
import type { ClientContact } from '../../api/clientAuth'

export type ClientPage =
  | 'dashboard'
  | 'request-support'
  | 'workflow'
  | 'signed-contracts'
  | 'reporting'
  | 'resources'
  | 'learned-friend'
  | 'guide'
  | 'matter-admin'
  | 'integrations'
  | 'templates'

export const clientNavItems: NavItem[] = [
  { label: 'Dashboard', icon: <IconGauge />, page: 'dashboard' },
  { label: 'Request Support', icon: <IconFilePlus />, page: 'request-support' },
  { label: 'Workflow', icon: <IconWorkflow />, page: 'workflow' },
  { label: 'Signed Contracts', icon: <IconSignedContract />, page: 'signed-contracts' },
  { label: 'Data & Reporting', icon: <IconReport />, page: 'reporting' },
  { label: 'Resources', icon: <IconHelp />, page: 'resources' },
  { label: 'My Learned Friend', icon: <IconLearnedFriend />, page: 'learned-friend' },
  { label: 'How to use LightHub', icon: <IconGrid />, page: 'guide' },
  { label: 'Matter Admin', icon: <IconShield />, page: 'matter-admin' },
  { label: 'Integrations', icon: <IconGear />, page: 'integrations' },
  { label: 'Templates', icon: <IconTemplates />, page: 'templates' },
]

interface ClientPortalProps {
  contact: ClientContact
  onLogout: () => void
}

function ClientPortal({ contact, onLogout }: ClientPortalProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const rawPage = location.pathname.split('/')[2]
  // Matter detail lives under /client/matters/:id but highlights the Workflow tab it was opened from.
  const activePage: ClientPage = rawPage === 'matters' ? 'workflow' : (rawPage as ClientPage) || 'dashboard'

  return (
    <div className="dash-layout">
      <Sidebar
        activePage={activePage}
        onNavigate={(page) => navigate(`/client/${page}`)}
        navItems={clientNavItems}
        user={contact}
        onLogout={onLogout}
        brandName="Legal"
        brandSub="client portal"
      />
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ClientDashboard contact={contact} onLogout={onLogout} />} />
        <Route path="request-support" element={<RequestSupport contact={contact} onLogout={onLogout} />} />
        <Route path="workflow" element={<ClientWorkflow contact={contact} onLogout={onLogout} />} />
        <Route path="matters/:matterId" element={<ClientMatterDetail contact={contact} onLogout={onLogout} />} />
        <Route path="signed-contracts" element={<ClientSignedContracts contact={contact} onLogout={onLogout} />} />
        <Route path="reporting" element={<ClientReporting contact={contact} onLogout={onLogout} />} />
        <Route path="resources" element={<Resources contact={contact} onLogout={onLogout} />} />
        <Route path="learned-friend" element={<LearnedFriend contact={contact} onLogout={onLogout} />} />
        <Route path="guide" element={<LegalGuide contact={contact} onLogout={onLogout} />} />
        <Route path="matter-admin" element={<MatterAdmin contact={contact} onLogout={onLogout} />} />
        <Route path="integrations" element={<Integrations contact={contact} onLogout={onLogout} />} />
        <Route path="templates" element={<ClientTemplates contact={contact} onLogout={onLogout} />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </div>
  )
}

export default ClientPortal
