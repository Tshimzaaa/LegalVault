import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import '../../styles/dashboard.css'
import '../../styles/mobile.css'
import './OwnerPortal.css'
import Sidebar from '../../components/Sidebar'
import type { NavItem } from '../../components/Sidebar'
import { IconBuilding, IconClock, IconGauge, IconInbox, IconMegaphone, IconShield } from '../../components/icons'
import { OwnerDataProvider, useOwnerData } from './OwnerDataContext'
import OverviewView from './views/OverviewView'
import InquiriesView from './views/InquiriesView'
import OrganizationsView from './views/OrganizationsView'
import HealthView from './views/HealthView'
import AnnouncementsView from './views/AnnouncementsView'
import AuditView from './views/AuditView'

const MOBILE_TABS = ['overview', 'inquiries', 'organizations']
const OWNER_USER = { first_name: 'Platform', last_name: 'owner', email: 'Owner account' }

interface OwnerPortalProps {
  onLogout: () => void
}

function OwnerShell({ onLogout }: OwnerPortalProps) {
  const location = useLocation()
  const { summary } = useOwnerData()
  const activePage = location.pathname.split('/')[2] || 'overview'

  const navItems: NavItem[] = [
    { label: 'Overview', icon: <IconGauge />, page: 'overview' },
    { label: 'Inquiries', icon: <IconInbox />, page: 'inquiries', badge: summary?.new ?? 0 },
    { label: 'Organizations', icon: <IconBuilding />, page: 'organizations' },
    { label: 'Platform health', icon: <IconShield />, page: 'health' },
    { label: 'Announcements', icon: <IconMegaphone />, page: 'announcements' },
    { label: 'Audit log', icon: <IconClock />, page: 'audit' },
  ]

  return (
    <div className="dash-layout">
      <Sidebar
        activePage={activePage}
        basePath="/owner"
        navItems={navItems}
        user={OWNER_USER}
        onLogout={onLogout}
        brandSub="owner console"
        mobileTabs={MOBILE_TABS}
      />
      <div className="dash-content" id="main-content" tabIndex={-1}>
        <Routes>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewView />} />
          <Route path="inquiries/:id?" element={<InquiriesView />} />
          <Route path="organizations/*" element={<OrganizationsView />} />
          <Route path="health" element={<HealthView />} />
          <Route path="announcements" element={<AnnouncementsView />} />
          <Route path="audit" element={<AuditView />} />
          <Route path="*" element={<Navigate to="overview" replace />} />
        </Routes>
      </div>
    </div>
  )
}

function OwnerPortal({ onLogout }: OwnerPortalProps) {
  return (
    <OwnerDataProvider>
      <OwnerShell onLogout={onLogout} />
    </OwnerDataProvider>
  )
}

export default OwnerPortal
