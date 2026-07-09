import { useEffect, useRef, useState } from 'react'
import './Dashboard.css'
import {
  IconChevron,
  IconPlus,
  IconMinus,
  IconFlag,
  IconDownload,
  IconCheckCircle,
  IconMail,
  IconHelp,
} from '../../components/icons'
import type { User } from '../../api/auth'

function Ring({ value, size = 46 }: { value: number; size?: number }) {
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - value / 100)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#22c55e"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="53%" textAnchor="middle" dominantBaseline="middle" className="ring-label">
        {value}
      </text>
    </svg>
  )
}

const contractStatus = [
  { label: 'Draft', count: 2, color: '#22c55e' },
  { label: 'Pending Sign', count: 2, color: '#f97316' },
  { label: 'Active', count: 1, color: '#22c55e' },
  { label: 'Archived', count: 1, color: '#9ca3af' },
]

const deadlines = [
  { title: 'Review Employment Contract', deadline: '25 days', flag: '#f97316' },
  { title: 'Submit Document', deadline: '19 days', flag: '#ef4444' },
  { title: 'Review Employment Contract', deadline: '10 mins', flag: '#ef4444' },
  { title: 'Submit Document', deadline: '4 days', flag: '#ef4444' },
]

const tasks = [
  { title: 'Review Employment Contract', deadline: '36 days' },
  { title: 'Submit Document', deadline: '19 days' },
  { title: 'Review Employment Contract', deadline: '10 mins' },
]

function ProfileMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const initials = `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase()

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="profile-menu-root" ref={rootRef}>
      <button
        type="button"
        className="profile-avatar-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
      >
        {initials}
      </button>

      {open && (
        <div className="profile-menu">
          <div className="profile-menu-header">
            <span className="profile-menu-avatar">{initials}</span>
            <span className="profile-menu-name">
              {user.first_name} {user.last_name}
            </span>
            <span className="profile-menu-email">{user.email}</span>
          </div>
          <div className="profile-menu-divider" />
          <button
            type="button"
            className="profile-menu-logout"
            onClick={() => {
              setOpen(false)
              onLogout()
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

interface DashboardProps {
  user: User
  onLogout: () => void
}

function Dashboard({ user, onLogout }: DashboardProps) {
  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Dashboard</h1>
        <ProfileMenu user={user} onLogout={onLogout} />
      </header>

      <section className="dash-row row-1">
        <div className="card active-cases">
          <div className="card-header">
            <span>Active Cases</span>
            <button className="icon-btn" type="button" aria-label="Add">
              <IconPlus />
            </button>
          </div>
          <div className="stat-line">
            <span className="stat-big">3</span>
            <span className="stat-sub">count</span>
          </div>
          <div className="stat-line">
            <span className="stat-big">R78k</span>
            <span className="stat-sub">total value</span>
          </div>
          <div className="progress-track">
            <span className="progress-fill" style={{ width: '62%' }} />
          </div>
        </div>

        <div className="card contract-status">
          <div className="card-header">
            <span>Contract Status</span>
            <button className="icon-btn" type="button" aria-label="Add">
              <IconPlus />
            </button>
          </div>
          <div className="contract-status-body">
            <div className="contract-status-list">
              <div className="stat-line">
                <span className="stat-big">6</span>
                <span className="stat-sub">Total</span>
              </div>
              {contractStatus.map((s) => (
                <div key={s.label} className="status-row">
                  <span className="status-dot" style={{ background: s.color }} />
                  <span className="status-label">{s.label}</span>
                  <span className="status-count">{s.count}</span>
                </div>
              ))}
            </div>
            <div className="contract-status-rings">
              <Ring value={70} />
              <Ring value={50} />
              <Ring value={10} />
            </div>
          </div>
        </div>

        <div className="card key-deadlines">
          <div className="card-header">
            <span>Key Deadlines</span>
            <button className="chip">
              Filter <IconChevron /> <span className="chip-badge">4</span>
            </button>
          </div>
          <div className="deadlines-filter">
            <span className="deadlines-filter-label">Urgency</span>
            <button className="chip small">
              Select <IconChevron />
            </button>
            <span className="urgency-badge">High</span>
          </div>
          <div className="deadlines-list">
            {deadlines.map((d, i) => (
              <div key={i} className="deadline-row">
                <IconFlag color={d.flag} />
                <div className="deadline-text">
                  <span className="deadline-title">{d.title}</span>
                  <span className="deadline-sub">Deadline: {d.deadline}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dash-row row-2">
        <div className="card financial-summary">
          <div className="card-header">
            <span>Financial Summary</span>
            <button className="icon-btn" type="button" aria-label="Add">
              <IconPlus />
            </button>
          </div>
          <span className="stat-sub top">Billable Hours</span>
          <div className="stat-line">
            <span className="stat-big">14</span>
            <span className="stat-sub">R-value</span>
          </div>
          <svg className="sparkline" viewBox="0 0 120 40" preserveAspectRatio="none">
            <polyline
              points="0,32 15,28 30,30 45,18 60,22 75,10 90,14 105,4 120,8"
              fill="none"
              stroke="#22c55e"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="card recent-documents">
          <div className="card-header">
            <span>Recent Documents</span>
            <button className="icon-btn" type="button" aria-label="Collapse">
              <IconMinus />
            </button>
          </div>
          <span className="card-subtitle">last 5 files</span>
          <div className="list-rows">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="doc-row">
                <span className="doc-icon">
                  <IconDownload />
                </span>
                <div className="deadline-text">
                  <span className="deadline-title">Download</span>
                  <span className="deadline-sub">last 5 files</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card tasks-deadlines">
          <div className="card-header">
            <span>Tasks &amp; Deadlines</span>
            <button className="icon-btn" type="button" aria-label="Collapse">
              <IconMinus />
            </button>
          </div>
          <div className="list-rows">
            {tasks.map((t, i) => (
              <div key={i} className="task-row">
                <span className="task-icon">
                  <IconCheckCircle />
                </span>
                <div className="deadline-text">
                  <span className="deadline-title">{t.title}</span>
                  <span className="deadline-sub">Deadline: {t.deadline}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card recent-communication">
          <div className="card-header">
            <span>Recent Communication</span>
            <button className="icon-btn" type="button" aria-label="Collapse">
              <IconMinus />
            </button>
          </div>
          <div className="list-rows">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="comm-row">
                <span className="comm-icon">
                  <IconMail />
                </span>
                <span className="comm-text">brief summary of messages or emails for your messages.</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dash-row row-3">
        <div className="card need-help">
          <span className="need-help-icon">
            <IconHelp />
          </span>
          <div className="deadline-text">
            <span className="deadline-title">Need help?</span>
            <span className="deadline-sub">
              View our client resources if you need instructions for specific requests.
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Dashboard
