import './ClientTemplates.css'
import { IconSignedContract, IconShield, IconContractData, IconFilePlus } from '../../components/icons'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'

interface Template {
  name: string
  category: string
  description: string
  icon: React.ReactNode
}

const templates: Template[] = [
  { name: 'Master Services Agreement', category: 'MSA', description: 'Standard MSA for engaging a new supplier or service provider.', icon: <IconContractData /> },
  { name: 'Mutual NDA', category: 'NDA', description: 'Two-way non-disclosure agreement for early-stage discussions.', icon: <IconShield /> },
  { name: 'One-Way NDA', category: 'NDA', description: 'Single-direction non-disclosure agreement for sharing confidential information.', icon: <IconShield /> },
  { name: 'Service Contract', category: 'Service Contract', description: 'Standard terms for a defined scope of work with a vendor.', icon: <IconSignedContract /> },
  { name: 'Advisory Agreement', category: 'Advisory', description: 'Engagement terms for an external advisor or consultant.', icon: <IconFilePlus /> },
]

interface ClientTemplatesProps {
  contact: ClientContact
  onLogout: () => void
}

function ClientTemplates({ contact, onLogout }: ClientTemplatesProps) {
  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Templates</h1>
        <div className="topbar-actions">
          <span className="chip">
            Available <span className="chip-badge">{templates.length}</span>
          </span>
          <ProfileMenu user={contact} onLogout={onLogout} />
        </div>
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

export default ClientTemplates
