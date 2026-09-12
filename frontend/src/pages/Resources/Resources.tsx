import { Link } from 'react-router-dom'
import './Resources.css'
import { IconFilePlus, IconWorkflow, IconSignedContract, IconShield, IconGear, IconTemplates } from '../../components/icons'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'

interface Article {
  name: string
  category: string
  description: string
  icon: React.ReactNode
}

const articles: Article[] = [
  { name: 'How to submit a request', category: 'Getting Started', description: 'Step-by-step guide to logging a new legal request through Request Support.', icon: <IconFilePlus /> },
  { name: 'Understanding request statuses', category: 'Workflow', description: 'What Submitted, In Progress, In Review and Complete mean for your matters.', icon: <IconWorkflow /> },
  { name: 'Working with e-signatures', category: 'Signed Contracts', description: 'How SigningHub and Trackado are used to finalize your agreements.', icon: <IconSignedContract /> },
  { name: 'Using fallback positions', category: 'Negotiation', description: 'How to use My Learned Friend to keep negotiations moving within approved risk limits.', icon: <IconShield /> },
  { name: 'Connecting your tools', category: 'Integrations', description: 'Linking cloud storage and e-sign providers to your LegalHub account.', icon: <IconGear /> },
  { name: 'Choosing the right template', category: 'Templates', description: 'Picking the correct master template for low-risk, self-service agreements.', icon: <IconTemplates /> },
]

interface ResourcesProps {
  contact: ClientContact
  onLogout: () => void
}

function Resources({ contact, onLogout }: ResourcesProps) {
  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Resources</h1>
        <div className="topbar-actions">
          <span className="chip">
            Guides <span className="chip-badge">{articles.length}</span>
          </span>
          <ProfileMenu user={contact} onLogout={onLogout} />
        </div>
      </header>

      <section className="templates-grid">
        {articles.map((a) => (
          <div key={a.name} className="card template-card">
            <span className="template-icon">{a.icon}</span>
            <span className="template-name">{a.name}</span>
            <span className="template-category">{a.category}</span>
            <p className="template-description">{a.description}</p>
            <Link
              to={`/client/knowledge-base?category=${encodeURIComponent(a.category)}`}
              className="btn-ghost template-use-btn"
            >
              Read Article
            </Link>
          </div>
        ))}
      </section>
    </main>
  )
}

export default Resources
