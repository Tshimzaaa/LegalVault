import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './OwnerPortal.css'
import { IconDollar, IconLayers, IconPlus, IconUser, IconTrash } from '../../components/icons'
import { listFirms, getFirm, updateFirmStatus, createFirm, deleteFirm } from '../../api/owner'
import type { FirmDetail } from '../../api/owner'
import { listOwnerAuditLog, auditActionLabel, formatAuditDetails } from '../../api/auditLog'
import type { AuditLogEntry } from '../../api/auditLog'

type LoadState = 'loading' | 'error' | 'ready'
const AUDIT_PAGE_SIZE = 50

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
  const [firmActionError, setFirmActionError] = useState<string | null>(null)

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
