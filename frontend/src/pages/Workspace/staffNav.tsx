// Nav metadata only — deliberately has no dependency on the actual page components
// (Dashboard, Contracts, etc.). Home.tsx's marketing-page carousel needs this list for its
// sidebar mockup; importing it from Workspace.tsx directly would drag every staff page
// into Home's eagerly-loaded bundle and defeat Workspace's route-level code-splitting.
import type { NavItem } from '../../components/Sidebar'
import {
  IconGauge,
  IconGavel,
  IconLayers,
  IconWorkflow,
  IconSignedContract,
  IconReport,
  IconTemplates,
  IconLearnedFriend,
  IconShield,
  IconSearch,
  IconClock,
  IconCalendar,
  IconGear,
  IconHelp,
} from '../../components/icons'

export type StaffPage =
  | 'dashboard'
  | 'new-contract'
  | 'contracts'
  | 'workflow'
  | 'signed-contracts'
  | 'reporting'
  | 'templates'
  | 'fallback-clauses'
  | 'staff'
  | 'search'
  | 'audit-log'
  | 'calendar'
  | 'settings'
  | 'knowledge-articles'
  | 'integrations'

// Nav items visible only to admins — attempting these as another role now cleanly 403s
// server-side, so we hide the entry rather than show it disabled.
export const ADMIN_ONLY_PAGES: StaffPage[] = ['staff', 'audit-log', 'integrations']

export const staffNavItems: NavItem[] = [
  { label: 'Dashboard', icon: <IconGauge />, page: 'dashboard' },
  { label: 'New Contract', icon: <IconGavel />, page: 'new-contract' },
  { label: 'Contracts', icon: <IconLayers />, page: 'contracts' },
  { label: 'Calendar', icon: <IconCalendar />, page: 'calendar' },
  { label: 'Workflow', icon: <IconWorkflow />, page: 'workflow' },
  { label: 'Signed Contracts', icon: <IconSignedContract />, page: 'signed-contracts' },
  { label: 'Reporting', icon: <IconReport />, page: 'reporting' },
  { label: 'Templates', icon: <IconTemplates />, page: 'templates' },
  { label: 'Fallback Clauses', icon: <IconLearnedFriend />, page: 'fallback-clauses' },
  { label: 'Knowledge Base', icon: <IconHelp />, page: 'knowledge-articles' },
  { label: 'Search', icon: <IconSearch />, page: 'search' },
  { label: 'Staff', icon: <IconShield />, page: 'staff' },
  { label: 'Audit Log', icon: <IconClock />, page: 'audit-log' },
  { label: 'Integrations', icon: <IconGear />, page: 'integrations' },
  { label: 'Settings', icon: <IconGear />, page: 'settings' },
]
