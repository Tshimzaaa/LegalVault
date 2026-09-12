// Nav metadata only — kept out of ClientPortal.tsx so editing that file doesn't force a full
// reload instead of Fast Refresh (Vite can't hot-patch a file that exports both a component
// and other values). Mirrors staffNav.tsx's split for the same reason.
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
  IconTemplates,
  IconUser,
  IconInbox,
} from '../../components/icons'

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
