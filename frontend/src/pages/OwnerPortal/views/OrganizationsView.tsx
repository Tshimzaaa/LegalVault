import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { deleteOrganization, exportOrganization, updateOrganizationStatus } from '../../../api/owner'
import type { OrganizationDetail } from '../../../api/owner'
import { IconDownload, IconPlus, IconSearch, IconTrash } from '../../../components/icons'
import { useOwnerData } from '../OwnerDataContext'
import OnboardDialog from '../OnboardDialog'
import { ErrorState, LoadingState, Page } from '../ownerParts'

type OrgFilter = 'all' | 'active' | 'suspended'

function OrganizationsView() {
  const { token, orgs, setOrgs, orgsStatus, reloadOrgs } = useOwnerData()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const statusParam = searchParams.get('status')
  const filter: OrgFilter = statusParam === 'active' || statusParam === 'suspended' ? statusParam : 'all'
  const onboardOpen = location.pathname.endsWith('/organizations/new')

  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [orgActionError, setOrganizationActionError] = useState<string | null>(null)

  function setParam(key: string, value: string) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (value) params.set(key, value)
        else params.delete(key)
        return params
      },
      { replace: true },
    )
  }

  async function handleToggleStatus(org: OrganizationDetail) {
    if (!token) return
    if (
      org.is_active &&
      !window.confirm(`Suspend ${org.name}? Every staff member at this organization will immediately lose access.`)
    )
      return
    setOrganizationActionError(null)
    setTogglingId(org.id)
    try {
      const updated = await updateOrganizationStatus(token, org.id, !org.is_active)
      setOrgs((prev) => prev.map((f) => (f.id === org.id ? { ...f, is_active: updated.is_active } : f)))
    } catch (err) {
      setOrganizationActionError(err instanceof Error ? err.message : 'Could not update this organization.')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDeleteOrganization(org: OrganizationDetail) {
    if (!token) return
    if (!window.confirm(`Permanently delete ${org.name} and all its staff and contracts?`)) return
    setOrganizationActionError(null)
    setDeletingId(org.id)
    try {
      await deleteOrganization(token, org.id)
      setOrgs((prev) => prev.filter((f) => f.id !== org.id))
    } catch (err) {
      setOrganizationActionError(err instanceof Error ? err.message : 'Could not delete this organization.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleExportOrganization(org: OrganizationDetail) {
    if (!token) return
    setOrganizationActionError(null)
    setExportingId(org.id)
    try {
      const data = await exportOrganization(token, org.id)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${org.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-export.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setOrganizationActionError(err instanceof Error ? err.message : 'Could not export this organization.')
    } finally {
      setExportingId(null)
    }
  }

  const needle = query.trim().toLowerCase()
  const visible = orgs.filter((o) => {
    if (filter === 'active' && !o.is_active) return false
    if (filter === 'suspended' && o.is_active) return false
    if (needle && !`${o.name} ${o.email}`.toLowerCase().includes(needle)) return false
    return true
  })
  const activeCount = orgs.filter((o) => o.is_active).length

  const filters: { key: OrgFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: orgs.length },
    { key: 'active', label: 'Active', count: activeCount },
    { key: 'suspended', label: 'Suspended', count: orgs.length - activeCount },
  ]

  return (
    <Page
      title="Organizations"
      subtitle="Every firm on the platform"
      actions={
        <button type="button" className="btn-solid" onClick={() => navigate('/owner/organizations/new')}>
          <IconPlus aria-hidden="true" /> Onboard organization
        </button>
      }
    >
      {orgsStatus === 'loading' && <LoadingState label="Loading organizations…" />}
      {orgsStatus === 'error' && <ErrorState label="Couldn’t reach the backend for platform data." onRetry={reloadOrgs} />}

      {orgsStatus === 'ready' && (
        <section className="card owner-orgs-card" aria-label="Organizations">
          <div className="owner-toolbar">
            <label className="input-with-icon leading owner-search">
              <span className="sr-only">Search organizations</span>
              <IconSearch aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setParam('q', e.target.value)}
                placeholder="Search by name or email"
                autoComplete="off"
              />
            </label>
            <div role="group" aria-label="Filter by status" className="inq-chips">
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`inq-chip${filter === f.key ? ' active' : ''}`}
                  aria-pressed={filter === f.key}
                  onClick={() => setParam('status', f.key === 'all' ? '' : f.key)}
                >
                  {f.label}
                  <span className="inq-chip-count">{f.count}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="contract-error owner-form-error" role="alert" hidden={!orgActionError}>
            {orgActionError}
          </p>
          <div className="table-scroll">
            <table className="data-table data-table-list" role="table">
              <thead role="rowgroup">
                <tr role="row">
                  <th role="columnheader">Organization</th>
                  <th role="columnheader">Email</th>
                  <th role="columnheader">Staff</th>
                  <th role="columnheader">Contracts</th>
                  <th role="columnheader">Status</th>
                  <th role="columnheader">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {visible.map((f) => (
                  <tr key={f.id} role="row">
                    <td role="cell">{f.name}</td>
                    <td role="cell" className="muted" data-full>
                      {f.email}
                    </td>
                    <td role="cell" className="muted tabular" data-label="Staff">
                      {f.staff_count}
                    </td>
                    <td role="cell" className="muted tabular" data-label="Contracts">
                      {f.contract_count}
                    </td>
                    <td role="cell">
                      <span className={`inq-badge ${f.is_active ? 'org-active' : 'org-suspended'}`}>
                        <span className="inq-dot" aria-hidden="true" />
                        {f.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td role="cell" data-actions data-full>
                      <div className="clients-row-actions owner-row-actions">
                        <button
                          type="button"
                          className="btn-ghost owner-org-toggle"
                          disabled={togglingId === f.id}
                          onClick={() => handleToggleStatus(f)}
                        >
                          {togglingId === f.id ? 'Saving…' : f.is_active ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="owner-icon-btn"
                          disabled={exportingId === f.id}
                          onClick={() => handleExportOrganization(f)}
                          aria-label={`Export ${f.name} data`}
                          title="Export organization data"
                        >
                          <IconDownload />
                        </button>
                        <button
                          type="button"
                          className="owner-icon-btn"
                          disabled={f.is_active || deletingId === f.id}
                          onClick={() => handleDeleteOrganization(f)}
                          aria-label={`Delete ${f.name}`}
                          title={f.is_active ? 'Suspend the organization before deleting it' : 'Delete permanently'}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visible.length === 0 && (
            <div className="inq-empty">
              <p>{orgs.length === 0 ? 'No organizations yet.' : 'No organizations match your search.'}</p>
              <p className="muted">
                {orgs.length === 0
                  ? 'Onboard one with the button above, or from an access request in Inquiries.'
                  : 'Try a different name or clear the filters.'}
              </p>
            </div>
          )}
        </section>
      )}

      {onboardOpen && <OnboardDialog onClose={() => navigate('/owner/organizations')} />}
    </Page>
  )
}

export default OrganizationsView
