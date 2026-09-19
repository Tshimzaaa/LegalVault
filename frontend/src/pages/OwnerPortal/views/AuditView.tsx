import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { auditActionLabel, formatAuditDetails, listOwnerAuditLog } from '../../../api/auditLog'
import type { AuditLogEntry } from '../../../api/auditLog'
import { useOwnerData } from '../OwnerDataContext'
import { ErrorState, LoadingState, Page } from '../ownerParts'
import { dateTimeFormat } from '../ownerUtils'
import type { LoadState } from '../ownerUtils'

const AUDIT_PAGE_SIZE = 50

function AuditView() {
  const { token, orgs } = useOwnerData()
  const [searchParams, setSearchParams] = useSearchParams()
  const auditOrganizationFilter = searchParams.get('org') ?? ''

  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([])
  const [auditStatus, setAuditStatus] = useState<LoadState>('loading')
  const [auditPage, setAuditPage] = useState(0)
  const [auditHasMore, setAuditHasMore] = useState(true)

  function setAuditOrganizationFilter(next: string) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next) params.set('org', next)
        else params.delete('org')
        return params
      },
      { replace: true },
    )
  }

  function loadAudit(targetPage: number) {
    if (!token) {
      setAuditStatus('error')
      return
    }
    setAuditStatus('loading')
    listOwnerAuditLog(token, {
      orgId: auditOrganizationFilter || undefined,
      limit: AUDIT_PAGE_SIZE,
      offset: targetPage * AUDIT_PAGE_SIZE,
    })
      .then((data) => {
        setAuditEntries(data)
        setAuditPage(targetPage)
        setAuditHasMore(data.length === AUDIT_PAGE_SIZE)
        setAuditStatus('ready')
      })
      .catch(() => setAuditStatus('error'))
  }

  useEffect(() => loadAudit(0), [auditOrganizationFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Page
      title="Audit log"
      subtitle="Who did what across the platform"
      actions={
        <select
          className="select-input owner-audit-filter"
          aria-label="Filter audit log by organization"
          value={auditOrganizationFilter}
          onChange={(e) => setAuditOrganizationFilter(e.target.value)}
        >
          <option value="">All organizations</option>
          {orgs.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      }
    >
      <section className="card owner-audit-card" aria-label="Audit log entries">
        {auditStatus === 'loading' && <LoadingState label="Loading audit log…" />}
        {auditStatus === 'error' && <ErrorState label="Couldn’t reach the backend for the audit log." onRetry={() => loadAudit(auditPage)} />}

        {auditStatus === 'ready' && (
          <>
            <div className="table-scroll">
              <table className="data-table data-table-list" role="table">
                <thead role="rowgroup">
                  <tr role="row">
                    <th role="columnheader">Action</th>
                    <th role="columnheader">When</th>
                    <th role="columnheader">Actor</th>
                    <th role="columnheader">Target</th>
                    <th role="columnheader">Details</th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {auditEntries.map((e) => (
                    <tr key={e.id} role="row">
                      <td role="cell">{auditActionLabel[e.action] ?? e.action}</td>
                      <td role="cell" className="muted tabular">
                        {dateTimeFormat.format(new Date(e.created_at))}
                      </td>
                      <td role="cell" className="muted" data-label="Actor">
                        {e.actor_type}
                      </td>
                      <td role="cell" className="muted" data-label="Target">
                        {e.target_type}
                      </td>
                      <td role="cell" className="muted audit-log-details" data-full>
                        {formatAuditDetails(e.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {auditEntries.length === 0 && <p className="muted owner-table-empty">No audit log entries yet.</p>}
            <div className="audit-log-load-more owner-pager">
              <button type="button" className="btn-ghost" disabled={auditPage === 0} onClick={() => loadAudit(auditPage - 1)}>
                Previous
              </button>
              <span className="muted">Page {auditPage + 1}</span>
              <button type="button" className="btn-ghost" disabled={!auditHasMore} onClick={() => loadAudit(auditPage + 1)}>
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </Page>
  )
}

export default AuditView
