import { useEffect, useState } from 'react'
import './ClientTemplates.css'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'
import { listClientTemplates, downloadClientTemplate } from '../../api/clientTemplates'
import type { Template } from '../../api/templates'
import { getTemplateIcon } from '../../utils/templateIcon'

interface ClientTemplatesProps {
  contact: ClientContact
  onLogout: () => void
}

type LoadState = 'loading' | 'error' | 'ready'

function ClientTemplates({ contact, onLogout }: ClientTemplatesProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    const token = localStorage.getItem('access_token')
    if (!token) {
      setStatus('error')
      return
    }

    listClientTemplates(token)
      .then((data) => {
        if (cancelled) return
        setTemplates(data)
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

  async function handleUseTemplate(templateId: string) {
    const token = localStorage.getItem('access_token')
    if (!token) return
    setDownloadError(null)
    setDownloadingId(templateId)
    try {
      const { download_url } = await downloadClientTemplate(token, templateId)
      window.open(download_url, '_blank', 'noopener,noreferrer')
    } catch {
      setDownloadError('Could not open that template. Please try again.')
    } finally {
      setDownloadingId(null)
    }
  }

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

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading templates…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for your templates.</p>
          <button type="button" className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      {downloadError && <p className="matter-error" aria-live="polite">{downloadError}</p>}

      {status === 'ready' && (
        <section className="templates-grid">
          {templates.map((t) => (
            <div key={t.id} className="card template-card">
              <span className="template-icon">{getTemplateIcon(t.category)}</span>
              <span className="template-name">{t.title}</span>
              <span className="template-category">{t.category}</span>
              <p className="template-description">{t.description}</p>
              <button
                type="button"
                className="btn-ghost template-use-btn"
                disabled={downloadingId === t.id}
                onClick={() => handleUseTemplate(t.id)}
              >
                {downloadingId === t.id ? 'Preparing…' : 'Use Template'}
              </button>
            </div>
          ))}
          {templates.length === 0 && <p className="muted">No templates available yet.</p>}
        </section>
      )}
    </main>
  )
}

export default ClientTemplates
