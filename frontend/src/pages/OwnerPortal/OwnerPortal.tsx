import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './OwnerPortal.css'
import { IconDollar, IconLayers, IconPlus, IconUser, IconTrash, IconDownload } from '../../components/icons'
import {
  listFirms,
  getFirm,
  updateFirmStatus,
  createFirm,
  deleteFirm,
  exportFirm,
  getPlatformMetrics,
  listRecentErrors,
} from '../../api/owner'
import type { FirmDetail, PlatformMetrics, RequestErrorEntry } from '../../api/owner'
import { listOwnerAuditLog, auditActionLabel, formatAuditDetails } from '../../api/auditLog'
import type { AuditLogEntry } from '../../api/auditLog'
import { listOwnerAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from '../../api/announcements'
import type { Announcement, AnnouncementSeverity } from '../../api/announcements'

type LoadState = 'loading' | 'error' | 'ready'
const AUDIT_PAGE_SIZE = 50

const severityColor: Record<AnnouncementSeverity, string> = {
  info: '#3987e5',
  warning: '#eab308',
  critical: '#ef4444',
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

  const [errorEntries, setErrorEntries] = useState<RequestErrorEntry[]>([])
  const [errorsStatus, setErrorsStatus] = useState<LoadState>('loading')
  const [errorsOffset, setErrorsOffset] = useState(0)
  const [errorsHasMore, setErrorsHasMore] = useState(true)
  const [errorsLoadingMore, setErrorsLoadingMore] = useState(false)

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [announcementsStatus, setAnnouncementsStatus] = useState<LoadState>('loading')
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [announcementSeverity, setAnnouncementSeverity] = useState<AnnouncementSeverity>('info')
  const [announcementSaving, setAnnouncementSaving] = useState(false)
  const [announcementError, setAnnouncementError] = useState<string | null>(null)
  const [announcementBusyId, setAnnouncementBusyId] = useState<string | null>(null)

  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([])
  const [auditStatus, setAuditStatus] = useState<LoadState>('loading')
  const [auditFirmFilter, setAuditFirmFilter] = useState('')
  const [auditOffset, setAuditOffset] = useState(0)
  const [auditHasMore, setAuditHasMore] = useState(true)
  const [auditLoadingMore, setAuditLoadingMore] = useState(false)

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

  function loadAudit() {
    if (!token) {
      setAuditStatus('error')
      return
    }
    setAuditStatus('loading')
    listOwnerAuditLog(token, { firmId: auditFirmFilter || undefined, limit: AUDIT_PAGE_SIZE, offset: 0 })
      .then((data) => {
        setAuditEntries(data)
        setAuditOffset(data.length)
        setAuditHasMore(data.length === AUDIT_PAGE_SIZE)
        setAuditStatus('ready')
      })
      .catch(() => setAuditStatus('error'))
  }

  useEffect(loadAudit, [auditFirmFilter]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const ERROR_PAGE_SIZE = 50

  function loadErrors() {
    if (!token) {
      setErrorsStatus('error')
      return
    }
    setErrorsStatus('loading')
    listRecentErrors(token, { hours: 24, limit: ERROR_PAGE_SIZE, offset: 0 })
      .then((data) => {
        setErrorEntries(data)
        setErrorsOffset(data.length)
        setErrorsHasMore(data.length === ERROR_PAGE_SIZE)
        setErrorsStatus('ready')
      })
      .catch(() => setErrorsStatus('error'))
  }

  useEffect(loadErrors, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLoadMoreErrors() {
    if (!token) return
    setErrorsLoadingMore(true)
    try {
      const data = await listRecentErrors(token, { hours: 24, limit: ERROR_PAGE_SIZE, offset: errorsOffset })
      setErrorEntries((prev) => [...prev, ...data])
      setErrorsOffset((prev) => prev + data.length)
      setErrorsHasMore(data.length === ERROR_PAGE_SIZE)
    } finally {
      setErrorsLoadingMore(false)
    }
  }

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
    setAnnouncementBusyId(a.id)
    try {
      const updated = await updateAnnouncement(token, a.id, { is_active: !a.is_active })
      setAnnouncements((prev) => prev.map((x) => (x.id === a.id ? updated : x)))
    } finally {
      setAnnouncementBusyId(null)
    }
  }

  async function handleDeleteAnnouncement(a: Announcement) {
    if (!token) return
    if (!window.confirm(`Delete the announcement "${a.title}"?`)) return
    setAnnouncementBusyId(a.id)
    try {
      await deleteAnnouncement(token, a.id)
      setAnnouncements((prev) => prev.filter((x) => x.id !== a.id))
    } finally {
      setAnnouncementBusyId(null)
    }
  }

  async function handleLoadMoreAudit() {
    if (!token) return
    setAuditLoadingMore(true)
    try {
      const data = await listOwnerAuditLog(token, {
        firmId: auditFirmFilter || undefined,
        limit: AUDIT_PAGE_SIZE,
        offset: auditOffset,
      })
      setAuditEntries((prev) => [...prev, ...data])
      setAuditOffset((prev) => prev + data.length)
      setAuditHasMore(data.length === AUDIT_PAGE_SIZE)
    } finally {
      setAuditLoadingMore(false)
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
  const platformStats = [
    { label: 'Total firms', value: String(firms.length), icon: <IconLayers /> },
    { label: 'Active firms', value: String(activeCount), icon: <IconLayers /> },
    { label: 'Staff across platform', value: String(firms.reduce((s, f) => s + f.staff_count, 0)), icon: <IconUser /> },
    { label: 'Clients onboarded', value: String(firms.reduce((s, f) => s + f.client_count, 0)), icon: <IconUser /> },
    { label: 'Matters open', value: String(firms.reduce((s, f) => s + f.matter_count, 0)), icon: <IconDollar /> },
  ]

  return (
    <main className="dash-main">
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
            <span>Onboard a new firm</span>
          </div>
          <form onSubmit={handleCreateFirm} className="owner-create-firm-form">
            <div className="field-row">
              <label className="field">
                <span>Firm name</span>
                <input value={form.firmName} onChange={(e) => updateField('firmName', e.target.value)} required />
              </label>
              <label className="field">
                <span>Firm email</span>
                <input
                  type="email"
                  value={form.firmEmail}
                  onChange={(e) => updateField('firmEmail', e.target.value)}
                  required
                />
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span>Firm phone (optional)</span>
                <input value={form.firmPhone} onChange={(e) => updateField('firmPhone', e.target.value)} />
              </label>
              <label className="field">
                <span>Firm website (optional)</span>
                <input value={form.firmWebsite} onChange={(e) => updateField('firmWebsite', e.target.value)} />
              </label>
            </div>
            <label className="field">
              <span>Firm address (optional)</span>
              <input value={form.firmAddress} onChange={(e) => updateField('firmAddress', e.target.value)} />
            </label>

            <div className="field-row">
              <label className="field">
                <span>Admin first name</span>
                <input
                  value={form.adminFirstName}
                  onChange={(e) => updateField('adminFirstName', e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Admin last name</span>
                <input
                  value={form.adminLastName}
                  onChange={(e) => updateField('adminLastName', e.target.value)}
                  required
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
                />
              </label>
              <label className="field">
                <span>Admin password</span>
                <input
                  type="password"
                  value={form.adminPassword}
                  onChange={(e) => updateField('adminPassword', e.target.value)}
                  placeholder="At least 8 characters"
                  required
                />
              </label>
            </div>

            {createError && <p className="matter-error">{createError}</p>}

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
        <div className="dash-state">
          <span className="dash-spinner" />
          <p>Loading firms…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for platform data.</p>
          <button type="button" className="btn-ghost" onClick={loadAll}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
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

          <section className="card owner-monitoring-card">
            <div className="card-header">
              <span>Platform Health</span>
              <span className="muted">last 24h</span>
            </div>

            {metricsStatus === 'loading' && (
              <div className="dash-state">
                <span className="dash-spinner" />
                <p>Loading platform metrics…</p>
              </div>
            )}

            {metricsStatus === 'error' && (
              <div className="dash-state">
                <p>Couldn&rsquo;t reach the backend for platform metrics.</p>
                <button type="button" className="btn-ghost" onClick={loadMetrics}>
                  Retry
                </button>
              </div>
            )}

            {metricsStatus === 'ready' && metrics && (
              <>
                <div className="dash-row owner-monitoring-stats">
                  <div className="owner-monitoring-stat">
                    <span className="muted">Total requests</span>
                    <span className="stat-big">{metrics.requests.total_requests}</span>
                  </div>
                  <div className="owner-monitoring-stat">
                    <span className="muted">Error rate</span>
                    <span
                      className="stat-big"
                      style={{ color: metrics.requests.error_rate_percent > 1 ? '#ef4444' : '#22c55e' }}
                    >
                      {metrics.requests.error_rate_percent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="owner-monitoring-stat">
                    <span className="muted">Avg. response time</span>
                    <span className="stat-big">
                      {metrics.requests.average_duration_ms != null ? `${Math.round(metrics.requests.average_duration_ms)}ms` : '—'}
                    </span>
                  </div>
                  <div className="owner-monitoring-stat">
                    <span className="muted">2xx / 4xx / 5xx</span>
                    <span className="stat-big">
                      {metrics.requests.status_2xx} / {metrics.requests.status_4xx} / {metrics.requests.status_5xx}
                    </span>
                  </div>
                  <div className="owner-monitoring-stat">
                    <span className="muted">New firms (7d / 30d)</span>
                    <span className="stat-big">
                      {metrics.usage.new_firms_last_7_days} / {metrics.usage.new_firms_last_30_days}
                    </span>
                  </div>
                </div>

                {metrics.requests.top_error_paths.length > 0 && (
                  <table className="data-table" style={{ marginTop: 16 }}>
                    <thead>
                      <tr>
                        <th>Top error paths</th>
                        <th>Status</th>
                        <th>Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.requests.top_error_paths.map((p) => (
                        <tr key={`${p.path}-${p.status_code}`}>
                          <td className="muted">{p.path}</td>
                          <td>
                            <span
                              className="status-badge"
                              style={{
                                color: p.status_code >= 500 ? '#ef4444' : '#eab308',
                                background: p.status_code >= 500 ? '#ef444422' : '#eab30822',
                              }}
                            >
                              {p.status_code}
                            </span>
                          </td>
                          <td className="tabular">{p.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </section>

          <section className="card owner-errors-card">
            <div className="card-header">
              <span>Recent errors</span>
              <span className="muted">last 24h — what kind, and for whom</span>
            </div>

            {errorsStatus === 'loading' && (
              <div className="dash-state">
                <span className="dash-spinner" />
                <p>Loading recent errors…</p>
              </div>
            )}

            {errorsStatus === 'error' && (
              <div className="dash-state">
                <p>Couldn&rsquo;t reach the backend for recent errors.</p>
                <button type="button" className="btn-ghost" onClick={loadErrors}>
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
                        <td className="muted tabular">{new Date(e.created_at).toLocaleString()}</td>
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
                {errorsHasMore && (
                  <div className="audit-log-load-more">
                    <button type="button" className="btn-ghost" disabled={errorsLoadingMore} onClick={handleLoadMoreErrors}>
                      {errorsLoadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="card owner-announcements-card">
            <div className="card-header">
              <span>Platform Announcements</span>
              <button type="button" className="btn-ghost" onClick={() => setShowAnnouncementForm((v) => !v)}>
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
                {announcementError && <p className="matter-error">{announcementError}</p>}
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
              <div className="dash-state">
                <span className="dash-spinner" />
                <p>Loading announcements…</p>
              </div>
            )}

            {announcementsStatus === 'error' && (
              <div className="dash-state">
                <p>Couldn&rsquo;t reach the backend for announcements.</p>
                <button type="button" className="btn-ghost" onClick={loadAnnouncements}>
                  Retry
                </button>
              </div>
            )}

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

          <section className="card owner-firms-table-card">
            <div className="card-header">
              <span>Firms on the platform</span>
            </div>
            {firmActionError && <p className="matter-error">{firmActionError}</p>}
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

          <section className="card owner-audit-card">
            <div className="card-header">
              <span>Platform Audit Log</span>
              <select value={auditFirmFilter} onChange={(e) => setAuditFirmFilter(e.target.value)}>
                <option value="">All firms</option>
                {firms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {auditStatus === 'loading' && (
              <div className="dash-state">
                <span className="dash-spinner" />
                <p>Loading audit log…</p>
              </div>
            )}

            {auditStatus === 'error' && (
              <div className="dash-state">
                <p>Couldn&rsquo;t reach the backend for the audit log.</p>
                <button type="button" className="btn-ghost" onClick={loadAudit}>
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
                        <td className="muted tabular">{new Date(e.created_at).toLocaleString()}</td>
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
                {auditHasMore && (
                  <div className="audit-log-load-more">
                    <button type="button" className="btn-ghost" disabled={auditLoadingMore} onClick={handleLoadMoreAudit}>
                      {auditLoadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </main>
  )
}

export default OwnerPortal
