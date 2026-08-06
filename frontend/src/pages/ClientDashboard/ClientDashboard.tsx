import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './ClientDashboard.css'
import { IconFolder, IconFilePlus, IconLearnedFriend } from '../../components/icons'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'
import { getClientDashboardSummary } from '../../api/clientDashboard'
import type { ClientDashboardSummary } from '../../api/clientDashboard'

const breakdownColor: Record<'signed' | 'pending' | 'expired', string> = {
  signed: '#22c55e',
  pending: '#eab308',
  expired: '#ef4444',
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

interface ClientDashboardProps {
  contact: ClientContact
  onLogout: () => void
}

function ClientDashboard({ contact, onLogout }: ClientDashboardProps) {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<ClientDashboardSummary | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    getClientDashboardSummary(token)
      .then(setSummary)
      .catch(() => setSummary(null))
  }, [])

  const breakdown = summary?.contractBreakdown
  const breakdownRows = breakdown
    ? [
        { label: 'Signed', count: breakdown.signed, color: breakdownColor.signed },
        { label: 'Pending', count: breakdown.pending, color: breakdownColor.pending },
        { label: 'Expired', count: breakdown.expired, color: breakdownColor.expired },
      ]
    : []

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Dashboard</h1>
        <div className="topbar-actions">
          <span className="muted">Welcome back, {contact.first_name}</span>
          <ProfileMenu user={contact} onLogout={onLogout} />
        </div>
      </header>

      <section className="dash-row client-dash-row-1">
        <div className="card">
          <div className="card-header">
            <span>Open Matters</span>
          </div>
          <div className="stat-line">
            <span className="stat-big">{summary?.openMatters ?? '—'}</span>
          </div>
        </div>

        <div className="card quick-actions">
          <div className="card-header">
            <span>Quick Actions</span>
          </div>
          <button type="button" className="quick-action-btn" onClick={() => navigate('/client/workflow')}>
            <IconFolder /> View Matters
          </button>
          <button type="button" className="quick-action-btn" onClick={() => navigate('/client/request-support')}>
            <IconFilePlus /> Create Request
          </button>
          <button type="button" className="quick-action-btn" onClick={() => navigate('/client/learned-friend')}>
            <IconLearnedFriend /> Access My Learned Friend
          </button>
        </div>

        <div className="card">
          <div className="card-header">
            <span>Contract Breakdown</span>
          </div>
          <div className="stat-line">
            <span className="stat-big">{breakdown?.total ?? '—'}</span>
            <span className="stat-sub">total</span>
          </div>
          {breakdownRows.map((c) => (
            <div key={c.label} className="status-row">
              <span className="status-dot" style={{ background: c.color }} />
              <span className="status-label">{c.label}</span>
              <span className="status-count">{c.count}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="dash-row client-dash-row-2">
        <div className="card">
          <div className="card-header">
            <span>Recent Action History</span>
          </div>
          <div className="list-rows">
            {summary?.recentActions.map((a, i) => (
              <div key={`${a.occurred_at}-${i}`} className="deadline-row">
                <div className="deadline-text">
                  <span className="deadline-title">{a.text}</span>
                  <span className="deadline-sub">{formatRelativeTime(a.occurred_at)}</span>
                </div>
              </div>
            ))}
            {summary && summary.recentActions.length === 0 && <p className="muted">No recent activity.</p>}
          </div>
        </div>
      </section>
    </main>
  )
}

export default ClientDashboard
