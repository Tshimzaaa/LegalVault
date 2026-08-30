import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './ClientIntakeForms.css'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'
import { listPublishedIntakeForms } from '../../api/clientIntake'
import type { IntakeForm } from '../../api/intakeForms'

type LoadState = 'loading' | 'error' | 'ready'

interface ClientIntakeFormsProps {
  contact: ClientContact
  onLogout: () => void
}

function ClientIntakeForms({ contact, onLogout }: ClientIntakeFormsProps) {
  const [forms, setForms] = useState<IntakeForm[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    const token = localStorage.getItem('access_token')
    if (!token) {
      setStatus('error')
      return
    }
    listPublishedIntakeForms(token)
      .then((data) => {
        if (cancelled) return
        setForms(data)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Intake Forms</h1>
        <div className="topbar-actions">
          <span className="chip">
            Available <span className="chip-badge">{forms.length}</span>
          </span>
          <ProfileMenu user={contact} onLogout={onLogout} />
        </div>
      </header>

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading intake forms…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state" role="status" aria-live="polite">
          <p>Couldn&rsquo;t reach the backend for intake forms.</p>
          <button type="button" className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <section className="templates-grid">
          {forms.map((f) => (
            <div key={f.id} className="card template-card">
              <span className="template-name">{f.title}</span>
              <p className="template-description">{f.description}</p>
              <Link to={f.id} className="btn-ghost template-use-btn">
                Fill Out
              </Link>
            </div>
          ))}
          {forms.length === 0 && <p className="muted">No intake forms are available right now.</p>}
        </section>
      )}
    </main>
  )
}

export default ClientIntakeForms
