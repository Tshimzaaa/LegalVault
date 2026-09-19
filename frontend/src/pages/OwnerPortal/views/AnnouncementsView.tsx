import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createAnnouncement, deleteAnnouncement, listOwnerAnnouncements, updateAnnouncement } from '../../../api/announcements'
import type { Announcement, AnnouncementSeverity } from '../../../api/announcements'
import { IconPlus, IconTrash } from '../../../components/icons'
import { useOwnerData } from '../OwnerDataContext'
import { ErrorState, LoadingState, Page } from '../ownerParts'
import { severityColor, severityColorRgb } from '../ownerUtils'
import type { LoadState } from '../ownerUtils'

function AnnouncementsView() {
  const { token } = useOwnerData()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [announcementsStatus, setAnnouncementsStatus] = useState<LoadState>('loading')
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [announcementSeverity, setAnnouncementSeverity] = useState<AnnouncementSeverity>('info')
  const [announcementSaving, setAnnouncementSaving] = useState(false)
  const [announcementError, setAnnouncementError] = useState<string | null>(null)
  const [announcementBusyId, setAnnouncementBusyId] = useState<string | null>(null)
  const [announcementActionError, setAnnouncementActionError] = useState<string | null>(null)

  function loadAnnouncements() {
    if (!token) {
      setAnnouncementsStatus('error')
      return
    }
    setAnnouncementsStatus('loading')
    listOwnerAnnouncements(token)
      .then((data) => {
        setAnnouncements(data)
        setAnnouncementsStatus('ready')
      })
      .catch(() => setAnnouncementsStatus('error'))
  }

  useEffect(loadAnnouncements, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreateAnnouncement(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setAnnouncementError(null)
    setAnnouncementSaving(true)
    try {
      const created = await createAnnouncement(token, {
        title: announcementTitle,
        body: announcementBody,
        severity: announcementSeverity,
        is_active: true,
      })
      setAnnouncements((prev) => [created, ...prev])
      setAnnouncementTitle('')
      setAnnouncementBody('')
      setAnnouncementSeverity('info')
      setShowAnnouncementForm(false)
    } catch (err) {
      setAnnouncementError(err instanceof Error ? err.message : 'Could not create the announcement.')
    } finally {
      setAnnouncementSaving(false)
    }
  }

  async function handleToggleAnnouncementActive(a: Announcement) {
    if (!token) return
    setAnnouncementActionError(null)
    setAnnouncementBusyId(a.id)
    // Optimistic: flip immediately, reconcile with the server copy, roll back on failure.
    setAnnouncements((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_active: !a.is_active } : x)))
    try {
      const updated = await updateAnnouncement(token, a.id, { is_active: !a.is_active })
      setAnnouncements((prev) => prev.map((x) => (x.id === a.id ? updated : x)))
    } catch (err) {
      setAnnouncements((prev) => prev.map((x) => (x.id === a.id ? a : x)))
      setAnnouncementActionError(err instanceof Error ? err.message : 'Could not update the announcement.')
    } finally {
      setAnnouncementBusyId(null)
    }
  }

  async function handleDeleteAnnouncement(a: Announcement) {
    if (!token) return
    if (!window.confirm(`Delete the announcement “${a.title}”?`)) return
    setAnnouncementBusyId(a.id)
    try {
      await deleteAnnouncement(token, a.id)
      setAnnouncements((prev) => prev.filter((x) => x.id !== a.id))
    } catch (err) {
      setAnnouncementActionError(err instanceof Error ? err.message : 'Could not delete the announcement.')
    } finally {
      setAnnouncementBusyId(null)
    }
  }

  return (
    <Page
      title="Announcements"
      subtitle="Banners shown to every organization"
      actions={
        <button type="button" className="btn-solid" aria-expanded={showAnnouncementForm} onClick={() => setShowAnnouncementForm((v) => !v)}>
          <IconPlus aria-hidden="true" /> New announcement
        </button>
      }
    >
      <section className="card owner-announcements-card" aria-label="Platform announcements">
        {showAnnouncementForm && (
          <form onSubmit={handleCreateAnnouncement} className="owner-announcement-form">
            <div className="field-row">
              <label className="field">
                <span>Title</span>
                <input value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} required />
              </label>
              <label className="field">
                <span>Severity</span>
                <select value={announcementSeverity} onChange={(e) => setAnnouncementSeverity(e.target.value as AnnouncementSeverity)}>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
            </div>
            <label className="field">
              <span>Body</span>
              <textarea rows={2} value={announcementBody} onChange={(e) => setAnnouncementBody(e.target.value)} required />
            </label>
            <p className="contract-error owner-form-error" aria-live="polite">
              {announcementError}
            </p>
            <div className="contract-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowAnnouncementForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-solid" disabled={announcementSaving}>
                {announcementSaving ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </form>
        )}

        {announcementsStatus === 'loading' && <LoadingState label="Loading announcements…" />}
        {announcementsStatus === 'error' && <ErrorState label="Couldn’t reach the backend for announcements." onRetry={loadAnnouncements} />}

        <p className="contract-error owner-form-error" role="alert" hidden={!announcementActionError}>
          {announcementActionError}
        </p>

        {announcementsStatus === 'ready' && (
          <div className="list-rows">
            {announcements.map((a) => (
              <div key={a.id} className={`owner-announcement-row${a.is_active ? '' : ' inactive'}`}>
                <div className="owner-announcement-text">
                  <div className="owner-announcement-title">
                    <span
                      className="announcement-severity-badge"
                      style={{ color: severityColor[a.severity], background: `rgba(${severityColorRgb[a.severity]}, 0.13)` }}
                    >
                      {a.severity}
                    </span>
                    <strong>{a.title}</strong>
                    <span className="owner-announcement-state muted">{a.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <p className="muted">{a.body}</p>
                </div>
                <div className="owner-row-actions">
                  <button
                    type="button"
                    className="btn-ghost owner-org-toggle"
                    disabled={announcementBusyId === a.id}
                    onClick={() => handleToggleAnnouncementActive(a)}
                  >
                    {a.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    className="owner-icon-btn"
                    disabled={announcementBusyId === a.id}
                    onClick={() => handleDeleteAnnouncement(a)}
                    aria-label={`Delete ${a.title}`}
                    title="Delete announcement"
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>
            ))}
            {announcements.length === 0 && (
              <div className="inq-empty">
                <p>No announcements yet.</p>
                <p className="muted">Published announcements appear as a banner for every organization.</p>
              </div>
            )}
          </div>
        )}
      </section>
    </Page>
  )
}

export default AnnouncementsView
