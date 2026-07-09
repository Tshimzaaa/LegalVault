import './Templates.css'
import {
  IconSignedContract,
  IconShield,
  IconFolder,
  IconDollar,
  IconGavel,
  IconContractData,
  IconFilePlus,
  IconUser,
} from '../../components/icons'

interface Template {
  name: string
  category: string
  description: string
  icon: React.ReactNode
}

const templates: Template[] = [
  { name: 'Employment Contract', category: 'Employment', description: 'Standard fixed-term or permanent employment agreement.', icon: <IconUser /> },
  { name: 'Mutual NDA', category: 'Confidentiality', description: 'Two-way non-disclosure agreement for early-stage discussions.', icon: <IconShield /> },
  { name: 'Commercial Lease', category: 'Real Estate', description: 'Lease agreement for retail or office premises.', icon: <IconFolder /> },
  { name: 'Retainer Agreement', category: 'Billing', description: 'Recurring monthly retainer with scope and fee schedule.', icon: <IconDollar /> },
  { name: 'Settlement Agreement', category: 'Litigation', description: 'Full and final settlement terms between disputing parties.', icon: <IconGavel /> },
  { name: 'Corporate Bylaws', category: 'Corporate', description: 'Governance rules for a newly incorporated entity.', icon: <IconContractData /> },
  { name: 'IP License Agreement', category: 'Intellectual Property', description: 'Licensing terms for trademarks, patents, or software.', icon: <IconSignedContract /> },
  { name: 'Engagement Letter', category: 'Onboarding', description: 'Client onboarding letter outlining scope and fees.', icon: <IconFilePlus /> },
]

function Templates() {
  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Templates</h1>
        <span className="chip">
          Available <span className="chip-badge">{templates.length}</span>
        </span>
      </header>

      <section className="templates-grid">
        {templates.map((t) => (
          <div key={t.name} className="card template-card">
            <span className="template-icon">{t.icon}</span>
            <span className="template-name">{t.name}</span>
            <span className="template-category">{t.category}</span>
            <p className="template-description">{t.description}</p>
            <button type="button" className="btn-ghost template-use-btn">
              Use Template
            </button>
          </div>
        ))}
      </section>
    </main>
  )
}

export default Templates
