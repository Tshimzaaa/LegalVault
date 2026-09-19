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
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Contract['status']>('all')

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

  const q = query.trim().toLowerCase()
  const visible = contracts.filter(
    (m) => (statusFilter === 'all' || m.status === statusFilter) && (!q || m.title.toLowerCase().includes(q)),
  )
  const filterKeys = (Object.keys(statusLabel) as Contract['status'][]).filter((k) =>
    contracts.some((m) => m.status === k),
  )

  return (
    <main className="dash-main">
      <header className="dash-topbar m-header">
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
          {contracts.length > 0 && (
            <div className="contracts-filters">
              <input
                type="search"
                className="contracts-search"
                aria-label="Search contracts"
                placeholder="Search contracts"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
              <div className="contracts-chips" role="group" aria-label="Filter by status">
                <button type="button" className="contracts-chip" aria-pressed={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
                  All
                </button>
                {filterKeys.map((k) => (
                  <button key={k} type="button" className="contracts-chip" aria-pressed={statusFilter === k} onClick={() => setStatusFilter(k)}>
                    {statusLabel[k]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="table-scroll">
          <table className="data-table data-table-list" role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader">Contract</th>
                <th role="columnheader">Status</th>
                <th role="columnheader">Opened</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {visible.map((m) => (
                <tr key={m.id} className="contracts-row" role="row">
                  <td role="cell">
                    <Link to={`/staff/contracts/${m.id}`} className="contracts-row-link">
                      {m.title}
                    </Link>
                  </td>
                  <td role="cell">
                    <span
                      className="status-badge"
                      style={{ color: statusColor[m.status], background: `rgba(${statusColorRgb[m.status]}, 0.13)` }}
                    >
                      {statusLabel[m.status]}
                    </span>
                  </td>
                  <td role="cell" className="muted" data-label="Opened">{new Date(m.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr role="row">
                  <td role="cell" colSpan={3} className="muted">
                    {contracts.length === 0 ? 'No contracts yet. Create one from New Contract.' : 'No contracts match these filters.'}
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
