import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { FormEvent } from 'react'
import './OwnerPortal.css'
import { IconDollar, IconLayers, IconPlus, IconUser, IconTrash, IconDownload, IconChevron } from '../../components/icons'
import {
  listFirms,
  getFirm,
  updateFirmStatus,
  createFirm,
  deleteFirm,
  exportFirm,
  getPlatformMetrics,
  listRecentErrors,
  getSystemHealth,
} from '../../api/owner'
import type { FirmDetail, PlatformMetrics, RequestErrorEntry, SystemHealth } from '../../api/owner'
import { listOwnerAuditLog, auditActionLabel, formatAuditDetails } from '../../api/auditLog'
import type { AuditLogEntry } from '../../api/auditLog'
import { listOwnerAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from '../../api/announcements'
import type { Announcement, AnnouncementSeverity } from '../../api/announcements'
import MiniChart from '../../components/MiniChart'

type LoadState = 'loading' | 'error' | 'ready'
const AUDIT_PAGE_SIZE = 50
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const severityColor: Record<AnnouncementSeverity, string> = {
  info: '#3987e5',
  warning: '#eab308',
  critical: '#ef4444',
}

const healthStatusColor: Record<'operational' | 'degraded' | 'down' | 'healthy', string> = {
  operational: '#22c55e',
  healthy: '#22c55e',
  degraded: '#eab308',
  down: '#ef4444',
}

const healthStatusLabel: Record<'operational' | 'degraded' | 'down' | 'healthy', string> = {
  operational: 'Operational',
  healthy: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${Math.floor(seconds)}s`
}

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit' })
}

const emptyCreateForm = {
  firmName: '',
  firmEmail: '',
  firmPhone: '',
  firmWebsite: '',
  firmAddress: '',
  adminFirstName: '',
  adminLastName: '',
  adminEmail: '',
  adminPassword: '',
}

interface OwnerPortalProps {
  onLogout: () => void
}

function OwnerPortal({ onLogout }: OwnerPortalProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [firms, setFirms] = useState<FirmDetail[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [form, setForm] = useState(emptyCreateForm)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [firmActionError, setFirmActionError] = useState<string | null>(null)

  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null)
  const [metricsStatus, setMetricsStatus] = useState<LoadState>('loading')

  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [systemHealthStatus, setSystemHealthStatus] = useState<LoadState>('loading')

  const [errorEntries, setErrorEntries] = useState<RequestErrorEntry[]>([])
  const [errorsStatus, setErrorsStatus] = useState<LoadState>('loading')
  const [errorsPage, setErrorsPage] = useState(0)
  const [errorsHasMore, setErrorsHasMore] = useState(true)
  const showErrors = searchParams.get('errors') === '1'
  function setShowErrors(next: boolean) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next) {
        params.set('errors', '1')
      } else {
        params.delete('errors')
      }
      return params
    })
  }

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [announcementsStatus, setAnnouncementsStatus] = useState<LoadState>('loading')
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [announcementSeverity, setAnnouncementSeverity] = useState<AnnouncementSeverity>('info')
  const [announcementSaving, setAnnouncementSaving] = useState(false)
  const [announcementError, setAnnouncementError] = useState<string | null>(null)
  const [announcementBusyId, setAnnouncementBusyId] = useState<string | null>(null)
  const [announcementActionError, setAnnouncementActionError] = useState<string | null>(null)

  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([])
  const [auditStatus, setAuditStatus] = useState<LoadState>('loading')
  const auditFirmFilter = searchParams.get('firm') ?? ''
  function setAuditFirmFilter(next: string) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next) {
        params.set('firm', next)
      } else {
        params.delete('firm')
      }
      return params
    })
  }
  const [auditPage, setAuditPage] = useState(0)
  const [auditHasMore, setAuditHasMore] = useState(true)
  const showAuditLog = searchParams.get('audit') === '1'
  function setShowAuditLog(next: boolean) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next) {
        params.set('audit', '1')
      } else {
        params.delete('audit')
      }
      return params
    })
  }

  const token = localStorage.getItem('access_token')

  function loadAll() {
    if (!token) {
      setStatus('error')
      return
    }
    setStatus('loading')
    listFirms(token)
      .then((summaries) => Promise.all(summaries.map((s) => getFirm(token, s.id))))
      .then((details) => {
        setFirms(details)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }

  useEffect(loadAll, []) // eslint-disable-line react-hooks/exhaustive-deps

  function loadAudit(targetPage: number) {
    if (!token) {
      setAuditStatus('error')
      return
    }
    setAuditStatus('loading')
    listOwnerAuditLog(token, {
      firmId: auditFirmFilter || undefined,
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

  useEffect(() => loadAudit(0), [auditFirmFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  function loadMetrics() {
    if (!token) {
      setMetricsStatus('error')
      return
    }
    setMetricsStatus('loading')
    getPlatformMetrics(token, 24)
      .then((data) => {
        setMetrics(data)
        setMetricsStatus('ready')
      })
      .catch(() => setMetricsStatus('error'))
  }

  useEffect(loadMetrics, []) // eslint-disable-line react-hooks/exhaustive-deps

  function loadSystemHealth() {
    if (!token) {
      setSystemHealthStatus('error')
      return
    }
    setSystemHealthStatus('loading')
    getSystemHealth(token, 24)
      .then((data) => {
        setSystemHealth(data)
        setSystemHealthStatus('ready')
      })
      .catch(() => setSystemHealthStatus('error'))
  }

  useEffect(loadSystemHealth, []) // eslint-disable-line react-hooks/exhaustive-deps

  const ERROR_PAGE_SIZE = 50

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

  function formatActor(e: RequestErrorEntry): string {
    if (e.actor_label) return e.actor_label
    if (e.actor_type === 'owner') return 'Owner'
    if (e.actor_type) return `${e.actor_type} (unknown)`
    return 'Anonymous'
  }

  function loadAnnouncements() {
    if (!token) {
      setAnnouncementsStatus('error')
      return
    }
    setAnnouncementsStatus('loading')
    listOwnerAnnouncements(token)
      .then((data) => {
        setAnnouncements(data)
        setAnnouncementsStatus('ready')
      })
      .catch(() => setAnnouncementsStatus('error'))
  }

  useEffect(loadAnnouncements, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreateAnnouncement(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setAnnouncementError(null)
    setAnnouncementSaving(true)
    try {
      const created = await createAnnouncement(token, {
        title: announcementTitle,
        body: announcementBody,
        severity: announcementSeverity,
        is_active: true,
      })
      setAnnouncements((prev) => [created, ...prev])
      setAnnouncementTitle('')
      setAnnouncementBody('')
      setAnnouncementSeverity('info')
      setShowAnnouncementForm(false)
    } catch (err) {
      setAnnouncementError(err instanceof Error ? err.message : 'Could not create the announcement.')
    } finally {
      setAnnouncementSaving(false)
    }
  }

  async function handleToggleAnnouncementActive(a: Announcement) {
    if (!token) return
    setAnnouncementActionError(null)
    setAnnouncementBusyId(a.id)
    // Optimistic: flip it immediately, reconcile with the server's copy after, and put the
    // original value back if the request fails.
    setAnnouncements((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_active: !a.is_active } : x)))
    try {
      const updated = await updateAnnouncement(token, a.id, { is_active: !a.is_active })
      setAnnouncements((prev) => prev.map((x) => (x.id === a.id ? updated : x)))
    } catch (err) {
      setAnnouncements((prev) => prev.map((x) => (x.id === a.id ? a : x)))
      setAnnouncementActionError(err instanceof Error ? err.message : 'Could not update the announcement.')
    } finally {
      setAnnouncementBusyId(null)
    }
  }

  async function handleDeleteAnnouncement(a: Announcement) {
    if (!token) return
    if (!window.confirm(`Delete the announcement “${a.title}”?`)) return
    setAnnouncementBusyId(a.id)
    try {
      await deleteAnnouncement(token, a.id)
      setAnnouncements((prev) => prev.filter((x) => x.id !== a.id))
    } finally {
      setAnnouncementBusyId(null)
    }
  }

  async function handleToggleStatus(firm: FirmDetail) {
    if (!token) return
    setFirmActionError(null)
    setTogglingId(firm.id)
    try {
      const updated = await updateFirmStatus(token, firm.id, !firm.is_active)
      setFirms((prev) => prev.map((f) => (f.id === firm.id ? { ...f, is_active: updated.is_active } : f)))
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDeleteFirm(firm: FirmDetail) {
    if (!token) return
    if (!window.confirm(`Permanently delete ${firm.name} and all its staff, clients, and matters?`)) return
    setFirmActionError(null)
    setDeletingId(firm.id)
    try {
      await deleteFirm(token, firm.id)
      setFirms((prev) => prev.filter((f) => f.id !== firm.id))
    } catch (err) {
      setFirmActionError(err instanceof Error ? err.message : 'Could not delete this firm.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleExportFirm(firm: FirmDetail) {
    if (!token) return
    setFirmActionError(null)
    setExportingId(firm.id)
    try {
      const data = await exportFirm(token, firm.id)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${firm.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-export.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setFirmActionError(err instanceof Error ? err.message : 'Could not export this firm.')
    } finally {
      setExportingId(null)
    }
  }

  function updateField<K extends keyof typeof emptyCreateForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleCreateFirm(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setCreateError('')

    if (form.adminPassword.length < 8) {
      setCreateError('Admin password must be at least 8 characters.')
      return
    }

    setCreating(true)
    try {
      await createFirm(token, {
        law_firm: {
          name: form.firmName,
          email: form.firmEmail,
          phone: form.firmPhone || null,
          website: form.firmWebsite || null,
          address: form.firmAddress || null,
        },
        admin: {
          first_name: form.adminFirstName,
          last_name: form.adminLastName,
          email: form.adminEmail,
          password: form.adminPassword,
        },
      })
      setForm(emptyCreateForm)
      setShowCreateForm(false)
      loadAll()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create the firm.')
    } finally {
      setCreating(false)
    }
  }

  const activeCount = firms.filter((f) => f.is_active).length
  const platformNumberFormat = new Intl.NumberFormat()
  const platformStats = [
    { label: 'Total firms', value: platformNumberFormat.format(firms.length), icon: <IconLayers /> },
    { label: 'Active firms', value: platformNumberFormat.format(activeCount), icon: <IconLayers /> },
    {
      label: 'Staff across platform',
      value: platformNumberFormat.format(firms.reduce((s, f) => s + f.staff_count, 0)),
      icon: <IconUser />,
    },
    {
      label: 'Clients onboarded',
      value: platformNumberFormat.format(firms.reduce((s, f) => s + f.client_count, 0)),
      icon: <IconUser />,
    },
    {
      label: 'Matters open',
      value: platformNumberFormat.format(firms.reduce((s, f) => s + f.matter_count, 0)),
      icon: <IconDollar />,
    },
  ]

  return (
    <main className="dash-main owner-portal-main" id="main-content">
      <header className="dash-topbar">
        <h1>Owner Portal</h1>
        <div className="topbar-actions">
          <span className="chip">
            Firms <span className="chip-badge">{firms.length}</span>
          </span>
          <button type="button" className="btn-solid" onClick={() => setShowCreateForm((v) => !v)}>
            <IconPlus /> New Firm
          </button>
          <button type="button" className="btn-ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      {showCreateForm && (
        <section className="card owner-create-firm-card">
          <div className="card-header">
            <h2>Onboard a new firm</h2>
          </div>
          <form onSubmit={handleCreateFirm} className="owner-create-firm-form">
            <div className="field-row">
              <label className="field">
                <span>Firm name</span>
                <input
                  value={form.firmName}
                  onChange={(e) => updateField('firmName', e.target.value)}
                  required
                  autoComplete="organization"
                />
              </label>
              <label className="field">
                <span>Firm email</span>
                <input
                  type="email"
                  value={form.firmEmail}
                  onChange={(e) => updateField('firmEmail', e.target.value)}
                  required
                  autoComplete="email"
                  spellCheck={false}
                />
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span>Firm phone (optional)</span>
                <input
                  type="tel"
                  value={form.firmPhone}
                  onChange={(e) => updateField('firmPhone', e.target.value)}
                  autoComplete="tel"
                />
              </label>
              <label className="field">
                <span>Firm website (optional)</span>
                <input
                  type="url"
                  value={form.firmWebsite}
                  onChange={(e) => updateField('firmWebsite', e.target.value)}
                  autoComplete="url"
                />
              </label>
            </div>
            <label className="field">
              <span>Firm address (optional)</span>
              <input
                value={form.firmAddress}
                onChange={(e) => updateField('firmAddress', e.target.value)}
                autoComplete="street-address"
              />
            </label>

            <div className="field-row">
              <label className="field">
                <span>Admin first name</span>
                <input
                  value={form.adminFirstName}
                  onChange={(e) => updateField('adminFirstName', e.target.value)}
                  required
                  autoComplete="given-name"
                />
              </label>
              <label className="field">
                <span>Admin last name</span>
                <input
                  value={form.adminLastName}
                  onChange={(e) => updateField('adminLastName', e.target.value)}
                  required
                  autoComplete="family-name"
                />
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span>Admin email</span>
                <input
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => updateField('adminEmail', e.target.value)}
                  required
                  autoComplete="email"
                  spellCheck={false}
                />
              </label>
              <label className="field">
                <span>Admin password</span>
                <input
                  type="password"
                  value={form.adminPassword}
                  onChange={(e) => updateField('adminPassword', e.target.value)}
                  placeholder="At least 8 characters…"
                  required
                  autoComplete="new-password"
                />
              </label>
            </div>

            {createError && <p className="matter-error" aria-live="polite">{createError}</p>}

            <div className="matter-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowCreateForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-solid" disabled={creating}>
                {creating ? 'Creating…' : 'Create firm & admin'}
              </button>
            </div>
          </form>
        </section>
      )}

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading firms…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state" role="status" aria-live="polite">
          <p>Couldn&rsquo;t reach the backend for platform data.</p>
          <button type="button" className="btn-ghost" onClick={loadAll}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <div className="owner-sections">
          <section className="dash-row owner-stats">
            {platformStats.map((s) => (
              <div key={s.label} className="card owner-stat-card">
                <div className="card-header">
                  <span>{s.label}</span>
                  <span className="owner-stat-icon">{s.icon}</span>
                </div>
                <div className="stat-line">
                  <span className="stat-big">{s.value}</span>
                </div>
              </div>
            ))}
          </section>

          <section className="card owner-firms-table-card">
            <div className="card-header">
              <h2>Firms on the platform</h2>
            </div>
            {firmActionError && <p className="matter-error" aria-live="polite">{firmActionError}</p>}
            <table className="data-table">
              <thead>
                <tr>
                  <th>Firm</th>
                  <th>Email</th>
                  <th>Staff</th>
                  <th>Clients</th>
                  <th>Matters</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {firms.map((f) => (
                  <tr key={f.id}>
                    <td>{f.name}</td>
                    <td className="muted">{f.email}</td>
                    <td className="muted tabular">{f.staff_count}</td>
                    <td className="muted tabular">{f.client_count}</td>
                    <td className="muted tabular">{f.matter_count}</td>
                    <td>
                      <span
                        className="status-badge"
                        style={{
                          color: f.is_active ? '#22c55e' : '#ef4444',
                          background: f.is_active ? '#22c55e22' : '#ef444422',
                        }}
                      >
                        {f.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td>
                      <div className="clients-row-actions">
                        <button
                          type="button"
                          className="btn-ghost owner-firm-toggle"
                          disabled={togglingId === f.id}
                          onClick={() => handleToggleStatus(f)}
                        >
                          {togglingId === f.id ? 'Saving…' : f.is_active ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          disabled={exportingId === f.id}
                          onClick={() => handleExportFirm(f)}
                          aria-label={`Export ${f.name} data`}
                          title="Export firm data"
                        >
                          <IconDownload />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          disabled={f.is_active || deletingId === f.id}
                          onClick={() => handleDeleteFirm(f)}
                          aria-label={`Delete ${f.name}`}
                          title={f.is_active ? 'Suspend the firm before deleting it' : 'Delete permanently'}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {firms.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      No firms yet. Onboard one with New Firm.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <div className="owner-section-group">
            <h2 className="owner-section-title">System Health</h2>

          <section className="card owner-monitoring-card">
            <div className="card-header">
              <h2>Platform Health</h2>
              <span className="muted">last 24h</span>
            </div>

            {systemHealthStatus === 'loading' && (
              <div className="dash-state" role="status" aria-live="polite">
                <span className="dash-spinner" aria-hidden="true" />
                <p>Loading platform health…</p>
              </div>
            )}

            {systemHealthStatus === 'error' && (
              <div className="dash-state" role="status" aria-live="polite">
                <p>Couldn&rsquo;t reach the backend for platform health.</p>
                <button type="button" className="btn-ghost" onClick={loadSystemHealth}>
                  Retry
                </button>
              </div>
            )}

            {systemHealthStatus === 'ready' && systemHealth && (
              <>
                <div className="owner-health-banner">
                  <span
                    className="owner-health-dot"
                    style={{ background: healthStatusColor[systemHealth.status] }}
                  />
                  <div className="owner-health-summary">
                    <strong style={{ color: healthStatusColor[systemHealth.status] }}>
                      {healthStatusLabel[systemHealth.status]}
                    </strong>
                    <span className="muted">
                      Uptime {formatUptime(systemHealth.uptime_seconds)} · checked{' '}
                      {new Date(systemHealth.generated_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="owner-health-deps">
                    {systemHealth.dependencies.map((d) => (
                      <span
                        key={d.name}
                        className="status-badge"
                        style={{ color: healthStatusColor[d.status], background: `${healthStatusColor[d.status]}22` }}
                      >
                        {d.name}: {healthStatusLabel[d.status]}
                        {d.latency_ms != null ? ` · ${Math.round(d.latency_ms)}ms` : ''}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="dash-row owner-monitoring-stats">
                  <div className="owner-monitoring-stat">
                    <span className="muted">Total requests</span>
                    <span className="stat-big">{new Intl.NumberFormat().format(systemHealth.requests.total_requests)}</span>
                  </div>
                  <div className="owner-monitoring-stat">
                    <span className="muted">Success rate</span>
                    <span className="stat-big">
                      {(100 - systemHealth.requests.error_rate_percent).toFixed(2)}%
                    </span>
                  </div>
                  <div className="owner-monitoring-stat">
                    <span className="muted">Error rate</span>
                    <span
                      className="stat-big"
                      style={{ color: systemHealth.requests.error_rate_percent > 1 ? '#ef4444' : '#22c55e' }}
                    >
                      {systemHealth.requests.error_rate_percent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="owner-monitoring-stat">
                    <span className="muted">Avg. response</span>
                    <span className="stat-big">
                      {systemHealth.requests.average_duration_ms != null
                        ? `${Math.round(systemHealth.requests.average_duration_ms)}ms`
                        : '—'}
                    </span>
                  </div>
                  <div className="owner-monitoring-stat">
                    <span className="muted">P95 response</span>
                    <span className="stat-big">
                      {systemHealth.requests.p95_duration_ms != null
                        ? `${Math.round(systemHealth.requests.p95_duration_ms)}ms`
                        : '—'}
                    </span>
                  </div>
                  <div className="owner-monitoring-stat">
                    <span className="muted">Active users</span>
                    <span className="stat-big">{new Intl.NumberFormat().format(systemHealth.active_users)}</span>
                  </div>
                  <div className="owner-monitoring-stat">
                    <span className="muted">Online firms</span>
                    <span className="stat-big">{new Intl.NumberFormat().format(systemHealth.online_firms)}</span>
                  </div>
                  {metricsStatus === 'ready' && metrics && (
                    <div className="owner-monitoring-stat">
                      <span className="muted">New firms (7d / 30d)</span>
                      <span className="stat-big">
                        {new Intl.NumberFormat().format(metrics.usage.new_firms_last_7_days)} /{' '}
                        {new Intl.NumberFormat().format(metrics.usage.new_firms_last_30_days)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="owner-health-charts">
                  <div className="owner-chart-card">
                    <span className="muted owner-health-table-title">Requests per hour</span>
                    <MiniChart
                      points={systemHealth.timeseries.map((t) => ({
                        label: formatHour(t.bucket),
                        value: t.request_count,
                      }))}
                      color="#3987e5"
                    />
                  </div>
                  <div className="owner-chart-card">
                    <span className="muted owner-health-table-title">Avg. response time per hour</span>
                    <MiniChart
                      points={systemHealth.timeseries.map((t) => ({
                        label: formatHour(t.bucket),
                        value: t.average_duration_ms ?? 0,
                      }))}
                      color="#eab308"
                      formatValue={(v) => `${Math.round(v)}ms`}
                    />
                  </div>
                </div>

                <div className="owner-health-tables">
                  <div>
                    <span className="muted owner-health-table-title">Services</span>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Service</th>
                          <th>Status</th>
                          <th>Requests</th>
                          <th>Error %</th>
                          <th>Avg latency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {systemHealth.services.map((s) => (
                          <tr key={s.name}>
                            <td>{s.name}</td>
                            <td>
                              <span
                                className="status-badge"
                                style={{
                                  color: healthStatusColor[s.status],
                                  background: `${healthStatusColor[s.status]}22`,
                                }}
                              >
                                {healthStatusLabel[s.status]}
                              </span>
                            </td>
                            <td className="tabular">{s.request_count}</td>
                            <td className="tabular">{s.error_rate_percent.toFixed(2)}%</td>
                            <td className="tabular">
                              {s.avg_duration_ms != null ? `${Math.round(s.avg_duration_ms)}ms` : '—'}
                            </td>
                          </tr>
                        ))}
                        {systemHealth.services.length === 0 && (
                          <tr>
                            <td colSpan={5} className="muted">
                              No traffic in this window.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <span className="muted owner-health-table-title">Worst-performing endpoints</span>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Endpoint</th>
                          <th>Requests</th>
                          <th>Errors</th>
                          <th>Error %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {systemHealth.worst_endpoints.map((e) => (
                          <tr key={`${e.method}-${e.path}`}>
                            <td className="muted">
                              {e.method} {e.path}
                            </td>
                            <td className="tabular">{e.request_count}</td>
                            <td className="tabular">{e.error_count}</td>
                            <td className="tabular" style={{ color: e.error_rate_percent > 5 ? '#ef4444' : '#22c55e' }}>
                              {e.error_rate_percent.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                        {systemHealth.worst_endpoints.length === 0 && (
                          <tr>
                            <td colSpan={4} className="muted">
                              No errors in this window.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="card owner-errors-card">
            <div className="card-header">
              <h2>Recent errors</h2>
              <div className="topbar-actions">
                <span className="muted">
                  {errorsStatus === 'ready' ? `${errorEntries.length}${errorsHasMore ? '+' : ''} in last 24h` : 'last 24h'}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowErrors(!showErrors)}
                  aria-label={showErrors ? 'Collapse recent errors' : 'Expand recent errors'}
                  title={showErrors ? 'Collapse' : 'Expand'}
                  style={{ transform: showErrors ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
                >
                  <IconChevron />
                </button>
              </div>
            </div>

            {showErrors && (
              <>
                {errorsStatus === 'loading' && (
                  <div className="dash-state" role="status" aria-live="polite">
                    <span className="dash-spinner" aria-hidden="true" />
                    <p>Loading recent errors…</p>
                  </div>
                )}

                {errorsStatus === 'error' && (
                  <div className="dash-state" role="status" aria-live="polite">
                    <p>Couldn&rsquo;t reach the backend for recent errors.</p>
                    <button type="button" className="btn-ghost" onClick={() => loadErrors(errorsPage)}>
                      Retry
                    </button>
                  </div>
                )}

                {errorsStatus === 'ready' && (
                  <>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Request</th>
                          <th>Status</th>
                          <th>For</th>
                          <th>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {errorEntries.map((e) => (
                          <tr key={e.id}>
                            <td className="muted tabular">{dateTimeFormat.format(new Date(e.created_at))}</td>
                            <td className="muted">
                              {e.method} {e.path}
                            </td>
                            <td>
                              <span
                                className="status-badge"
                                style={{
                                  color: e.status_code >= 500 ? '#ef4444' : '#eab308',
                                  background: e.status_code >= 500 ? '#ef444422' : '#eab30822',
                                }}
                              >
                                {e.status_code}
                              </span>
                            </td>
                            <td className="muted">{formatActor(e)}</td>
                            <td className="muted audit-log-details">{e.error_detail ?? '—'}</td>
                          </tr>
                        ))}
                        {errorEntries.length === 0 && (
                          <tr>
                            <td colSpan={5} className="muted">
                              No errors in the last 24h.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    <div className="audit-log-load-more">
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={errorsPage === 0}
                        onClick={() => loadErrors(errorsPage - 1)}
                      >
                        Previous
                      </button>
                      <span className="muted">Page {errorsPage + 1}</span>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={!errorsHasMore}
                        onClick={() => loadErrors(errorsPage + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
          </div>

          <div className="owner-section-group">
            <h2 className="owner-section-title">Communications</h2>

          <section className="card owner-announcements-card">
            <div className="card-header">
              <h2>Platform Announcements</h2>
              <button type="button" className="btn-solid" onClick={() => setShowAnnouncementForm((v) => !v)}>
                <IconPlus /> New Announcement
              </button>
            </div>

            {showAnnouncementForm && (
              <form onSubmit={handleCreateAnnouncement} className="owner-announcement-form">
                <div className="field-row">
                  <label className="field">
                    <span>Title</span>
                    <input
                      value={announcementTitle}
                      onChange={(e) => setAnnouncementTitle(e.target.value)}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Severity</span>
                    <select
                      value={announcementSeverity}
                      onChange={(e) => setAnnouncementSeverity(e.target.value as AnnouncementSeverity)}
                    >
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Body</span>
                  <textarea rows={2} value={announcementBody} onChange={(e) => setAnnouncementBody(e.target.value)} required />
                </label>
                {announcementError && <p className="matter-error" aria-live="polite">{announcementError}</p>}
                <div className="matter-actions">
                  <button type="button" className="btn-ghost" onClick={() => setShowAnnouncementForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-solid" disabled={announcementSaving}>
                    {announcementSaving ? 'Publishing…' : 'Publish'}
                  </button>
                </div>
              </form>
            )}

            {announcementsStatus === 'loading' && (
              <div className="dash-state" role="status" aria-live="polite">
                <span className="dash-spinner" aria-hidden="true" />
                <p>Loading announcements…</p>
              </div>
            )}

            {announcementsStatus === 'error' && (
              <div className="dash-state" role="status" aria-live="polite">
                <p>Couldn&rsquo;t reach the backend for announcements.</p>
                <button type="button" className="btn-ghost" onClick={loadAnnouncements}>
                  Retry
                </button>
              </div>
            )}

            {announcementActionError && <p className="matter-error" aria-live="polite">{announcementActionError}</p>}

            {announcementsStatus === 'ready' && (
              <div className="list-rows">
                {announcements.map((a) => (
                  <div key={a.id} className="owner-announcement-row">
                    <div>
                      <span
                        className="announcement-severity-badge"
                        style={{
                          color: severityColor[a.severity],
                          background: `${severityColor[a.severity]}22`,
                        }}
                      >
                        {a.severity}
                      </span>
                      <strong>{a.title}</strong>
                      <p className="muted" style={{ margin: '4px 0 0' }}>
                        {a.body}
                      </p>
                    </div>
                    <div className="clients-row-actions">
                      <button
                        type="button"
                        className="btn-ghost owner-firm-toggle"
                        disabled={announcementBusyId === a.id}
                        onClick={() => handleToggleAnnouncementActive(a)}
                      >
                        {a.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        disabled={announcementBusyId === a.id}
                        onClick={() => handleDeleteAnnouncement(a)}
                        aria-label={`Delete ${a.title}`}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                ))}
                {announcements.length === 0 && <p className="muted">No announcements yet.</p>}
              </div>
            )}
          </section>
          </div>

          <div className="owner-section-group">
            <h2 className="owner-section-title">Governance</h2>

          <section className="card owner-audit-card">
            <div className="card-header">
              <h2>Platform Audit Log</h2>
              <div className="topbar-actions">
                <select
                  className="select-input"
                  aria-label="Filter audit log by firm"
                  value={auditFirmFilter}
                  onChange={(e) => setAuditFirmFilter(e.target.value)}
                >
                  <option value="">All firms</option>
                  {firms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowAuditLog(!showAuditLog)}
                  aria-label={showAuditLog ? 'Collapse audit log' : 'Expand audit log'}
                  title={showAuditLog ? 'Collapse' : 'Expand'}
                  style={{ transform: showAuditLog ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
                >
                  <IconChevron />
                </button>
              </div>
            </div>

            {showAuditLog && (
              <>
                {auditStatus === 'loading' && (
                  <div className="dash-state" role="status" aria-live="polite">
                    <span className="dash-spinner" aria-hidden="true" />
                    <p>Loading audit log…</p>
                  </div>
                )}

                {auditStatus === 'error' && (
                  <div className="dash-state" role="status" aria-live="polite">
                    <p>Couldn&rsquo;t reach the backend for the audit log.</p>
                    <button type="button" className="btn-ghost" onClick={() => loadAudit(auditPage)}>
                      Retry
                    </button>
                  </div>
                )}

                {auditStatus === 'ready' && (
                  <>
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
                        {auditEntries.map((e) => (
                          <tr key={e.id}>
                            <td className="muted tabular">{dateTimeFormat.format(new Date(e.created_at))}</td>
                            <td className="muted">{e.actor_type}</td>
                            <td>{auditActionLabel[e.action] ?? e.action}</td>
                            <td className="muted">{e.target_type}</td>
                            <td className="muted audit-log-details">{formatAuditDetails(e.details)}</td>
                          </tr>
                        ))}
                        {auditEntries.length === 0 && (
                          <tr>
                            <td colSpan={5} className="muted">
                              No audit log entries yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    <div className="audit-log-load-more">
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={auditPage === 0}
                        onClick={() => loadAudit(auditPage - 1)}
                      >
                        Previous
                      </button>
                      <span className="muted">Page {auditPage + 1}</span>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={!auditHasMore}
                        onClick={() => loadAudit(auditPage + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
          </div>
        </div>
      )}
    </main>
  )
}

export default OwnerPortal
