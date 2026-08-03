import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './ClientWorkflow.css'
import { IconPlus } from '../../components/icons'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'
import { listClientMatters } from '../../api/clientMatters'
import type { Matter, MatterStatus } from '../../api/matters'

type LoadState = 'loading' | 'error' | 'ready'

const columnOrder: { status: MatterStatus; label: string; color: string }[] = [
  { status: 'intake', label: 'Intake', color: '#eab308' },
  { status: 'in_review', label: 'In Review', color: '#3987e5' },
  { status: 'awaiting_signature', label: 'Awaiting Signature', color: '#a855f7' },
  { status: 'signed', label: 'Signed', color: '#199e70' },
  { status: 'closed', label: 'Closed', color: '#22c55e' },
  { status: 'declined', label: 'Declined', color: '#ef4444' },
]

interface ClientWorkflowProps {
  contact: ClientContact
  onLogout: () => void
}

function ClientWorkflow({ contact, onLogout }: ClientWorkflowProps) {
  const navigate = useNavigate()
  const [matters, setMatters] = useState<Matter[]>([])
  const [status, setStatus] = useState<LoadState>('loading')

  function loadAll() {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setStatus('error')
      return
    }
    setStatus('loading')
    listClientMatters(token)
      .then((list) => {
        setMatters(list)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }

  useEffect(loadAll, [])

  return (
    <main className="dash-main workflow-main">
      <header className="dash-topbar">
        <h1>Workflow</h1>
        <div className="workflow-header-actions">
          <span className="chip">
            Total Matters <span className="chip-badge">{matters.length}</span>
          </span>
          <button type="button" className="btn-solid workflow-new-btn" onClick={() => navigate('/client/request-support')}>
            <IconPlus /> New Request
          </button>
          <ProfileMenu user={contact} onLogout={onLogout} />
        </div>
      </header>

      {status === 'loading' && (
        <div className="dash-state">
          <span className="dash-spinner" />
          <p>Loading your matters…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for your matters.</p>
          <button type="button" className="btn-ghost" onClick={loadAll}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <section className="workflow-board client-matter-board">
          {columnOrder.map((col) => {
            const cards = matters.filter((m) => m.status === col.status)
            return (
              <div key={col.status} className="workflow-column">
                <div className="workflow-column-header">
                  <span className="status-dot" style={{ background: col.color }} />
                  <span className="workflow-column-title">{col.label}</span>
                  <span className="workflow-column-count">{cards.length}</span>
                </div>

                <div className="workflow-column-body">
                  {cards.map((m) => (
                    <div
                      key={m.id}
                      className="card workflow-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/client/matters/${m.id}`)}
                      onKeyDown={(e) => e.key === 'Enter' && navigate(`/client/matters/${m.id}`)}
                    >
                      <span className="workflow-card-title">{m.title}</span>
                      <div className="workflow-card-footer request-card-footer">
                        <span className="deadline-sub">Opened {new Date(m.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && <p className="muted workflow-empty-col">Nothing here yet.</p>}
                </div>
              </div>
            )
          })}
        </section>
      )}
    </main>
  )
}

export default ClientWorkflow
