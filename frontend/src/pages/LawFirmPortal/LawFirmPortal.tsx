import './LawFirmPortal.css'
import {
  IconSearch,
  IconBell,
  IconChevronDown,
  IconGauge,
  IconUsers,
  IconMatters,
  IconWorkflow,
  IconCalendar,
  IconCheckSquare,
  IconInbox,
  IconFileText,
  IconESign,
  IconGear,
  IconShield,
  IconGavel,
  IconPlus,
  IconAlertTriangle,
  IconFolder,
  IconClock,
  IconMessageCircle,
  IconUser,
  IconDots,
  IconArrowUp,
  IconArrowDown,
  IconArrowRight,
  IconArrowLeft,
  IconMail,
  IconBarChart,
  IconPause,
} from './icons'

interface NavEntry {
  label: string
  icon: React.ReactNode
  badge?: number
  active?: boolean
}

const menuItems: NavEntry[] = [
  { label: 'Dashboard', icon: <IconGauge />, active: true },
  { label: 'Clients', icon: <IconUsers /> },
  { label: 'Matters', icon: <IconMatters /> },
  { label: 'Workflows', icon: <IconWorkflow /> },
  { label: 'Calendar', icon: <IconCalendar /> },
  { label: 'Tasks', icon: <IconCheckSquare />, badge: 14 },
  { label: 'Intake Queue', icon: <IconInbox />, badge: 7 },
  { label: 'Documents', icon: <IconFileText /> },
  { label: 'Reporting', icon: <IconBarChart /> },
  { label: 'E-Signatures', icon: <IconESign /> },
]

const adminItems: NavEntry[] = [
  { label: 'Users', icon: <IconUsers /> },
  { label: 'Settings', icon: <IconGear /> },
  { label: 'Audit Logs', icon: <IconShield /> },
]

const statCards = [
  {
    label: 'Total Active Matters',
    value: '34',
    unit: 'Active',
    change: '12% from last month',
    icon: <IconFolder />,
    tone: 'green' as const,
  },
  {
    label: 'Pending Registrations',
    value: '14',
    unit: 'Awaiting activation',
    change: '7% from last month',
    icon: <IconUsers />,
    tone: 'green' as const,
  },
  {
    label: 'In-Progress Workflows',
    value: '29',
    unit: 'Active',
    change: '8% from last month',
    icon: <IconClock />,
    tone: 'green' as const,
  },
  {
    label: 'Urgent Alerts',
    value: '7',
    unit: 'Requires attention',
    link: 'View all alerts',
    icon: <IconAlertTriangle />,
    tone: 'red' as const,
  },
]

const intakeQueue = [
  {
    title: 'NDA Request (Apex Corp)',
    meta: 'High Priority • Awaiting Review',
    icon: <IconMessageCircle />,
    tone: 'green' as const,
    status: 'Assigned',
  },
  {
    title: 'Lease Review (John Doe)',
    meta: 'Medium Priority • Attorney Assigned',
    icon: <IconUser />,
    tone: 'gray' as const,
    status: 'Assigned',
  },
  {
    title: 'General Inquiry (Jane Smith)',
    meta: 'Low Priority • Conflict Check',
    icon: <IconFileText />,
    tone: 'gray' as const,
    status: 'Status',
  },
]

const deadlines = [
  { month: 'MAR', day: '15', title: 'Pleadings cut-off', sub: 'Case 2024-101' },
  { month: 'MAR', day: '18', title: 'Discovery close', sub: 'Case 2024-105' },
  { month: 'APR', day: '10', title: 'Contract renewal window opens', sub: 'MSA-2022-051' },
]

const analytics = [
  {
    icon: <IconClock />,
    label: 'Avg. Response Time',
    sub: '(Client-Facing Tasks)',
    value: '1.8 hrs',
  },
  {
    icon: <IconMail />,
    label: 'Avg. Response Time',
    sub: '(Internal Tasks)',
    value: '4.6 hrs',
  },
  {
    icon: <IconBarChart />,
    label: 'Client Portal Logins',
    sub: 'This month',
    value: '128',
  },
  {
    icon: <IconFileText />,
    label: 'Document Completion Rate',
    sub: 'This month',
    value: '92%',
  },
]

const staffFeed = [
  {
    who: 'A. Deff',
    initials: 'AD',
    task: 'Completed Contract Drafting (High Vol.)',
    time: '11m ago',
    tag: 'High Vol.',
    tone: 'red' as const,
  },
  {
    who: 'E. Adenike',
    initials: 'EA',
    task: 'Reviewed SOW (Completed)',
    time: '26m ago',
    tag: 'Completed',
    tone: 'green' as const,
  },
  {
    who: 'Portal',
    initials: null,
    icon: <IconMessageCircle />,
    task: "Received e-sign [SA-2024-101] (Apex Corp)",
    time: '1h ago',
    tag: 'Complete',
    tone: 'green' as const,
  },
  {
    who: 'Staff [T.M.]',
    initials: null,
    icon: <IconUser />,
    task: "Advanced Lease Workflow to 'Execution' Stage",
    time: '1h ago',
    tag: null,
    tone: 'gray' as const,
  },
]

const turnaround = [
  { label: 'NDA Intake Turnaround Time', sub: null, value: '3 days', change: '12%', dir: 'down' as const },
  { label: 'Lease Approval Time', sub: '(27 tasks)', value: '2.1 days', change: '8%', dir: 'down' as const },
  { label: 'Executed Documents', sub: null, value: '20', change: '5%', dir: 'up' as const },
  { label: 'Client Doc Response Time', sub: null, value: '1.6 days', change: '15%', dir: 'down' as const },
]

function Avatar({ initials }: { initials: string }) {
  return <span className="lo-avatar-circle">{initials}</span>
}

interface LawFirmPortalProps {
  onBack?: () => void
}

function LawFirmPortal({ onBack }: LawFirmPortalProps) {
  return (
    <div className="lo-app">
      <aside className="lo-sidebar">
        <div className="lo-brand">
          <span className="lo-brand-mark">
            <IconGavel />
          </span>
          <span className="lo-brand-text">
            <span className="lo-brand-name">LEGAL</span>
            <span className="lo-brand-sub">
              practice management
              <br />
              platform
            </span>
          </span>
        </div>

        <div className="lo-nav-scroll">
          <div className="lo-menu-label">MENU</div>
          <nav className="lo-nav">
            {menuItems.map((item) => (
              <button key={item.label} type="button" className={`lo-nav-item${item.active ? ' active' : ''}`}>
                <span className="lo-nav-icon">{item.icon}</span>
                <span className="lo-nav-label">{item.label}</span>
                {item.badge != null && <span className="lo-nav-badge">{item.badge}</span>}
              </button>
            ))}
          </nav>

          <div className="lo-menu-label lo-admin-label">ADMIN</div>
          <nav className="lo-nav">
            {adminItems.map((item) => (
              <button key={item.label} type="button" className="lo-nav-item">
                <span className="lo-nav-icon">{item.icon}</span>
                <span className="lo-nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="lo-account">
          <Avatar initials="TM" />
          <span className="lo-account-info">
            <span className="lo-account-name">Totok Michael</span>
            <span className="lo-account-email">tmichael20@email.com</span>
          </span>
          <IconChevronDown />
        </div>
      </aside>

      <div className="lo-main">
        <header className="lo-topbar">
          <button type="button" className="lo-back-btn" onClick={onBack}>
            <IconArrowLeft /> Back to Home
          </button>
          <div className="lo-search">
            <IconSearch />
            <input type="text" placeholder="Search clients, matters, tasks..." readOnly />
            <span className="lo-kbd">⌘ K</span>
          </div>
          <div className="lo-topbar-right">
            <button type="button" className="lo-bell-btn" aria-label="Notifications">
              <IconBell />
              <span className="lo-bell-dot" />
            </button>
            <div className="lo-topbar-account">
              <Avatar initials="TM" />
              <span className="lo-account-info">
                <span className="lo-account-name dark">Totok Michael</span>
                <span className="lo-account-email">tmichael20@email.com</span>
              </span>
              <IconChevronDown />
            </div>
          </div>
        </header>

        <div className="lo-page-head">
          <div>
            <h1>Dashboard</h1>
            <p>Oversee firm operations, manage clients, and execute legal work with speed.</p>
          </div>
          <div className="lo-head-actions">
            <button type="button" className="lo-btn-primary">
              <IconPlus /> Register New Client
            </button>
            <button type="button" className="lo-btn-secondary">Batch Invite Clients</button>
          </div>
        </div>

        <section className="lo-stats-row">
          {statCards.map((s) => (
            <div key={s.label} className="lo-card lo-stat-card">
              <div className="lo-stat-top">
                <span className="lo-stat-label">{s.label}</span>
                <span className={`lo-stat-icon tone-${s.tone}`}>{s.icon}</span>
              </div>
              <div className="lo-stat-value-row">
                <span className="lo-stat-value">{s.value}</span>
                <span className="lo-stat-unit">{s.unit}</span>
              </div>
              {s.link ? (
                <a className="lo-stat-link" href="#alerts">
                  {s.link} <IconArrowRight />
                </a>
              ) : (
                <span className="lo-stat-change">
                  <IconArrowUp /> {s.change}
                </span>
              )}
            </div>
          ))}
        </section>

        <section className="lo-row lo-row-2">
          <div className="lo-card lo-intake-card">
            <div className="lo-card-header">
              <span>Matter Intake Review Queue</span>
              <button type="button" className="lo-pill-btn">
                <IconPlus /> Quick Add
              </button>
            </div>
            <div className="lo-intake-list">
              {intakeQueue.map((item) => (
                <div key={item.title} className="lo-intake-row">
                  <span className={`lo-row-icon tone-${item.tone}`}>{item.icon}</span>
                  <span className="lo-row-text">
                    <span className="lo-row-title">{item.title}</span>
                    <span className="lo-row-sub">{item.meta}</span>
                  </span>
                  <span className="lo-status-pill">{item.status}</span>
                  <button type="button" className="lo-icon-btn" aria-label="Comment">
                    <IconMessageCircle />
                  </button>
                  <button type="button" className="lo-icon-btn" aria-label="More">
                    <IconDots />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="lo-card lo-deadlines-card">
            <div className="lo-card-header">
              <span>Upcoming Deadlines</span>
            </div>
            <div className="lo-deadlines-list">
              {deadlines.map((d) => (
                <div key={d.title} className="lo-deadline-row">
                  <span className="lo-date-box">
                    <span className="lo-date-month">{d.month}</span>
                    <span className="lo-date-day">{d.day}</span>
                  </span>
                  <span className="lo-row-text">
                    <span className="lo-row-title">{d.title}</span>
                    <span className="lo-row-sub">{d.sub}</span>
                  </span>
                </div>
              ))}
            </div>
            <a className="lo-view-link" href="#calendar">
              View calendar <IconArrowRight />
            </a>
          </div>

          <div className="lo-card lo-analytics-card">
            <div className="lo-card-header">
              <span>Analytics Overview</span>
            </div>
            <div className="lo-analytics-list">
              {analytics.map((a, i) => (
                <div key={i} className="lo-analytics-row">
                  <span className="lo-row-icon tone-gray">{a.icon}</span>
                  <span className="lo-row-text">
                    <span className="lo-row-title">{a.label}</span>
                    <span className="lo-row-sub">{a.sub}</span>
                  </span>
                  <span className="lo-analytics-value">{a.value}</span>
                </div>
              ))}
            </div>
            <a className="lo-view-link" href="#report">
              View full report <IconArrowRight />
            </a>
          </div>
        </section>

        <section className="lo-row lo-row-3">
          <div className="lo-card lo-staff-card">
            <div className="lo-card-header">
              <span>Staff Task &amp; Bottleneck Feed</span>
              <button type="button" className="lo-pill-btn">
                <IconPlus /> Add Task
              </button>
            </div>
            <div className="lo-staff-list">
              {staffFeed.map((f) => (
                <div key={f.who} className="lo-staff-row">
                  {f.initials ? (
                    <Avatar initials={f.initials} />
                  ) : (
                    <span className="lo-row-icon tone-gray">{f.icon}</span>
                  )}
                  <span className="lo-row-text">
                    <span className="lo-row-title">{f.who}</span>
                    <span className="lo-row-sub">{f.task}</span>
                  </span>
                  <span className="lo-staff-right">
                    <span className="lo-staff-time">{f.time}</span>
                    {f.tag ? (
                      <span className={`lo-tag tone-${f.tone}`}>{f.tag}</span>
                    ) : (
                      <button type="button" className="lo-icon-btn" aria-label="More">
                        <IconDots />
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="lo-card lo-turnaround-card">
            <div className="lo-turnaround-header">
              <span>Metric</span>
              <span>This Month</span>
            </div>
            <div className="lo-turnaround-list">
              {turnaround.map((t) => (
                <div key={t.label} className="lo-turnaround-row">
                  <span className="lo-row-text">
                    <span className="lo-row-title">{t.label}</span>
                    {t.sub && <span className="lo-row-sub">{t.sub}</span>}
                  </span>
                  <span className="lo-turnaround-value-col">
                    <span className="lo-turnaround-value">{t.value}</span>
                    <span className="lo-turnaround-change">
                      {t.dir === 'up' ? <IconArrowUp /> : <IconArrowDown />}
                      {t.change}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="lo-card lo-tracker-card">
            <span className="lo-tracker-label">Time Tracker</span>
            <span className="lo-tracker-session-label">Current Session</span>
            <span className="lo-tracker-time">01:24:08</span>
            <span className="lo-tracker-total">Today&rsquo;s Total: 03:45:12</span>
            <button type="button" className="lo-tracker-stop">
              <span className="lo-tracker-stop-icon">
                <IconPause />
              </span>
              Stop
            </button>
            <svg className="lo-tracker-waves" viewBox="0 0 300 200" preserveAspectRatio="none">
              <path d="M0 150 C 60 100, 120 200, 180 130 S 300 90, 300 140" stroke="rgba(255,255,255,0.08)" strokeWidth="2" fill="none" />
              <path d="M0 180 C 70 130, 130 220, 190 160 S 300 120, 300 170" stroke="rgba(255,255,255,0.06)" strokeWidth="2" fill="none" />
            </svg>
          </div>
        </section>
      </div>
    </div>
  )
}

export default LawFirmPortal
