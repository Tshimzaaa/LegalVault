import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './Templates.css'
import { IconPlus, IconEdit, IconTrash } from '../../components/icons'
import { listTemplates, downloadTemplate, uploadTemplate, updateTemplate, deleteTemplate } from '../../api/templates'
import type { Template } from '../../api/templates'
import { getTemplateIcon } from '../../utils/templateIcon'

type LoadState = 'loading' | 'error' | 'ready'

function Templates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [showUpload, setShowUpload] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    const token = localStorage.getItem('access_token')
    if (!token) {
      setStatus('error')
      return
    }

    listTemplates(token)
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
      const { download_url } = await downloadTemplate(token, templateId)
      window.open(download_url, '_blank', 'noopener,noreferrer')
    } catch {
      setDownloadError('Could not open that template. Please try again.')
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault()
    setUploadError(null)

    const token = localStorage.getItem('access_token')
    if (!token || !title || !category || !file) {
      setUploadError('Title, category, and a file are required.')
      return
    }

    setUploading(true)
    try {
      await uploadTemplate(token, { title, description, category, file })
      setTitle('')
      setDescription('')
      setCategory('')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setShowUpload(false)
      setAttempt((n) => n + 1)
    } catch {
      setUploadError('Could not upload the template. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(t: Template) {
    const token = localStorage.getItem('access_token')
    if (!token) return
    if (!window.confirm(`Delete "${t.title}"? This cannot be undone.`)) return

    setDeleteError(null)
    setDeletingId(t.id)
    try {
      await deleteTemplate(token, t.id)
      setTemplates((prev) => prev.filter((item) => item.id !== t.id))
    } catch {
      setDeleteError('Could not delete that template. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  function startEdit(t: Template) {
    setEditingId(t.id)
    setEditTitle(t.title)
    setEditDescription(t.description ?? '')
    setEditCategory(t.category)
    setEditError(null)
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editingId) return
    const token = localStorage.getItem('access_token')
    if (!token) return

    setEditError(null)
    setEditSaving(true)
    try {
      const updated = await updateTemplate(token, editingId, {
        title: editTitle,
        description: editDescription || null,
        category: editCategory,
      })
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setEditingId(null)
    } catch {
      setEditError('Could not save changes. Please try again.')
    } finally {
      setEditSaving(false)
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
          <button type="button" className="btn-solid" onClick={() => setShowUpload((v) => !v)}>
            <IconPlus /> Upload Template
          </button>
        </div>
      </header>

      {showUpload && (
        <form className="card template-upload-form" onSubmit={handleUpload}>
          <div className="field-row">
            <label className="field">
              <span>Title</span>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mutual NDA" />
            </label>
            <label className="field">
              <span>Category</span>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Confidentiality"
              />
            </label>
          </div>
          <label className="field">
            <span>Description</span>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="field">
            <span>File (PDF, Word, or text — max 10MB)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="matter-actions">
            <button type="button" className="btn-ghost" onClick={() => setShowUpload(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-solid" disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
          {uploadError && <p className="matter-error">{uploadError}</p>}
        </form>
      )}

      {status === 'loading' && (
        <div className="dash-state">
          <span className="dash-spinner" />
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

      {downloadError && <p className="matter-error">{downloadError}</p>}
      {deleteError && <p className="matter-error">{deleteError}</p>}

      {status === 'ready' && (
        <section className="templates-grid">
          {templates.map((t) =>
            editingId === t.id ? (
              <form key={t.id} onSubmit={handleSaveEdit} className="card template-card template-edit-form">
                <label className="field">
                  <span>Title</span>
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
                </label>
                <label className="field">
                  <span>Category</span>
                  <input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} required />
                </label>
                <label className="field">
                  <span>Description</span>
                  <textarea rows={2} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                </label>
                {editError && <p className="matter-error">{editError}</p>}
                <div className="matter-actions">
                  <button type="button" className="btn-ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-solid" disabled={editSaving}>
                    {editSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            ) : (
              <div key={t.id} className="card template-card">
                <div className="template-card-top">
                  <span className="template-icon">{getTemplateIcon(t.category)}</span>
                  <div className="template-card-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => startEdit(t)}
                      aria-label={`Edit ${t.title}`}
                    >
                      <IconEdit />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleDelete(t)}
                      disabled={deletingId === t.id}
                      aria-label={`Delete ${t.title}`}
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
                <span className="template-name">{t.title}</span>
                <span className="template-category">
                  {t.category} <span className="chip small">v{t.version}</span>
                </span>
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
            ),
          )}
          {templates.length === 0 && <p className="muted">No templates uploaded yet.</p>}
        </section>
      )}
    </main>
  )
}

export default Templates
