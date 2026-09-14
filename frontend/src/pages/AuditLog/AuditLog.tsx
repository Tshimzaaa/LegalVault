import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import './AuditLog.css'
import { listAuditLog, auditActionLabel, formatAuditDetails } from '../../api/auditLog'
import type { AuditLogEntry } from '../../api/auditLog'
import type { User } from '../../api/auth'

type LoadState = 'loading' | 'error' | 'ready'

const PAGE_SIZE = 50
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

interface AuditLogProps {
  user: User
}

function AuditLog({ user }: AuditLogProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [hasNextPage, setHasNextPage] = useState(true)

  const parsedPage = Number(searchParams.get('page'))
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage - 1 : 0

  const token = localStorage.getItem('access_token')

  function loadPage(targetPage: number) {
    if (!token) {
      setStatus('error')
      return
    }
    setStatus('loading')
    listAuditLog(token, PAGE_SIZE, targetPage * PAGE_SIZE)
      .then((data) => {
        setEntries(data)
        setHasNextPage(data.length === PAGE_SIZE)
        setStatus('ready')
        setSearchParams((prev) => {
          const params = new URLSearchParams(prev)
          if (targetPage === 0) {
            params.delete('page')
          } else {
            params.set('page', String(targetPage + 1))
          }
          return params
        })
      })
      .catch(() => setStatus('error'))
  }

  useEffect(() => loadPage(page), []) // eslint-disable-line react-hooks/exhaustive-deps

  if (user.role !== 'admin') {
    return (
      <main className="dash-main">
        <header className="dash-topbar">
          <h1>Audit Log</h1>
        </header>
        <div className="dash-state">
          <p>Only organization admins can view the audit log.</p>
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
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading audit log…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state" role="status" aria-live="polite">
          <p>Couldn&rsquo;t reach the backend for the audit log.</p>
          <button type="button" className="btn-ghost" onClick={() => loadPage(page)}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <section className="card audit-log-card">
          <div className="table-scroll">
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
                  <td className="muted tabular">{dateTimeFormat.format(new Date(e.created_at))}</td>
                  <td className="muted">{e.actor_type}</td>
                  <td>{auditActionLabel[e.action] ?? e.action}</td>
                  <td className="muted">{e.target_type}</td>
                  <td className="muted audit-log-details" title={formatAuditDetails(e.details)}>
                    {formatAuditDetails(e.details)}
                  </td>
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
          </div>
          <div className="audit-log-load-more">
            <button type="button" className="btn-ghost" disabled={page === 0} onClick={() => loadPage(page - 1)}>
              Previous
            </button>
            <span className="muted">Page {page + 1}</span>
            <button type="button" className="btn-ghost" disabled={!hasNextPage} onClick={() => loadPage(page + 1)}>
              Next
            </button>
          </div>
        </section>
      )}
    </main>
  )
}

export default AuditLog
