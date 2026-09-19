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
  const [openId, setOpenId] = useState<string | null>(null)

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
      <header className="dash-topbar m-header">
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
          <table className="data-table data-table-list audit-list" role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader">When</th>
                <th role="columnheader">Actor</th>
                <th role="columnheader">Action</th>
                <th role="columnheader">Target</th>
                <th role="columnheader">Details</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {entries.map((e) => {
                const details = formatAuditDetails(e.details)
                const open = openId === e.id
                return (
                  <tr key={e.id} role="row">
                    <td role="cell" className="muted tabular audit-when">{dateTimeFormat.format(new Date(e.created_at))}</td>
                    <td role="cell" className="muted audit-actor">{e.actor_type}</td>
                    <td role="cell" className="audit-action">{auditActionLabel[e.action] ?? e.action}</td>
                    <td role="cell" className="muted audit-target">{e.target_type}</td>
                    <td role="cell" className={`muted audit-log-details${open ? ' is-open' : ''}`} title={details}>
                      <span className="audit-details-text">{details}</span>
                      {details.length > 60 && (
                        <button
                          type="button"
                          className="audit-more"
                          aria-expanded={open}
                          onClick={() => setOpenId(open ? null : e.id)}
                        >
                          {open ? 'Hide details' : 'Show details'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {entries.length === 0 && (
                <tr>
                  <td role="cell" colSpan={5} className="muted">
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
