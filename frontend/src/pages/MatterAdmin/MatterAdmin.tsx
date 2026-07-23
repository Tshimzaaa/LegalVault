import './MatterAdmin.css'
import { IconChevron } from '../../components/icons'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'

interface MatterRow {
  matter: string
  owner: string
  permissionLevel: 'Owner' | 'Editor' | 'Viewer'
  teamMembers: number
}

const rows: MatterRow[] = [
  { matter: 'NDA Request — Company C', owner: 'J. Mokoena', permissionLevel: 'Owner', teamMembers: 3 },
  { matter: 'Consultancy Agreement Review', owner: 'T. Ndlovu', permissionLevel: 'Owner', teamMembers: 2 },
  { matter: 'Supplier Onboarding — Coastal Retail', owner: 'J. Mokoena', permissionLevel: 'Editor', teamMembers: 4 },
  { matter: 'Vendor NDA — Vantage Logistics', owner: 'R. Patel', permissionLevel: 'Viewer', teamMembers: 1 },
  { matter: 'Mutual NDA — Company C', owner: 'T. Ndlovu', permissionLevel: 'Owner', teamMembers: 2 },
]

const permissionColor: Record<MatterRow['permissionLevel'], string> = {
  Owner: '#22c55e',
  Editor: '#3987e5',
  Viewer: '#9ca3af',
}

interface MatterAdminProps {
  contact: ClientContact
  onLogout: () => void
}

function MatterAdmin({ contact, onLogout }: MatterAdminProps) {
  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Matter Admin</h1>
        <div className="topbar-actions">
          <button className="chip">
            Filter <IconChevron /> <span className="chip-badge">{rows.length}</span>
          </button>
          <ProfileMenu user={contact} onLogout={onLogout} />
        </div>
      </header>

      <section className="card matter-admin-table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Matter</th>
              <th>Owner</th>
              <th>Permission</th>
              <th>Team Members</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.matter}>
                <td>{r.matter}</td>
                <td className="muted">{r.owner}</td>
                <td>
                  <span
                    className="status-badge"
                    style={{ color: permissionColor[r.permissionLevel], background: `${permissionColor[r.permissionLevel]}22` }}
                  >
                    {r.permissionLevel}
                  </span>
                </td>
                <td className="muted tabular">{r.teamMembers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}

export default MatterAdmin
