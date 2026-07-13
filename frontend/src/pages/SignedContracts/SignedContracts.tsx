import './SignedContracts.css'
import { IconChevron } from '../../components/icons'

interface Contract {
  name: string
  client: string
  signedDate: string
  value: string
  status: 'Active' | 'Archived' | 'Expiring'
}

const contracts: Contract[] = [
  { name: 'Share Purchase Agreement', client: 'Meridian Capital', signedDate: '02 Jun 2026', value: 'R420,000', status: 'Active' },
  { name: 'Master Services Agreement', client: 'Vantage Logistics', signedDate: '18 May 2026', value: 'R186,500', status: 'Active' },
  { name: 'Trademark Licensing', client: 'Kaya Software', signedDate: '30 Apr 2026', value: 'R64,200', status: 'Active' },
  { name: 'Commercial Lease Renewal', client: 'Coastal Retail', signedDate: '11 Apr 2026', value: 'R98,000', status: 'Expiring' },
  { name: 'Employment Contract', client: 'Nkosi Holdings', signedDate: '22 Mar 2026', value: 'R32,000', status: 'Active' },
  { name: 'NDA – Partner Onboarding', client: 'Thabo & Associates', signedDate: '09 Mar 2026', value: 'R0', status: 'Archived' },
  { name: 'Settlement Agreement', client: 'Estate of J. Botha', signedDate: '27 Feb 2026', value: 'R215,000', status: 'Archived' },
  { name: 'Retainer Agreement', client: 'Kaya Software', signedDate: '14 Feb 2026', value: 'R18,000 / mo', status: 'Active' },
]

const statusColor: Record<Contract['status'], string> = {
  Active: '#22c55e',
  Expiring: '#f97316',
  Archived: '#9ca3af',
}

function SignedContracts() {
  const activeCount = contracts.filter((c) => c.status === 'Active').length
  const expiringCount = contracts.filter((c) => c.status === 'Expiring').length

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Signed Contracts</h1>
        <button className="chip">
          Filter <IconChevron /> <span className="chip-badge">{contracts.length}</span>
        </button>
      </header>

      <section className="dash-row signed-stats">
        <div className="card">
          <div className="card-header">
            <span>Total Contracts</span>
          </div>
          <div className="stat-line">
            <span className="stat-big">{contracts.length}</span>
            <span className="stat-sub">signed to date</span>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span>Active</span>
          </div>
          <div className="stat-line">
            <span className="stat-big">{activeCount}</span>
            <span className="stat-sub">in force</span>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span>Expiring Soon</span>
          </div>
          <div className="stat-line">
            <span className="stat-big">{expiringCount}</span>
            <span className="stat-sub">within 30 days</span>
          </div>
        </div>
      </section>

      <section className="card signed-table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Contract</th>
              <th>Client</th>
              <th>Signed Date</th>
              <th>Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.name}>
                <td>{c.name}</td>
                <td className="muted">{c.client}</td>
                <td className="muted">{c.signedDate}</td>
                <td className="tabular">{c.value}</td>
                <td>
                  <span className="status-badge" style={{ color: statusColor[c.status], background: `${statusColor[c.status]}22` }}>
                    {c.status}
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

export default SignedContracts
