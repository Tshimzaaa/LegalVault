import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
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
import { listClients } from '../../api/clients'
import type { Client } from '../../api/clients'

type LoadState = 'loading' | 'error' | 'ready'

const statusColor: Record<ContractLifecycleStatus, string> = {
  active: '#22c55e',
  expiring: '#f97316',
  archived: '#9ca3af',
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

const emptyUploadForm = {
  clientId: '',
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

  const [clients, setClients] = useState<Client[]>([])

  const [statusFilter, setStatusFilter] = useState<'all' | ContractLifecycleStatus>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | ContractType>('all')
  const [search, setSearch] = useState('')

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
    Promise.all([listSignedContracts(token), listClients(token), getSignedContractsSummary(token)])
      .then(([contractData, clientData, summaryData]) => {
        setContracts(contractData)
        setClients(clientData)
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

    if (!token || !form.clientId || !form.title || !form.signedDate || !file) {
      setUploadError('Client, title, signed date, and a file are required.')
      return
    }

    setUploading(true)
    try {
      await uploadSignedContract(token, {
        client_id: form.clientId,
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
      const haystack = `${c.title} ${c.description ?? ''} ${c.client_name}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  return (
    <main className="dash-main">
      <header className="dash-topbar">
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
              <span>Client</span>
              <select value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}>
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </label>
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
          </div>
          <div className="field-row">
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
            <span>Executed document (PDF, Word, or text — max 10MB)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="matter-actions">
            <button type="button" className="btn-ghost" onClick={() => setShowUpload(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-solid" disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
          {uploadError && <p className="matter-error" aria-live="polite">{uploadError}</p>}
        </form>
      )}

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading signed contracts…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for signed contracts.</p>
          <button type="button" className="btn-ghost" onClick={refresh}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
          <section className="dash-row signed-stats">
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
                  placeholder="Search by name, client…"
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
              <span className="chip">
                Showing <span className="chip-badge">{filteredContracts.length}</span>
              </span>
            </div>

            {actionError && <p className="matter-error" aria-live="polite">{actionError}</p>}

            <table className="data-table">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Signed Date</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredContracts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.title}
                      {c.description && <div className="muted signed-contract-description">{c.description}</div>}
                    </td>
                    <td className="muted">{c.client_name}</td>
                    <td className="muted">{typeLabel[c.agreement_type]}</td>
                    <td className="muted">{c.signed_date}</td>
                    <td className="muted">{c.integration_source}</td>
                    <td>
                      <span className="status-badge" style={{ color: statusColor[c.status], background: `${statusColor[c.status]}22` }}>
                        {statusLabel[c.status]}
                      </span>
                    </td>
                    <td>
                      <div className="clients-row-actions">
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
                  <tr>
                    <td colSpan={7} className="muted">
                      {contracts.length === 0
                        ? 'No signed contracts yet. Add one with Add Contract.'
                        : 'No contracts match these filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  )
}

export default SignedContracts
