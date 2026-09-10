import '../ContractData/ContractData.css'
import './LearnedFriend.css'
import { IconChevron, IconShield, IconDollar, IconClock, IconUser, IconFolder, IconGavel } from '../../components/icons'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'

interface Clause {
  name: string
  category: string
  description: string
  icon: React.ReactNode
}

const clauses: Clause[] = [
  { name: 'Limitation of Liability (Fallback)', category: 'Risk', description: 'Pre-approved fallback cap when a counterparty rejects the standard liability clause.', icon: <IconShield /> },
  { name: 'Payment Terms (45 Days)', category: 'Commercial', description: 'Acceptable fallback payment term when 30 days is rejected by a supplier.', icon: <IconDollar /> },
  { name: 'Termination for Convenience', category: 'Term', description: 'Alternative termination clause allowing either party to exit with 60 days notice.', icon: <IconClock /> },
  { name: 'Data Processing Fallback', category: 'Privacy', description: 'Acceptable data handling position when a vendor cannot meet the standard DPA.', icon: <IconUser /> },
  { name: 'Confidentiality Carve-Out', category: 'Confidentiality', description: 'Standard carve-outs acceptable when a counterparty wants broader exceptions.', icon: <IconFolder /> },
  { name: 'Indemnity (Mutual Cap)', category: 'Risk', description: 'Fallback mutual indemnity position for use when one-sided indemnity is rejected.', icon: <IconGavel /> },
]

interface LearnedFriendProps {
  contact: ClientContact
  onLogout: () => void
}

function LearnedFriend({ contact, onLogout }: LearnedFriendProps) {
  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>My Learned Friend</h1>
        <div className="topbar-actions">
          <button className="chip">
            Filter <IconChevron aria-hidden="true" /> <span className="chip-badge">{clauses.length}</span>
          </button>
          <ProfileMenu user={contact} onLogout={onLogout} />
        </div>
      </header>

      <div className="contract-data-filter">
        <span className="deadlines-filter-label">Category</span>
        <button className="chip small">
          All categories <IconChevron aria-hidden="true" />
        </button>
        <span className="deadlines-filter-label">Risk Tolerance</span>
        <button className="chip small">
          Pre-approved <IconChevron aria-hidden="true" />
        </button>
      </div>

      <section className="templates-grid learned-friend-grid">
        {clauses.map((c) => (
          <div key={c.name} className="card template-card">
            <span className="template-icon">{c.icon}</span>
            <span className="template-name">{c.name}</span>
            <span className="template-category">{c.category}</span>
            <p className="template-description">{c.description}</p>
            <button type="button" className="btn-ghost template-use-btn">
              View Fallback Position
            </button>
          </div>
        ))}
      </section>
    </main>
  )
}

export default LearnedFriend
