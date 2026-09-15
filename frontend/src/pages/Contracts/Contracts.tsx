import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './Contracts.css'
import { IconPlus } from '../../components/icons'
import { listContracts } from '../../api/contracts'
import type { Contract } from '../../api/contracts'

type LoadState = 'loading' | 'error' | 'ready'

const statusLabel: Record<Contract['status'], string> = {
  intake: 'Intake',
  in_review: 'In Review',
  awaiting_signature: 'Awaiting Signature',
  signed: 'Signed',
  closed: 'Closed',
  declined: 'Declined',
}

const statusColor: Record<Contract['status'], string> = {
  intake: 'var(--warning)',
  in_review: '#3987e5',
  awaiting_signature: '#a855f7',
  signed: '#199e70',
  closed: 'var(--accent)',
  declined: 'var(--danger)',
}

// Matching rgb triples so a translucent badge background can be composed with rgba() —
// appending a hex alpha suffix directly to a `var(--token)` string produces invalid CSS
// (e.g. "var(--accent)22"), which browsers silently drop.
const statusColorRgb: Record<Contract['status'], string> = {
  intake: 'var(--warning-rgb)',
  in_review: '57, 135, 229',
  awaiting_signature: '168, 85, 247',
  signed: '25, 158, 112',
  closed: 'var(--accent-rgb)',
  declined: 'var(--danger-rgb)',
}

function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([])
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

    listContracts(token)
      .then((contractList) => {
        if (cancelled) return
        setContracts(contractList)
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

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Contracts</h1>
        <div className="topbar-actions">
          <span className="chip">
            Total <span className="chip-badge">{contracts.length}</span>
          </span>
          <Link to="/staff/new-contract" className="btn-solid">
            <IconPlus /> New Contract
          </Link>
        </div>
      </header>

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading contracts…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for your contracts.</p>
          <button type="button" className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <section className="card contracts-table-card">
          <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Contract</th>
                <th>Status</th>
                <th>Opened</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((m) => (
                <tr key={m.id} className="contracts-row">
                  <td>
                    <Link to={`/staff/contracts/${m.id}`} className="contracts-row-link">
                      {m.title}
                    </Link>
                  </td>
                  <td>
                    <span
                      className="status-badge"
                      style={{ color: statusColor[m.status], background: `rgba(${statusColorRgb[m.status]}, 0.13)` }}
                    >
                      {statusLabel[m.status]}
                    </span>
                  </td>
                  <td className="muted">{new Date(m.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {contracts.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    No contracts yet. Create one from New Contract.
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

export default Contracts
