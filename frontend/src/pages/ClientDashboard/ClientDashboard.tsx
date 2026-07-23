import { useNavigate } from 'react-router-dom'
import './ClientDashboard.css'
import {
  IconFolder,
  IconFilePlus,
  IconLearnedFriend,
  IconArrowUp,
} from '../../components/icons'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'

const contractBreakdown = [
  { label: 'Signed', count: 31, color: '#22c55e' },
  { label: 'Pending', count: 14, color: '#eab308' },
  { label: 'Expired', count: 7, color: '#ef4444' },
]

const recentActions = [
  { title: 'NDA Request submitted — Apex Corp', time: '11m ago' },
  { title: 'Consultancy Agreement moved to In Progress', time: '48m ago' },
  { title: 'Supplier Agreement signed via SigningHub', time: '2h ago' },
  { title: 'Lease Review request created', time: '5h ago' },
]

const activeUsers = [
  { initials: 'JM', name: 'J. Mokoena', role: 'Procurement Lead' },
  { initials: 'TN', name: 'T. Ndlovu', role: 'Business Owner' },
  { initials: 'RP', name: 'R. Patel', role: 'Team Member' },
]

interface ClientDashboardProps {
  contact: ClientContact
  onLogout: () => void
}

function ClientDashboard({ contact, onLogout }: ClientDashboardProps) {
  const navigate = useNavigate()

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
            <span className="stat-big">42</span>
          </div>
          <span className="stat-delta up">
            <IconArrowUp /> +18 vs last period
          </span>
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
            <span className="stat-big">{contractBreakdown.reduce((s, c) => s + c.count, 0)}</span>
            <span className="stat-sub">total</span>
          </div>
          {contractBreakdown.map((c) => (
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
            {recentActions.map((a) => (
              <div key={a.title} className="deadline-row">
                <div className="deadline-text">
                  <span className="deadline-title">{a.title}</span>
                  <span className="deadline-sub">{a.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span>Latest Active Users</span>
          </div>
          <div className="list-rows">
            {activeUsers.map((u) => (
              <div key={u.initials} className="feed-row">
                <span className="feed-avatar">{u.initials}</span>
                <div className="deadline-text">
                  <span className="deadline-title">{u.name}</span>
                  <span className="deadline-sub">{u.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

export default ClientDashboard
