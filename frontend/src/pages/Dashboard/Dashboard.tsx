import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
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
  IconInbox,
  IconMessageCircle,
  IconArrowUp,
  IconArrowDown,
  IconSearch,
} from '../../components/icons'
import ProfileMenu from '../../components/ProfileMenu'
import type { User } from '../../api/auth'
import { getDashboardSummary } from '../../api/dashboard'
import type { DashboardSummary } from '../../api/dashboard'

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

function sparklinePoints(values: number[]) {
  if (values.length === 0) return ''
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const stepX = 120 / (values.length - 1 || 1)
  return values
    .map((v, i) => `${i * stepX},${40 - ((v - min) / span) * 40}`)
    .join(' ')
}

// Mock data — no backend endpoint for firm-wide intake/staff/turnaround metrics yet.
const intakeQueue = [
  { title: 'NDA Request (Apex Corp)', meta: 'High Priority • Awaiting Review', status: 'Assigned' },
  { title: 'Lease Review (John Doe)', meta: 'Medium Priority • Attorney Assigned', status: 'Assigned' },
  { title: 'General Inquiry (Jane Smith)', meta: 'Low Priority • Conflict Check', status: 'Status' },
]

const staffFeed = [
  { who: 'A. Deff', initials: 'AD', task: 'Completed Contract Drafting (High Vol.)', time: '11m ago', tag: 'High Vol.' },
  { who: 'E. Adenike', initials: 'EA', task: 'Reviewed SOW (Completed)', time: '26m ago', tag: 'Completed' },
  { who: 'Portal', initials: null, task: 'Received e-sign [SA-2024-101] (Apex Corp)', time: '1h ago', tag: 'Complete' },
]

const turnaround: { label: string; sub?: string; value: string; change: string; dir: 'up' | 'down' }[] = [
  { label: 'NDA Intake Turnaround Time', value: '3 days', change: '12%', dir: 'down' },
  { label: 'Lease Approval Time', sub: '(27 tasks)', value: '2.1 days', change: '8%', dir: 'down' },
  { label: 'Client Doc Response Time', value: '1.6 days', change: '15%', dir: 'down' },
]

function Avatar({ initials }: { initials: string }) {
  return <span className="feed-avatar">{initials}</span>
}

interface DashboardProps {
  user: User
  onLogout: () => void
  /** Skips the network fetch and renders this data directly. Used for static previews (e.g. the homepage carousel). */
  previewSummary?: DashboardSummary
}

type LoadState = 'loading' | 'error' | 'ready'

function Dashboard({ user, onLogout, previewSummary }: DashboardProps) {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<DashboardSummary | null>(previewSummary ?? null)
  const [status, setStatus] = useState<LoadState>(previewSummary ? 'ready' : 'loading')
  const [attempt, setAttempt] = useState(0)
  const [dashboardQuery, setDashboardQuery] = useState('')

  function handleDashboardSearch(e: FormEvent) {
    e.preventDefault()
    if (!dashboardQuery.trim()) return
    navigate(`/staff/search?q=${encodeURIComponent(dashboardQuery.trim())}`)
  }

  useEffect(() => {
    if (previewSummary) return

    let cancelled = false
    setStatus('loading')

    const token = localStorage.getItem('access_token')
    if (!token) {
      setStatus('error')
      return
    }

    getDashboardSummary(token)
      .then((data) => {
        if (cancelled) return
        setSummary(data)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [attempt, previewSummary])

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Dashboard</h1>
        <div className="topbar-actions">
          {!previewSummary && (
            <form onSubmit={handleDashboardSearch} className="dash-topbar-search">
              <IconSearch />
              <input
                type="text"
                placeholder="Search clients, matters, staff…"
                value={dashboardQuery}
                onChange={(e) => setDashboardQuery(e.target.value)}
              />
            </form>
          )}
          <ProfileMenu user={user} onLogout={onLogout} />
        </div>
      </header>

      {status === 'loading' && (
        <div className="dash-state">
          <span className="dash-spinner" />
          <p>Loading dashboard…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for your dashboard data.</p>
          <button type="button" className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && summary && (
        <>
          <section className="dash-row row-1">
            <div className="card active-cases">
              <div className="card-header">
                <span>Active Cases</span>
                <button className="icon-btn" type="button" aria-label="Add">
                  <IconPlus />
                </button>
              </div>
              <div className="stat-line">
                <span className="stat-big">{summary.activeCases.count}</span>
                <span className="stat-sub">count</span>
              </div>
              <div className="stat-line">
                <span className="stat-big">{summary.activeCases.totalValue}</span>
                <span className="stat-sub">total value</span>
              </div>
              <div className="progress-track">
                <span className="progress-fill" style={{ width: `${summary.activeCases.progressPercent}%` }} />
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
                    <span className="stat-big">{summary.contractStatus.total}</span>
                    <span className="stat-sub">Total</span>
                  </div>
                  {summary.contractStatus.breakdown.map((s) => (
                    <div key={s.label} className="status-row">
                      <span className="status-dot" style={{ background: s.color }} />
                      <span className="status-label">{s.label}</span>
                      <span className="status-count">{s.count}</span>
                    </div>
                  ))}
                </div>
                <div className="contract-status-rings">
                  {summary.contractStatus.rings.map((r, i) => (
                    <Ring key={i} value={r} />
                  ))}
                </div>
              </div>
            </div>

            <div className="card key-deadlines">
              <div className="card-header">
                <span>Key Deadlines</span>
                <button className="chip">
                  Filter <IconChevron /> <span className="chip-badge">{summary.keyDeadlines.length}</span>
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
                {summary.keyDeadlines.map((d, i) => (
                  <div key={i} className="deadline-row">
                    <IconFlag color={d.flagColor} />
                    <div className="deadline-text">
                      <span className="deadline-title">{d.title}</span>
                      <span className="deadline-sub">Deadline: {d.deadline}</span>
                    </div>
                  </div>
                ))}
                {summary.keyDeadlines.length === 0 && <p className="muted">No upcoming deadlines.</p>}
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
                <span className="stat-big">{summary.financialSummary.billableHours}</span>
                <span className="stat-sub">R-value</span>
              </div>
              {summary.financialSummary.sparkline.length > 0 ? (
                <svg className="sparkline" viewBox="0 0 120 40" preserveAspectRatio="none">
                  <polyline
                    points={sparklinePoints(summary.financialSummary.sparkline)}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <p className="muted">No billing data yet.</p>
              )}
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
                {summary.recentDocuments.map((doc, i) => (
                  <div key={i} className="doc-row">
                    <span className="doc-icon">
                      <IconDownload />
                    </span>
                    <div className="deadline-text">
                      <span className="deadline-title">{doc.title}</span>
                      <span className="deadline-sub">{doc.subtitle}</span>
                    </div>
                  </div>
                ))}
                {summary.recentDocuments.length === 0 && <p className="muted">No documents yet.</p>}
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
                {summary.tasks.map((t, i) => (
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
                {summary.tasks.length === 0 && <p className="muted">No tasks yet.</p>}
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
                {summary.recentCommunications.map((c, i) => (
                  <div key={i} className="comm-row">
                    <span className="comm-icon">
                      <IconMail />
                    </span>
                    <span className="comm-text">{c.text}</span>
                  </div>
                ))}
                {summary.recentCommunications.length === 0 && <p className="muted">No recent communication.</p>}
              </div>
            </div>
          </section>

          <section className="dash-row row-3">
            <div className="card intake-queue">
              <div className="card-header">
                <span>Matter Intake Review Queue</span>
                <span className="card-subtitle-inline">mock — pending backend</span>
              </div>
              <div className="list-rows">
                {intakeQueue.map((item) => (
                  <div key={item.title} className="intake-row">
                    <span className="doc-icon">
                      <IconInbox />
                    </span>
                    <div className="deadline-text">
                      <span className="deadline-title">{item.title}</span>
                      <span className="deadline-sub">{item.meta}</span>
                    </div>
                    <span className="status-badge intake-status">{item.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card staff-feed">
              <div className="card-header">
                <span>Staff Task &amp; Bottleneck Feed</span>
                <span className="card-subtitle-inline">mock — pending backend</span>
              </div>
              <div className="list-rows">
                {staffFeed.map((f) => (
                  <div key={f.who} className="feed-row">
                    {f.initials ? <Avatar initials={f.initials} /> : (
                      <span className="doc-icon">
                        <IconMessageCircle />
                      </span>
                    )}
                    <div className="deadline-text">
                      <span className="deadline-title">{f.who}</span>
                      <span className="deadline-sub">{f.task}</span>
                    </div>
                    <span className="feed-right">
                      <span className="deadline-sub">{f.time}</span>
                      <span className="status-badge feed-tag">{f.tag}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card turnaround">
              <div className="card-header">
                <span>Turnaround Metrics</span>
                <span className="card-subtitle-inline">mock — pending backend</span>
              </div>
              <div className="list-rows">
                {turnaround.map((t) => (
                  <div key={t.label} className="turnaround-row">
                    <div className="deadline-text">
                      <span className="deadline-title">{t.label}</span>
                      {t.sub && <span className="deadline-sub">{t.sub}</span>}
                    </div>
                    <span className="turnaround-value-col">
                      <span className="stat-sub tabular">{t.value}</span>
                      <span className={`turnaround-change ${t.dir}`}>
                        {t.dir === 'up' ? <IconArrowUp /> : <IconArrowDown />}
                        {t.change}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="dash-row row-4">
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
        </>
      )}
    </main>
  )
}

export default Dashboard
