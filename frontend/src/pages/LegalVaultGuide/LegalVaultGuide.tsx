import './LegalVaultGuide.css'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'

interface Step {
  title: string
  description: string
}

const steps: Step[] = [
  { title: 'Check your Dashboard', description: 'Start here for an overview of your open matters, recent activity, and quick actions.' },
  { title: 'Submit a request', description: 'Use Request Support to send a new legal request to the firm instead of email.' },
  { title: 'Track progress in Workflow', description: 'Watch your request move from Submitted through In Progress, In Review, and Complete.' },
  { title: 'Review signed contracts', description: 'Once a matter is finalized, the executed document appears in Signed Contracts.' },
  { title: 'Use Templates for simple agreements', description: 'For low-risk agreements, generate a document yourself from a pre-approved template.' },
  { title: 'Lean on My Learned Friend', description: 'During negotiation, search pre-approved fallback clauses to keep things moving.' },
  { title: 'Get help anytime', description: 'Visit Resources for guides, or reach out to your legal team directly from a matter.' },
]

interface LegalPortalGuideProps {
  contact: ClientContact
  onLogout: () => void
}

function LegalPortalGuide({ contact, onLogout }: LegalPortalGuideProps) {
  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>How to Use Legal Portal</h1>
        <ProfileMenu user={contact} onLogout={onLogout} />
      </header>

      <section className="guide-steps">
        {steps.map((s, i) => (
          <div key={s.title} className="card guide-step-card">
            <span className="guide-step-number">{i + 1}</span>
            <div className="deadline-text">
              <span className="deadline-title guide-step-title">{s.title}</span>
              <span className="deadline-sub">{s.description}</span>
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}

export default LegalPortalGuide
