import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './Matters.css'
import { IconPlus } from '../../components/icons'
import { listMatters } from '../../api/matters'
import type { Matter } from '../../api/matters'
import { listClients } from '../../api/clients'
import type { Client } from '../../api/clients'

type LoadState = 'loading' | 'error' | 'ready'

const statusLabel: Record<Matter['status'], string> = {
  intake: 'Intake',
  in_review: 'In Review',
  awaiting_signature: 'Awaiting Signature',
  signed: 'Signed',
  closed: 'Closed',
  declined: 'Declined',
}

const statusColor: Record<Matter['status'], string> = {
  intake: '#eab308',
  in_review: '#3987e5',
  awaiting_signature: '#a855f7',
  signed: '#199e70',
  closed: '#22c55e',
  declined: '#ef4444',
}

function Matters() {
  const [matters, setMatters] = useState<Matter[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    const token = localStorage.getItem('access_token')
    if (!token) {
      setStatus('error')
      return
    }

    Promise.all([listMatters(token), listClients(token)])
      .then(([matterList, clientList]) => {
        if (cancelled) return
        setMatters(matterList)
        setClients(clientList)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [attempt])

  function clientName(clientId: string) {
    return clients.find((c) => c.id === clientId)?.company_name ?? 'Unknown client'
  }

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Matters</h1>
        <div className="topbar-actions">
          <span className="chip">
            Total <span className="chip-badge">{matters.length}</span>
          </span>
          <Link to="/staff/new-matter" className="btn-solid">
            <IconPlus /> New Matter
          </Link>
        </div>
      </header>

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading matters…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for your matters.</p>
          <button type="button" className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <section className="card matters-table-card">
          <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Matter</th>
                <th>Client</th>
                <th>Status</th>
                <th>Client Visible</th>
                <th>Opened</th>
              </tr>
            </thead>
            <tbody>
              {matters.map((m) => (
                <tr key={m.id} className="matters-row">
                  <td>
                    <Link to={`/staff/matters/${m.id}`} className="matters-row-link">
                      {m.title}
                    </Link>
                  </td>
                  <td className="muted">{clientName(m.client_id)}</td>
                  <td>
                    <span
                      className="status-badge"
                      style={{ color: statusColor[m.status], background: `${statusColor[m.status]}22` }}
                    >
                      {statusLabel[m.status]}
                    </span>
                  </td>
                  <td className="muted">{m.is_visible_to_client ? 'Yes' : 'No'}</td>
                  <td className="muted">{new Date(m.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {matters.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No matters yet. Create one from New Matter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </section>
      )}
    </main>
  )
}

export default Matters
