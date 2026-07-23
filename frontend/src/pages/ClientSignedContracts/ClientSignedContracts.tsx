import './ClientSignedContracts.css'
import { IconChevron } from '../../components/icons'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'

interface Contract {
  name: string
  agreementType: string
  signedDate: string
  provider: 'SigningHub' | 'Trackado'
  status: 'Active' | 'Archived' | 'Expiring'
}

const contracts: Contract[] = [
  { name: 'Mutual NDA — Company C', agreementType: 'NDA', signedDate: '15 Jul 2026', provider: 'SigningHub', status: 'Active' },
  { name: 'Consultancy Agreement', agreementType: 'Consultancy', signedDate: '10 Jul 2026', provider: 'Trackado', status: 'Active' },
  { name: 'Supplier Agreement — Kaya Software', agreementType: 'Supplier', signedDate: '20 Jun 2026', provider: 'SigningHub', status: 'Active' },
  { name: 'Vendor NDA — Vantage Logistics', agreementType: 'NDA', signedDate: '2 Jun 2026', provider: 'SigningHub', status: 'Expiring' },
  { name: 'Consultancy Agreement — Nkosi Holdings', agreementType: 'Consultancy', signedDate: '10 Apr 2026', provider: 'Trackado', status: 'Archived' },
]

const statusColor: Record<Contract['status'], string> = {
  Active: '#22c55e',
  Expiring: '#f97316',
  Archived: '#9ca3af',
}

interface ClientSignedContractsProps {
  contact: ClientContact
  onLogout: () => void
}

function ClientSignedContracts({ contact, onLogout }: ClientSignedContractsProps) {
  const activeCount = contracts.filter((c) => c.status === 'Active').length
  const expiringCount = contracts.filter((c) => c.status === 'Expiring').length

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Signed Contracts</h1>
        <div className="topbar-actions">
          <button className="chip">
            Filter <IconChevron /> <span className="chip-badge">{contracts.length}</span>
          </button>
          <ProfileMenu user={contact} onLogout={onLogout} />
        </div>
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
              <th>Type</th>
              <th>Signed Date</th>
              <th>Source</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.name}>
                <td>{c.name}</td>
                <td className="muted">{c.agreementType}</td>
                <td className="muted">{c.signedDate}</td>
                <td className="muted">{c.provider}</td>
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

export default ClientSignedContracts
