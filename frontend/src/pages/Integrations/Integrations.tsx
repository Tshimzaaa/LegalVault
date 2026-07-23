import { useState } from 'react'
import './Integrations.css'
import { IconSignedContract, IconLayers, IconFolder, IconGear } from '../../components/icons'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'

interface Integration {
  name: string
  category: string
  description: string
  icon: React.ReactNode
  connected: boolean
}

const initialIntegrations: Integration[] = [
  { name: 'SigningHub', category: 'E-Signature', description: 'Send and track documents for electronic signature.', icon: <IconSignedContract />, connected: true },
  { name: 'Trackado', category: 'E-Signature', description: 'Alternative e-signature engine for select agreement types.', icon: <IconSignedContract />, connected: true },
  { name: 'Contract Express', category: 'Document Assembly', description: 'Dynamic assembly engine used to generate template-based agreements.', icon: <IconLayers />, connected: false },
  { name: 'Cloud Storage', category: 'Storage', description: 'Sync signed contracts and matter documents to your corporate cloud drive.', icon: <IconFolder />, connected: false },
]

interface IntegrationsProps {
  contact: ClientContact
  onLogout: () => void
}

function Integrations({ contact, onLogout }: IntegrationsProps) {
  const [integrations, setIntegrations] = useState(initialIntegrations)

  function toggle(name: string) {
    setIntegrations((prev) => prev.map((i) => (i.name === name ? { ...i, connected: !i.connected } : i)))
  }

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Integrations</h1>
        <div className="topbar-actions">
          <span className="chip">
            <IconGear /> Connected <span className="chip-badge">{integrations.filter((i) => i.connected).length}</span>
          </span>
          <ProfileMenu user={contact} onLogout={onLogout} />
        </div>
      </header>

      <section className="integrations-grid">
        {integrations.map((i) => (
          <div key={i.name} className="card integration-card">
            <div className="integration-card-header">
              <span className="template-icon">{i.icon}</span>
              <span
                className="status-badge"
                style={{
                  color: i.connected ? '#22c55e' : '#9ca3af',
                  background: i.connected ? 'rgba(34,197,94,0.15)' : 'rgba(156,163,175,0.15)',
                }}
              >
                {i.connected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <span className="template-name">{i.name}</span>
            <span className="template-category">{i.category}</span>
            <p className="template-description">{i.description}</p>
            <button type="button" className="btn-ghost template-use-btn" onClick={() => toggle(i.name)}>
              {i.connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        ))}
      </section>
    </main>
  )
}

export default Integrations
