import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import './SignedContracts.css'
import { IconPlus } from '../../components/icons'
import {
  listSignedContracts,
  getSignedContractsSummary,
  uploadSignedContract,
  getSignedContractDownloadUrl,
  updateSignedContractStatus,
} from '../../api/signedContracts'
import type { SignedContract, SignedContractsSummary, ContractType, ContractLifecycleStatus } from '../../api/signedContracts'

type LoadState = 'loading' | 'error' | 'ready'

const statusColor: Record<ContractLifecycleStatus, string> = {
  active: 'var(--accent)',
  expiring: '#f97316',
  archived: 'var(--text-muted)',
}

// Matching rgb triples so a translucent badge background can be composed with rgba() —
// appending a hex alpha suffix directly to a `var(--token)` string produces invalid CSS
// (e.g. "var(--accent)22"), which browsers silently drop.
const statusColorRgb: Record<ContractLifecycleStatus, string> = {
  active: 'var(--accent-rgb)',
  expiring: '249, 115, 22',
  archived: 'var(--text-muted-rgb)',
}

const statusLabel: Record<ContractLifecycleStatus, string> = {
  active: 'Active',
  expiring: 'Expiring',
  archived: 'Archived',
}

const typeLabel: Record<ContractType, string> = {
  nda: 'NDA',
  consultancy: 'Consultancy',
  supplier: 'Supplier',
  general: 'General',
}

const validStatusFilters = ['all', 'active', 'expiring', 'archived'] as const
const validTypeFilters = ['all', 'nda', 'consultancy', 'supplier', 'general'] as const

const emptyUploadForm = {
  title: '',
  agreementType: 'nda' as ContractType,
  signedDate: '',
  expiryDate: '',
  integrationSource: 'manual',
  description: '',
}

function SignedContracts() {
  const [contracts, setContracts] = useState<SignedContract[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)

  const [summary, setSummary] = useState<SignedContractsSummary | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()

  const rawStatusFilter = searchParams.get('status')
  const statusFilter: 'all' | ContractLifecycleStatus = validStatusFilters.includes(
    rawStatusFilter as (typeof validStatusFilters)[number],
  )
    ? (rawStatusFilter as 'all' | ContractLifecycleStatus)
    : 'all'

  const rawTypeFilter = searchParams.get('type')
  const typeFilter: 'all' | ContractType = validTypeFilters.includes(
    rawTypeFilter as (typeof validTypeFilters)[number],
  )
    ? (rawTypeFilter as 'all' | ContractType)
    : 'all'

  const search = searchParams.get('q') ?? ''

  function setStatusFilter(next: 'all' | ContractLifecycleStatus) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next === 'all') params.delete('status')
      else params.set('status', next)
      return params
    })
  }

  function setTypeFilter(next: 'all' | ContractType) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next === 'all') params.delete('type')
      else params.set('type', next)
      return params
    })
  }

  function setSearch(next: string) {
    // replace, not push — this fires on every keystroke, and a new history entry per
    // character would make the back button useless.
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next) params.set('q', next)
        else params.delete('q')
        return params
      },
      { replace: true },
    )
  }

  const [showUpload, setShowUpload] = useState(false)
  const [form, setForm] = useState(emptyUploadForm)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const token = localStorage.getItem('access_token')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }
    setStatus('loading')
    Promise.all([listSignedContracts(token), getSignedContractsSummary(token)])
      .then(([contractData, summaryData]) => {
        setContracts(contractData)
        setSummary(summaryData)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  function refresh() {
    setAttempt((n) => n + 1)
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault()
    setUploadError(null)

    if (!token || !form.title || !form.signedDate || !file) {
      setUploadError('Title, signed date, and a file are required.')
      return
    }

    setUploading(true)
    try {
      await uploadSignedContract(token, {
        title: form.title,
        agreement_type: form.agreementType,
        signed_date: form.signedDate,
        expiry_date: form.expiryDate || undefined,
        integration_source: form.integrationSource || undefined,
        description: form.description || undefined,
        file,
      })
      setForm(emptyUploadForm)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setShowUpload(false)
      refresh()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not upload the contract.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(contract: SignedContract) {
    if (!token) return
    setActionError(null)
    setDownloadingId(contract.id)
    try {
      const url = await getSignedContractDownloadUrl(token, contract.id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setActionError('Could not open that contract. Please try again.')
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleToggleArchive(contract: SignedContract) {
    if (!token) return
    setActionError(null)
    setTogglingId(contract.id)
    try {
      const nextStatus = contract.status === 'archived' ? 'active' : 'archived'
      const updated = await updateSignedContractStatus(token, contract.id, nextStatus)
      setContracts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      getSignedContractsSummary(token).then(setSummary).catch(() => {})
    } catch {
      setActionError('Could not update that contract. Please try again.')
    } finally {
      setTogglingId(null)
    }
  }

  const filteredContracts = contracts.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (typeFilter !== 'all' && c.agreement_type !== typeFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const haystack = `${c.title} ${c.description ?? ''}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  return (
    <main className="dash-main">
      <header className="dash-topbar m-header">
        <h1>Signed Contracts</h1>
        <div className="topbar-actions">
          <span className="chip">
            Total <span className="chip-badge">{summary?.total ?? contracts.length}</span>
          </span>
          <button type="button" className="btn-solid" onClick={() => setShowUpload((v) => !v)}>
            <IconPlus /> Add Contract
          </button>
        </div>
      </header>

      {showUpload && (
        <form className="card signed-upload-form" onSubmit={handleUpload}>
          <div className="field-row">
            <label className="field">
              <span>Contract name</span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Master Services Agreement…"
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span>Agreement type</span>
              <select
                value={form.agreementType}
                onChange={(e) => setForm((f) => ({ ...f, agreementType: e.target.value as ContractType }))}
              >
                <option value="nda">NDA</option>
                <option value="consultancy">Consultancy</option>
                <option value="supplier">Supplier</option>
                <option value="general">General</option>
              </select>
            </label>
            <label className="field">
              <span>Integration source</span>
              <input
                type="text"
                value={form.integrationSource}
                onChange={(e) => setForm((f) => ({ ...f, integrationSource: e.target.value }))}
                placeholder="manual, signinghub, trackado…"
                autoComplete="off"
              />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Signed date</span>
              <input
                type="date"
                value={form.signedDate}
                onChange={(e) => setForm((f) => ({ ...f, signedDate: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>Expiry date (optional)</span>
              <input
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
              />
            </label>
          </div>
          <label className="field">
            <span>Description (optional)</span>
            <textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </label>
          <label className="field">
            <span>Executed document (PDF, Word, or text; max 10MB)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="contract-actions">
            <button type="button" className="btn-ghost" onClick={() => setShowUpload(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-solid" disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
          {uploadError && <p className="contract-error" aria-live="polite">{uploadError}</p>}
        </form>
      )}

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading signed contracts…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state" role="status" aria-live="polite">
          <p>Couldn&rsquo;t reach the backend for signed contracts.</p>
          <button type="button" className="btn-ghost" onClick={refresh}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
          <section className="dash-row signed-stats m-stats">
            <div className="card">
              <div className="card-header">
                <span>Total Contracts</span>
              </div>
              <div className="stat-line">
                <span className="stat-big">{summary?.total ?? 0}</span>
                <span className="stat-sub">signed to date</span>
              </div>
            </div>
            <div className="card">
              <div className="card-header">
                <span>Active</span>
              </div>
              <div className="stat-line">
                <span className="stat-big">{summary?.active ?? 0}</span>
                <span className="stat-sub">in force</span>
              </div>
            </div>
            <div className="card">
              <div className="card-header">
                <span>Expiring Soon</span>
              </div>
              <div className="stat-line">
                <span className="stat-big">{summary?.expiring_soon ?? 0}</span>
                <span className="stat-sub">within 30 days</span>
              </div>
            </div>
          </section>

          <section className="card signed-table-card">
            <div className="signed-filters">
              <label className="field">
                <span>Search</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name…"
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span>Status</span>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="expiring">Expiring</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="field">
                <span>Type</span>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
                  <option value="all">All types</option>
                  <option value="nda">NDA</option>
                  <option value="consultancy">Consultancy</option>
                  <option value="supplier">Supplier</option>
                  <option value="general">General</option>
                </select>
              </label>
              <div className="field signed-filters-count">
                <span>Results</span>
                <span className="chip">
                  Showing <span className="chip-badge">{filteredContracts.length}</span>
                </span>
              </div>
            </div>

            {actionError && <p className="contract-error" aria-live="polite">{actionError}</p>}

            <div className="table-scroll">
            <table className="data-table data-table-list" role="table">
              <thead role="rowgroup">
                <tr role="row">
                  <th role="columnheader">Contract</th>
                  <th role="columnheader">Type</th>
                  <th role="columnheader">Signed Date</th>
                  <th role="columnheader">Source</th>
                  <th role="columnheader">Status</th>
                  <th role="columnheader" />
                </tr>
              </thead>
              <tbody role="rowgroup">
                {filteredContracts.map((c) => (
                  <tr key={c.id} role="row">
                    <td role="cell" className="signed-contract-cell">
                      <div className="signed-contract-title">{c.title}</div>
                      {c.description && <div className="muted signed-contract-description">{c.description}</div>}
                    </td>
                    <td role="cell" className="muted">{typeLabel[c.agreement_type]}</td>
                    <td role="cell" className="muted" data-label="Signed">{c.signed_date}</td>
                    <td role="cell" className="muted" data-label="Source">{c.integration_source}</td>
                    <td role="cell">
                      <span className="status-badge" style={{ color: statusColor[c.status], background: `rgba(${statusColorRgb[c.status]}, 0.13)` }}>
                        {statusLabel[c.status]}
                      </span>
                    </td>
                    <td role="cell" data-full>
                      <div className="clients-row-actions signed-row-actions">
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={downloadingId === c.id}
                          onClick={() => handleDownload(c)}
                        >
                          {downloadingId === c.id ? 'Opening…' : 'View'}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={togglingId === c.id}
                          onClick={() => handleToggleArchive(c)}
                        >
                          {togglingId === c.id ? 'Saving…' : c.status === 'archived' ? 'Reactivate' : 'Archive'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredContracts.length === 0 && (
                  <tr role="row">
                    <td role="cell" colSpan={6} className="muted">
                      {contracts.length === 0
                        ? 'No signed contracts yet. Add one with Add Contract.'
                        : 'No contracts match these filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </section>
        </>
      )}
    </main>
  )
}

export default SignedContracts
