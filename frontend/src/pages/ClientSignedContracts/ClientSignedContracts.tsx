import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import './ClientSignedContracts.css'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'
import {
  listClientSignedContracts,
  getClientSignedContractsSummary,
  getClientSignedContractDownloadUrl,
} from '../../api/clientSignedContracts'
import type { SignedContract, SignedContractsSummary } from '../../api/clientSignedContracts'
import type { ContractType, ContractLifecycleStatus } from '../../api/signedContracts'
import { formatDate } from '../../utils/date'

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

interface ClientSignedContractsProps {
  contact: ClientContact
  onLogout: () => void
}

const validStatusFilters = ['all', 'active', 'expiring', 'archived'] as const
const validTypeFilters = ['all', 'nda', 'consultancy', 'supplier', 'general'] as const

function ClientSignedContracts({ contact, onLogout }: ClientSignedContractsProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [contracts, setContracts] = useState<SignedContract[]>([])
  const [summary, setSummary] = useState<SignedContractsSummary | null>(null)
  const [status, setStatus] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)

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
      if (next === 'all') {
        params.delete('status')
      } else {
        params.set('status', next)
      }
      return params
    })
  }

  function setTypeFilter(next: 'all' | ContractType) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next === 'all') {
        params.delete('type')
      } else {
        params.set('type', next)
      }
      return params
    })
  }

  function setSearch(next: string) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next) {
          params.set('q', next)
        } else {
          params.delete('q')
        }
        return params
      },
      { replace: true },
    )
  }

  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setStatus('error')
      return
    }
    setStatus('loading')
    Promise.all([listClientSignedContracts(token), getClientSignedContractsSummary(token)])
      .then(([contractData, summaryData]) => {
        setContracts(contractData)
        setSummary(summaryData)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [attempt])

  async function handleDownload(contract: SignedContract) {
    const token = localStorage.getItem('access_token')
    if (!token) return
    setDownloadError(null)
    setDownloadingId(contract.id)
    try {
      const url = await getClientSignedContractDownloadUrl(token, contract.id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setDownloadError('Could not open that contract. Please try again.')
    } finally {
      setDownloadingId(null)
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
      <header className="dash-topbar">
        <h1>Signed Contracts</h1>
        <div className="topbar-actions">
          <span className="chip">
            Total <span className="chip-badge">{summary?.total ?? contracts.length}</span>
          </span>
          <ProfileMenu user={contact} onLogout={onLogout} />
        </div>
      </header>

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading signed contracts…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state" role="status" aria-live="polite">
          <p>Couldn&rsquo;t reach the backend for signed contracts.</p>
          <button type="button" className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>
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

            {downloadError && <p className="matter-error" aria-live="polite">{downloadError}</p>}

            <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contract</th>
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
                    <td className="muted">{typeLabel[c.agreement_type]}</td>
                    <td className="muted">{formatDate(c.signed_date)}</td>
                    <td className="muted">{c.integration_source}</td>
                    <td>
                      <span className="status-badge" style={{ color: statusColor[c.status], background: `${statusColor[c.status]}22` }}>
                        {statusLabel[c.status]}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={downloadingId === c.id}
                        onClick={() => handleDownload(c)}
                      >
                        {downloadingId === c.id ? 'Opening…' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredContracts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      {contracts.length === 0 ? 'No signed contracts yet.' : 'No contracts match these filters.'}
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

export default ClientSignedContracts
