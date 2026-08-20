// Nav metadata only — deliberately has no dependency on the actual page components
// (Dashboard, Matters, etc.). Home.tsx's marketing-page carousel needs this list for its
// sidebar mockup; importing it from Workspace.tsx directly would drag every staff page
// into Home's eagerly-loaded bundle and defeat Workspace's route-level code-splitting.
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
  IconSearch,
  IconClock,
  IconCalendar,
  IconGear,
  IconInbox,
  IconFilePlus,
  IconMail,
  IconHelp,
} from '../../components/icons'

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
  | 'search'
  | 'audit-log'
  | 'calendar'
  | 'support-requests'
  | 'settings'
  | 'intake-forms'
  | 'intake-submissions'
  | 'knowledge-articles'
  | 'integrations'

// Nav items visible only to admins — attempting these as another role now cleanly 403s
// server-side, so we hide the entry rather than show it disabled.
export const ADMIN_ONLY_PAGES: StaffPage[] = ['staff', 'audit-log', 'intake-forms', 'integrations']

export const staffNavItems: NavItem[] = [
  { label: 'Dashboard', icon: <IconGauge />, page: 'dashboard' },
  { label: 'New Matter', icon: <IconGavel />, page: 'new-matter' },
  { label: 'Matters', icon: <IconLayers />, page: 'matters' },
  { label: 'Clients', icon: <IconUser />, page: 'clients' },
  { label: 'Calendar', icon: <IconCalendar />, page: 'calendar' },
  { label: 'Workflow', icon: <IconWorkflow />, page: 'workflow' },
  { label: 'Support Requests', icon: <IconInbox />, page: 'support-requests' },
  { label: 'Intake Forms', icon: <IconFilePlus />, page: 'intake-forms' },
  { label: 'Intake Inbox', icon: <IconMail />, page: 'intake-submissions' },
  { label: 'Signed Contracts', icon: <IconSignedContract />, page: 'signed-contracts' },
  { label: 'Reporting', icon: <IconReport />, page: 'reporting' },
  { label: 'Contract Data', icon: <IconContractData />, page: 'contract-data' },
  { label: 'Templates', icon: <IconTemplates />, page: 'templates' },
  { label: 'Knowledge Base', icon: <IconHelp />, page: 'knowledge-articles' },
  { label: 'Search', icon: <IconSearch />, page: 'search' },
  { label: 'Staff', icon: <IconShield />, page: 'staff' },
  { label: 'Audit Log', icon: <IconClock />, page: 'audit-log' },
  { label: 'Integrations', icon: <IconGear />, page: 'integrations' },
  { label: 'Settings', icon: <IconGear />, page: 'settings' },
]
