import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './FallbackClauses.css'
import { IconPlus, IconEdit, IconTrash } from '../../components/icons'
import {
  listFallbackClauses,
  createFallbackClause,
  updateFallbackClause,
  deleteFallbackClause,
} from '../../api/fallbackClauses'
import type { FallbackClause } from '../../api/fallbackClauses'
import { getTemplateIcon } from '../../utils/templateIcon'

type LoadState = 'loading' | 'error' | 'ready'

const emptyForm = { name: '', category: '', description: '', content: '', pre_approved: true }

function FallbackClauses() {
  const [clauses, setClauses] = useState<FallbackClause[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
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

    listFallbackClauses(token)
      .then((data) => {
        if (cancelled) return
        setClauses(data)
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

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setCreateError(null)

    const token = localStorage.getItem('access_token')
    if (!token || !form.name || !form.category || !form.description || !form.content) {
      setCreateError('Name, category, description, and clause text are all required.')
      return
    }

    setCreating(true)
    try {
      await createFallbackClause(token, form)
      setForm(emptyForm)
      setShowCreate(false)
      setAttempt((n) => n + 1)
    } catch {
      setCreateError('Could not create the clause. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(c: FallbackClause) {
    const token = localStorage.getItem('access_token')
    if (!token) return
    if (!window.confirm(`Delete “${c.name}”? This cannot be undone.`)) return

    setDeleteError(null)
    setDeletingId(c.id)
    try {
      await deleteFallbackClause(token, c.id)
      setClauses((prev) => prev.filter((item) => item.id !== c.id))
    } catch {
      setDeleteError('Could not delete that clause. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  function startEdit(c: FallbackClause) {
    setEditingId(c.id)
    setEditForm({ name: c.name, category: c.category, description: c.description, content: c.content, pre_approved: c.pre_approved })
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
      const updated = await updateFallbackClause(token, editingId, editForm)
      setClauses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
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
        <h1>Fallback Clauses</h1>
        <div className="topbar-actions">
          <span className="chip">
            Available <span className="chip-badge">{clauses.length}</span>
          </span>
          <button type="button" className="btn-solid" onClick={() => setShowCreate((v) => !v)}>
            <IconPlus /> Add Clause
          </button>
        </div>
      </header>

      {showCreate && (
        <form className="card fallback-clause-form" onSubmit={handleCreate}>
          <div className="field-row">
            <label className="field">
              <span>Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Limitation of Liability (Fallback)…"
                autoComplete="off"
                required
              />
            </label>
            <label className="field">
              <span>Category</span>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Risk…"
                autoComplete="off"
                required
              />
            </label>
          </div>
          <label className="field">
            <span>Description (shown as a quick summary)</span>
            <textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} required />
          </label>
          <label className="field">
            <span>Clause text (shown when a staff member opens “View Fallback Position”)</span>
            <textarea rows={6} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} required />
          </label>
          <label className="field field-checkbox">
            <input
              type="checkbox"
              checked={form.pre_approved}
              onChange={(e) => setForm((f) => ({ ...f, pre_approved: e.target.checked }))}
            />
            <span>Pre-approved (staff can rely on this without further sign-off)</span>
          </label>
          <div className="contract-actions">
            <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-solid" disabled={creating}>
              {creating ? 'Adding…' : 'Add Clause'}
            </button>
          </div>
          {createError && <p className="contract-error" aria-live="polite">{createError}</p>}
        </form>
      )}

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading fallback clauses…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state" role="status" aria-live="polite">
          <p>Couldn&rsquo;t reach the backend for fallback clauses.</p>
          <button type="button" className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      {deleteError && <p className="contract-error" aria-live="polite">{deleteError}</p>}

      {status === 'ready' && (
        <section className="templates-grid">
          {clauses.map((c) =>
            editingId === c.id ? (
              <form key={c.id} onSubmit={handleSaveEdit} className="card template-card template-edit-form">
                <label className="field">
                  <span>Name</span>
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    autoComplete="off"
                  />
                </label>
                <label className="field">
                  <span>Category</span>
                  <input
                    value={editForm.category}
                    onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                    required
                    autoComplete="off"
                  />
                </label>
                <label className="field">
                  <span>Description</span>
                  <textarea rows={2} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
                </label>
                <label className="field">
                  <span>Clause text</span>
                  <textarea rows={6} value={editForm.content} onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))} />
                </label>
                <label className="field field-checkbox">
                  <input
                    type="checkbox"
                    checked={editForm.pre_approved}
                    onChange={(e) => setEditForm((f) => ({ ...f, pre_approved: e.target.checked }))}
                  />
                  <span>Pre-approved</span>
                </label>
                {editError && <p className="contract-error" aria-live="polite">{editError}</p>}
                <div className="contract-actions">
                  <button type="button" className="btn-ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-solid" disabled={editSaving}>
                    {editSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            ) : (
              <div key={c.id} className="card template-card">
                <div className="template-card-top">
                  <span className="template-icon">{getTemplateIcon(c.category)}</span>
                  <div className="template-card-actions">
                    <button type="button" className="icon-btn" onClick={() => startEdit(c)} aria-label={`Edit ${c.name}`}>
                      <IconEdit />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => handleDelete(c)}
                      disabled={deletingId === c.id}
                      aria-label={`Delete ${c.name}`}
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
                <span className="template-name">{c.name}</span>
                <span className="template-category">
                  {c.category} {c.pre_approved && <span className="chip small">Pre-approved</span>}
                </span>
                <p className="template-description">{c.description}</p>
              </div>
            ),
          )}
          {clauses.length === 0 && <p className="muted">No fallback clauses added yet.</p>}
        </section>
      )}
    </main>
  )
}

export default FallbackClauses
