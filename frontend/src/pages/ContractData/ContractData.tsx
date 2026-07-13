import { IconChevron } from '../../components/icons'
import './ContractData.css'

interface ContractRow {
  name: string
  client: string
  type: string
  value: string
  expiry: string
  status: 'Active' | 'Expiring' | 'Expired'
}

const rows: ContractRow[] = [
  { name: 'Share Purchase Agreement', client: 'Meridian Capital', type: 'Corporate', value: 'R420,000', expiry: '02 Jun 2028', status: 'Active' },
  { name: 'Master Services Agreement', client: 'Vantage Logistics', type: 'Commercial', value: 'R186,500', expiry: '18 May 2027', status: 'Active' },
  { name: 'Trademark Licensing', client: 'Kaya Software', type: 'IP', value: 'R64,200', expiry: '30 Apr 2027', status: 'Active' },
  { name: 'Commercial Lease Renewal', client: 'Coastal Retail', type: 'Real Estate', value: 'R98,000', expiry: '11 Aug 2026', status: 'Expiring' },
  { name: 'Employment Contract', client: 'Nkosi Holdings', type: 'Employment', value: 'R32,000', expiry: '22 Mar 2027', status: 'Active' },
  { name: 'NDA – Partner Onboarding', client: 'Thabo & Associates', type: 'NDA', value: 'R0', expiry: '09 Mar 2026', status: 'Expiring' },
  { name: 'Settlement Agreement', client: 'Estate of J. Botha', type: 'Litigation', value: 'R215,000', expiry: '27 Feb 2026', status: 'Expired' },
  { name: 'Retainer Agreement', client: 'Kaya Software', type: 'Corporate', value: 'R18,000 / mo', expiry: '14 Feb 2027', status: 'Active' },
]

const statusColor: Record<ContractRow['status'], string> = {
  Active: '#22c55e',
  Expiring: '#f97316',
  Expired: '#ef4444',
}

function ContractData() {
  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Contract Data</h1>
        <button className="chip">
          Filter <IconChevron /> <span className="chip-badge">{rows.length}</span>
        </button>
      </header>

      <div className="contract-data-filter">
        <span className="deadlines-filter-label">Type</span>
        <button className="chip small">
          All types <IconChevron />
        </button>
        <span className="deadlines-filter-label">Status</span>
        <button className="chip small">
          All statuses <IconChevron />
        </button>
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
            {rows.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td className="muted">{r.client}</td>
                <td className="muted">{r.type}</td>
                <td className="tabular">{r.value}</td>
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
      </section>
    </main>
  )
}

export default ContractData
