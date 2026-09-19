import { useEffect, useState } from 'react'
import { listRecentErrors } from '../../../api/owner'
import type { RequestErrorEntry } from '../../../api/owner'
import MiniChart from '../../../components/MiniChart'
import { useOwnerData } from '../OwnerDataContext'
import { ErrorState, LoadingState, Page } from '../ownerParts'
import {
  dateTimeFormat,
  formatHour,
  formatUptime,
  healthStatusColor,
  healthStatusColorRgb,
  healthStatusLabel,
  numberFormat,
  timeFormat,
} from '../ownerUtils'
import type { LoadState } from '../ownerUtils'

const ERROR_PAGE_SIZE = 50

function formatActor(e: RequestErrorEntry): string {
  if (e.actor_label) return e.actor_label
  if (e.actor_type === 'owner') return 'Owner'
  if (e.actor_type) return `${e.actor_type} (unknown)`
  return 'Anonymous'
}

function HealthView() {
  const { token, health: systemHealth, healthStatus: systemHealthStatus, reloadHealth: loadSystemHealth, metrics, metricsStatus } =
    useOwnerData()

  const [errorEntries, setErrorEntries] = useState<RequestErrorEntry[]>([])
  const [errorsStatus, setErrorsStatus] = useState<LoadState>('loading')
  const [errorsPage, setErrorsPage] = useState(0)
  const [errorsHasMore, setErrorsHasMore] = useState(true)

  function loadErrors(targetPage: number) {
    if (!token) {
      setErrorsStatus('error')
      return
    }
    setErrorsStatus('loading')
    listRecentErrors(token, { hours: 24, limit: ERROR_PAGE_SIZE, offset: targetPage * ERROR_PAGE_SIZE })
      .then((data) => {
        setErrorEntries(data)
        setErrorsPage(targetPage)
        setErrorsHasMore(data.length === ERROR_PAGE_SIZE)
        setErrorsStatus('ready')
      })
      .catch(() => setErrorsStatus('error'))
  }

  useEffect(() => loadErrors(0), []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Page
      title="Platform health"
      rowHeader
      subtitle="Dependencies, traffic and errors over the last 24 hours"
      actions={
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            loadSystemHealth()
            loadErrors(errorsPage)
          }}
        >
          Refresh
        </button>
      }
    >
      <div className="owner-stack">
        <section className="card owner-monitoring-card" aria-labelledby="health-h">
          <div className="card-header">
            <h2 id="health-h">System health</h2>
            <span className="muted">last 24h</span>
          </div>

          {systemHealthStatus === 'loading' && !systemHealth && <LoadingState label="Loading platform health…" />}
          {systemHealthStatus === 'error' && <ErrorState label="Couldn’t reach the backend for platform health." onRetry={loadSystemHealth} />}

          {systemHealth && systemHealthStatus !== 'error' && (
            <>
              <div className="owner-health-banner">
                <span className="owner-health-dot" style={{ background: healthStatusColor[systemHealth.status] }} aria-hidden="true" />
                <div className="owner-health-summary">
                  <strong style={{ color: healthStatusColor[systemHealth.status] }}>{healthStatusLabel[systemHealth.status]}</strong>
                  <span className="muted">
                    Uptime {formatUptime(systemHealth.uptime_seconds)} · checked{' '}
                    {timeFormat.format(new Date(systemHealth.generated_at))}
                  </span>
                </div>
                <div className="owner-health-deps">
                  {systemHealth.dependencies.map((d) => (
                    <span
                      key={d.name}
                      className="status-badge"
                      style={{ color: healthStatusColor[d.status], background: `rgba(${healthStatusColorRgb[d.status]}, 0.13)` }}
                    >
                      {d.name}: {healthStatusLabel[d.status]}
                      {d.latency_ms != null ? ` · ${Math.round(d.latency_ms)}ms` : ''}
                    </span>
                  ))}
                </div>
              </div>

              <div className="owner-monitoring-stats">
                <div className="owner-monitoring-stat">
                  <span className="muted">Total requests</span>
                  <span className="stat-big">{numberFormat.format(systemHealth.requests.total_requests)}</span>
                </div>
                <div className="owner-monitoring-stat">
                  <span className="muted">Success rate</span>
                  <span className="stat-big">{(100 - systemHealth.requests.error_rate_percent).toFixed(2)}%</span>
                </div>
                <div className="owner-monitoring-stat">
                  <span className="muted">Error rate</span>
                  <span
                    className="stat-big"
                    style={{ color: systemHealth.requests.error_rate_percent > 1 ? 'var(--danger)' : 'var(--accent)' }}
                  >
                    {systemHealth.requests.error_rate_percent.toFixed(2)}%
                  </span>
                </div>
                <div className="owner-monitoring-stat">
                  <span className="muted">Avg. response</span>
                  <span className="stat-big">
                    {systemHealth.requests.average_duration_ms != null ? `${Math.round(systemHealth.requests.average_duration_ms)}ms` : 'N/A'}
                  </span>
                </div>
                <div className="owner-monitoring-stat">
                  <span className="muted">P95 response</span>
                  <span className="stat-big">
                    {systemHealth.requests.p95_duration_ms != null ? `${Math.round(systemHealth.requests.p95_duration_ms)}ms` : 'N/A'}
                  </span>
                </div>
                <div className="owner-monitoring-stat">
                  <span className="muted">Active users</span>
                  <span className="stat-big">{numberFormat.format(systemHealth.active_users)}</span>
                </div>
                <div className="owner-monitoring-stat">
                  <span className="muted">Online organizations</span>
                  <span className="stat-big">{numberFormat.format(systemHealth.online_orgs)}</span>
                </div>
                {metricsStatus === 'ready' && metrics && (
                  <div className="owner-monitoring-stat">
                    <span className="muted">New organizations (7d / 30d)</span>
                    <span className="stat-big">
                      {numberFormat.format(metrics.usage.new_orgs_last_7_days)} / {numberFormat.format(metrics.usage.new_orgs_last_30_days)}
                    </span>
                  </div>
                )}
              </div>

              <div className="owner-health-charts">
                <div className="owner-chart-card">
                  <span className="muted owner-health-table-title">Requests per hour</span>
                  <MiniChart
                    points={systemHealth.timeseries.map((t) => ({ label: formatHour(t.bucket), value: t.request_count }))}
                    color="#3987e5"
                  />
                </div>
                <div className="owner-chart-card">
                  <span className="muted owner-health-table-title">Avg. response time per hour</span>
                  <MiniChart
                    points={systemHealth.timeseries.map((t) => ({ label: formatHour(t.bucket), value: t.average_duration_ms ?? 0 }))}
                    color="var(--warning)"
                    formatValue={(v) => `${Math.round(v)}ms`}
                  />
                </div>
              </div>

              <div className="owner-health-tables">
                <div>
                  <span className="muted owner-health-table-title">Services</span>
                  <div className="table-scroll">
                    <table className="data-table data-table-list" role="table">
                      <thead role="rowgroup">
                        <tr role="row">
                          <th role="columnheader">Service</th>
                          <th role="columnheader">Status</th>
                          <th role="columnheader">Requests</th>
                          <th role="columnheader">Error %</th>
                          <th role="columnheader">Avg latency</th>
                        </tr>
                      </thead>
                      <tbody role="rowgroup">
                        {systemHealth.services.map((s) => (
                          <tr key={s.name} role="row">
                            <td role="cell">{s.name}</td>
                            <td role="cell">
                              <span
                                className="status-badge"
                                style={{ color: healthStatusColor[s.status], background: `rgba(${healthStatusColorRgb[s.status]}, 0.13)` }}
                              >
                                {healthStatusLabel[s.status]}
                              </span>
                            </td>
                            <td role="cell" className="tabular" data-label="Requests">
                              {s.request_count}
                            </td>
                            <td role="cell" className="tabular" data-label="Error">
                              {s.error_rate_percent.toFixed(2)}%
                            </td>
                            <td role="cell" className="tabular" data-label="Latency">
                              {s.avg_duration_ms != null ? `${Math.round(s.avg_duration_ms)}ms` : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {systemHealth.services.length === 0 && <p className="muted owner-table-empty">No traffic in this window.</p>}
                </div>

                <div>
                  <span className="muted owner-health-table-title">Worst-performing endpoints</span>
                  <div className="table-scroll">
                    <table className="data-table data-table-list" role="table">
                      <thead role="rowgroup">
                        <tr role="row">
                          <th role="columnheader">Endpoint</th>
                          <th role="columnheader">Requests</th>
                          <th role="columnheader">Errors</th>
                          <th role="columnheader">Error %</th>
                        </tr>
                      </thead>
                      <tbody role="rowgroup">
                        {systemHealth.worst_endpoints.map((e) => (
                          <tr key={`${e.method}-${e.path}`} role="row">
                            <td role="cell">
                              {e.method} {e.path}
                            </td>
                            <td role="cell" className="tabular" data-label="Requests">
                              {e.request_count}
                            </td>
                            <td role="cell" className="tabular" data-label="Errors">
                              {e.error_count}
                            </td>
                            <td
                              role="cell"
                              className="tabular"
                              data-label="Error rate"
                              style={{ color: e.error_rate_percent > 5 ? 'var(--danger)' : 'var(--accent)' }}
                            >
                              {e.error_rate_percent.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {systemHealth.worst_endpoints.length === 0 && <p className="muted owner-table-empty">No errors in this window.</p>}
                </div>
              </div>
            </>
          )}
        </section>

        <section className="card owner-errors-card" aria-labelledby="errors-h">
          <div className="card-header">
            <h2 id="errors-h">Recent errors</h2>
            <span className="muted">
              {errorsStatus === 'ready' ? `${errorEntries.length}${errorsHasMore ? '+' : ''} on this page, last 24h` : 'last 24h'}
            </span>
          </div>

          {errorsStatus === 'loading' && <LoadingState label="Loading recent errors…" />}
          {errorsStatus === 'error' && <ErrorState label="Couldn’t reach the backend for recent errors." onRetry={() => loadErrors(errorsPage)} />}

          {errorsStatus === 'ready' && (
            <>
              <div className="table-scroll">
                <table className="data-table data-table-list" role="table">
                  <thead role="rowgroup">
                    <tr role="row">
                      <th role="columnheader">Request</th>
                      <th role="columnheader">Status</th>
                      <th role="columnheader">When</th>
                      <th role="columnheader">For</th>
                      <th role="columnheader">Detail</th>
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
                    {errorEntries.map((e) => (
                      <tr key={e.id} role="row">
                        <td role="cell">
                          {e.method} {e.path}
                        </td>
                        <td role="cell">
                          <span
                            className="status-badge"
                            style={{
                              color: e.status_code >= 500 ? 'var(--danger)' : 'var(--warning-text)',
                              background: e.status_code >= 500 ? 'rgba(var(--danger-rgb), 0.13)' : 'rgba(var(--warning-rgb), 0.13)',
                            }}
                          >
                            {e.status_code}
                          </span>
                        </td>
                        <td role="cell" className="muted tabular">
                          {dateTimeFormat.format(new Date(e.created_at))}
                        </td>
                        <td role="cell" className="muted" data-label="For">
                          {formatActor(e)}
                        </td>
                        <td role="cell" className="muted audit-log-details" data-full>
                          {e.error_detail ?? 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {errorEntries.length === 0 && <p className="muted owner-table-empty">No errors in the last 24h.</p>}
              <div className="audit-log-load-more owner-pager">
                <button type="button" className="btn-ghost" disabled={errorsPage === 0} onClick={() => loadErrors(errorsPage - 1)}>
                  Previous
                </button>
                <span className="muted">Page {errorsPage + 1}</span>
                <button type="button" className="btn-ghost" disabled={!errorsHasMore} onClick={() => loadErrors(errorsPage + 1)}>
                  Next
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </Page>
  )
}

export default HealthView
