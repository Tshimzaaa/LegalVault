import { useState } from 'react'
import './Workspace.css'
import Sidebar from '../../components/Sidebar'
import type { Page } from '../../components/Sidebar'
import Dashboard from '../Dashboard/Dashboard'
import NewMatter from '../NewMatter/NewMatter'
import Workflow from '../Workflow/Workflow'
import SignedContracts from '../SignedContracts/SignedContracts'
import Reporting from '../Reporting/Reporting'
import ContractData from '../ContractData/ContractData'
import Templates from '../Templates/Templates'
import type { User } from '../../api/auth'

interface WorkspaceProps {
  user: User
  onLogout: () => void
}

function Workspace({ user, onLogout }: WorkspaceProps) {
  const [activePage, setActivePage] = useState<Page>('dashboard')

  function renderPage() {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard user={user} onLogout={onLogout} />
      case 'new-matter':
        return <NewMatter />
      case 'workflow':
        return <Workflow />
      case 'signed-contracts':
        return <SignedContracts />
      case 'reporting':
        return <Reporting />
      case 'contract-data':
        return <ContractData />
      case 'templates':
        return <Templates />
    }
  }

  return (
    <div className="dash-layout">
      <Sidebar activePage={activePage} onNavigate={setActivePage} user={user} onLogout={onLogout} />
      {renderPage()}
    </div>
  )
}

export default Workspace
