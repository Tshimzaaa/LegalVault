import { useEffect, useState } from 'react'
import './AuditLog.css'
import { listAuditLog, auditActionLabel, formatAuditDetails } from '../../api/auditLog'
import type { AuditLogEntry } from '../../api/auditLog'
import type { User } from '../../api/auth'

type LoadState = 'loading' | 'error' | 'ready'

const PAGE_SIZE = 50

interface AuditLogProps {
  user: User
}

function AuditLog({ user }: AuditLogProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const token = localStorage.getItem('access_token')

  function loadFirstPage() {
    if (!token) {
      setStatus('error')
      return
    }
    setStatus('loading')
    listAuditLog(token, PAGE_SIZE, 0)
      .then((data) => {
        setEntries(data)
        setOffset(data.length)
        setHasMore(data.length === PAGE_SIZE)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }

  useEffect(loadFirstPage, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLoadMore() {
    if (!token) return
    setLoadingMore(true)
    try {
      const data = await listAuditLog(token, PAGE_SIZE, offset)
      setEntries((prev) => [...prev, ...data])
      setOffset((prev) => prev + data.length)
      setHasMore(data.length === PAGE_SIZE)
    } finally {
      setLoadingMore(false)
    }
  }

  if (user.role !== 'admin') {
    return (
      <main className="dash-main">
        <header className="dash-topbar">
          <h1>Audit Log</h1>
        </header>
        <div className="dash-state">
          <p>Only firm admins can view the audit log.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Audit Log</h1>
        <div className="topbar-actions">
          <span className="chip">
            Entries <span className="chip-badge">{entries.length}</span>
          </span>
        </div>
      </header>

      {status === 'loading' && (
        <div className="dash-state">
          <span className="dash-spinner" />
          <p>Loading audit log…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for the audit log.</p>
          <button type="button" className="btn-ghost" onClick={loadFirstPage}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <section className="card audit-log-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="muted tabular">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="muted">{e.actor_type}</td>
                  <td>{auditActionLabel[e.action] ?? e.action}</td>
                  <td className="muted">{e.target_type}</td>
                  <td className="muted audit-log-details">{formatAuditDetails(e.details)}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No audit log entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {hasMore && (
            <div className="audit-log-load-more">
              <button type="button" className="btn-ghost" disabled={loadingMore} onClick={handleLoadMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  )
}

export default AuditLog
