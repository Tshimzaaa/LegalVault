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
  IconSearch,
} from '../../components/icons'
import ProfileMenu from '../../components/ProfileMenu'
import type { User } from '../../api/auth'
import { getDashboardSummary } from '../../api/dashboard'
import type { DashboardSummary } from '../../api/dashboard'

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
                type="search"
                aria-label="Search clients, matters, staff"
                placeholder="Search clients, matters, staff…"
                value={dashboardQuery}
                onChange={(e) => setDashboardQuery(e.target.value)}
                autoComplete="off"
              />
            </form>
          )}
          <ProfileMenu user={user} onLogout={onLogout} />
        </div>
      </header>

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading dashboard…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state" role="status" aria-live="polite">
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
                <button className="icon-btn" type="button" aria-label="Add active case">
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
                <button className="icon-btn" type="button" aria-label="Add contract">
                  <IconPlus />
                </button>
              </div>
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
