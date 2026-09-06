import { useState } from 'react'
import './ContractData.css'

interface ContractRow {
  name: string
  client: string
  type: string
  value: number
  perMonth?: boolean
  expiry: string
  status: 'Active' | 'Expiring' | 'Expired'
}

const rows: ContractRow[] = [
  { name: 'Share Purchase Agreement', client: 'Meridian Capital', type: 'Corporate', value: 420000, expiry: '02 Jun 2028', status: 'Active' },
  { name: 'Master Services Agreement', client: 'Vantage Logistics', type: 'Commercial', value: 186500, expiry: '18 May 2027', status: 'Active' },
  { name: 'Trademark Licensing', client: 'Kaya Software', type: 'IP', value: 64200, expiry: '30 Apr 2027', status: 'Active' },
  { name: 'Commercial Lease Renewal', client: 'Coastal Retail', type: 'Real Estate', value: 98000, expiry: '11 Aug 2026', status: 'Expiring' },
  { name: 'Employment Contract', client: 'Nkosi Holdings', type: 'Employment', value: 32000, expiry: '22 Mar 2027', status: 'Active' },
  { name: 'NDA – Partner Onboarding', client: 'Thabo & Associates', type: 'NDA', value: 0, expiry: '09 Mar 2026', status: 'Expiring' },
  { name: 'Settlement Agreement', client: 'Estate of J. Botha', type: 'Litigation', value: 215000, expiry: '27 Feb 2026', status: 'Expired' },
  { name: 'Retainer Agreement', client: 'Kaya Software', type: 'Corporate', value: 18000, perMonth: true, expiry: '14 Feb 2027', status: 'Active' },
]

const currencyFormat = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'ZAR',
  maximumFractionDigits: 0,
})

function formatContractValue(row: ContractRow): string {
  return row.perMonth ? `${currencyFormat.format(row.value)} / mo` : currencyFormat.format(row.value)
}

const statusColor: Record<ContractRow['status'], string> = {
  Active: '#22c55e',
  Expiring: '#f97316',
  Expired: '#ef4444',
}

function ContractData() {
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | ContractRow['status']>('all')

  const types = Array.from(new Set(rows.map((r) => r.type))).sort()
  const filteredRows = rows.filter(
    (r) => (typeFilter === 'all' || r.type === typeFilter) && (statusFilter === 'all' || r.status === statusFilter),
  )

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Contract Data</h1>
        <span className="chip">
          <span className="chip-badge">{filteredRows.length}</span> of {rows.length}
        </span>
      </header>

      <div className="contract-data-filter">
        <span className="deadlines-filter-label">Type</span>
        <select
          className="select-input"
          aria-label="Filter by contract type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All Types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="deadlines-filter-label">Status</span>
        <select
          className="select-input"
          aria-label="Filter by contract status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | ContractRow['status'])}
        >
          <option value="all">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Expiring">Expiring</option>
          <option value="Expired">Expired</option>
        </select>
      </div>

      <section className="card contract-data-table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Contract</th>
              <th>Client</th>
              <th>Type</th>
              <th>Value</th>
              <th>Expiry</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td className="muted">{r.client}</td>
                <td className="muted">{r.type}</td>
                <td className="tabular">{formatContractValue(r)}</td>
                <td className="muted tabular">{r.expiry}</td>
                <td>
                  <span
                    className="status-badge"
                    style={{ color: statusColor[r.status], background: `${statusColor[r.status]}22` }}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && <p className="muted">No contracts match these filters.</p>}
      </section>
    </main>
  )
}

export default ContractData
