import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './Workspace.css'
import Sidebar from '../../components/Sidebar'
import type { NavItem } from '../../components/Sidebar'
import {
  IconGauge,
  IconGavel,
  IconWorkflow,
  IconSignedContract,
  IconReport,
  IconContractData,
  IconTemplates,
} from '../../components/icons'
import Dashboard from '../Dashboard/Dashboard'
import NewMatter from '../NewMatter/NewMatter'
import Workflow from '../Workflow/Workflow'
import SignedContracts from '../SignedContracts/SignedContracts'
import Reporting from '../Reporting/Reporting'
import ContractData from '../ContractData/ContractData'
import Templates from '../Templates/Templates'
import type { User } from '../../api/auth'

export type StaffPage =
  | 'dashboard'
  | 'new-matter'
  | 'workflow'
  | 'signed-contracts'
  | 'reporting'
  | 'contract-data'
  | 'templates'

export const staffNavItems: NavItem[] = [
  { label: 'Dashboard', icon: <IconGauge />, page: 'dashboard' },
  { label: 'New Matter', icon: <IconGavel />, page: 'new-matter' },
  { label: 'Workflow', icon: <IconWorkflow />, page: 'workflow' },
  { label: 'Signed Contracts', icon: <IconSignedContract />, page: 'signed-contracts' },
  { label: 'Reporting', icon: <IconReport />, page: 'reporting' },
  { label: 'Contract Data', icon: <IconContractData />, page: 'contract-data' },
  { label: 'Templates', icon: <IconTemplates />, page: 'templates' },
]

interface WorkspaceProps {
  user: User
  onLogout: () => void
}

function Workspace({ user, onLogout }: WorkspaceProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const activePage = (location.pathname.split('/')[2] as StaffPage) || 'dashboard'

  return (
    <div className="dash-layout">
      <Sidebar
        activePage={activePage}
        onNavigate={(page) => navigate(`/staff/${page}`)}
        navItems={staffNavItems}
        user={user}
        onLogout={onLogout}
      />
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard user={user} onLogout={onLogout} />} />
        <Route path="new-matter" element={<NewMatter />} />
        <Route path="workflow" element={<Workflow />} />
        <Route path="signed-contracts" element={<SignedContracts />} />
        <Route path="reporting" element={<Reporting />} />
        <Route path="contract-data" element={<ContractData />} />
        <Route path="templates" element={<Templates />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </div>
  )
}

export default Workspace
