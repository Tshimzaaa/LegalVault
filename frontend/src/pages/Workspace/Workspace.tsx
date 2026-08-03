import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './Workspace.css'
import Sidebar from '../../components/Sidebar'
import type { NavItem } from '../../components/Sidebar'
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

export const staffNavItems: NavItem[] = [
  { label: 'Dashboard', icon: <IconGauge />, page: 'dashboard' },
  { label: 'New Matter', icon: <IconGavel />, page: 'new-matter' },
  { label: 'Matters', icon: <IconLayers />, page: 'matters' },
  { label: 'Clients', icon: <IconUser />, page: 'clients' },
  { label: 'Workflow', icon: <IconWorkflow />, page: 'workflow' },
  { label: 'Signed Contracts', icon: <IconSignedContract />, page: 'signed-contracts' },
  { label: 'Reporting', icon: <IconReport />, page: 'reporting' },
  { label: 'Contract Data', icon: <IconContractData />, page: 'contract-data' },
  { label: 'Templates', icon: <IconTemplates />, page: 'templates' },
  { label: 'Staff', icon: <IconShield />, page: 'staff' },
]

interface WorkspaceProps {
  user: User
  onLogout: () => void
}

function Workspace({ user, onLogout }: WorkspaceProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const activePage = (location.pathname.split('/')[2] as StaffPage) || 'dashboard'
  const navItems = staffNavItems.filter((item) => item.page !== 'staff' || user.role === 'admin')

  return (
    <div className="dash-layout">
      <Sidebar
        activePage={activePage}
        onNavigate={(page) => navigate(`/staff/${page}`)}
        navItems={navItems}
        user={user}
        onLogout={onLogout}
      />
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard user={user} onLogout={onLogout} />} />
        <Route path="new-matter" element={<NewMatter />} />
        <Route path="matters" element={<Matters />} />
        <Route path="matters/:matterId" element={<MatterDetail />} />
        <Route path="clients" element={<Clients />} />
        <Route path="workflow" element={<Workflow />} />
        <Route path="signed-contracts" element={<SignedContracts />} />
        <Route path="reporting" element={<Reporting />} />
        <Route path="contract-data" element={<ContractData />} />
        <Route path="templates" element={<Templates />} />
        <Route path="staff" element={<Staff user={user} />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </div>
  )
}

export default Workspace
