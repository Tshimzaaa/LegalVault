import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import './KnowledgeArticles.css'
import { IconPlus, IconEdit, IconTrash } from '../../components/icons'
import {
  listKnowledgeArticles,
  createKnowledgeArticle,
  updateKnowledgeArticle,
  deleteKnowledgeArticle,
} from '../../api/knowledgeArticles'
import type { KnowledgeArticle } from '../../api/knowledgeArticles'
import { ApiError } from '../../api/client'
import type { User } from '../../api/auth'

type LoadState = 'loading' | 'error' | 'ready'

const canAuthor = (role: User['role']) => role === 'admin' || role === 'lawyer'

interface KnowledgeArticlesProps {
  user: User
}

function KnowledgeArticles({ user }: KnowledgeArticlesProps) {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [showNew, setShowNew] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [content, setContent] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [previewId, setPreviewId] = useState<string | null>(null)

  const token = localStorage.getItem('access_token')
  const canWrite = canAuthor(user.role)
  const categories = [...new Set(articles.map((a) => a.category))].sort()

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    if (!token) {
      setStatus('error')
      return
    }
    listKnowledgeArticles(token)
      .then((data) => {
        if (cancelled) return
        setArticles(data)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  function permissionMessage(e: unknown, fallback: string) {
    return e instanceof ApiError && e.status === 403 ? e.message : fallback
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setCreating(true)
    setCreateError(null)
    try {
      const created = await createKnowledgeArticle(token, { title, category, content })
      setArticles((prev) => [created, ...prev])
      setTitle('')
      setCategory('')
      setContent('')
      setShowNew(false)
    } catch (err) {
      setCreateError(permissionMessage(err, 'Could not create the article. Please try again.'))
    } finally {
      setCreating(false)
    }
  }

  function startEdit(a: KnowledgeArticle) {
    setEditingId(a.id)
    setEditTitle(a.title)
    setEditCategory(a.category)
    setEditContent(a.content)
    setEditError(null)
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!token || !editingId) return
    setEditSaving(true)
    setEditError(null)
    try {
      const updated = await updateKnowledgeArticle(token, editingId, {
        title: editTitle,
        category: editCategory,
        content: editContent,
      })
      setArticles((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
      setEditingId(null)
    } catch (err) {
      setEditError(permissionMessage(err, 'Could not save changes. Please try again.'))
    } finally {
      setEditSaving(false)
    }
  }

  async function handleTogglePublish(a: KnowledgeArticle) {
    if (!token) return
    setActionError(null)
    try {
      const updated = await updateKnowledgeArticle(token, a.id, { is_published: !a.is_published })
      setArticles((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      setActionError(permissionMessage(err, 'Could not update publish status.'))
    }
  }

  async function handleDelete(a: KnowledgeArticle) {
    if (!token) return
    if (!window.confirm(`Delete "${a.title}"? This cannot be undone.`)) return
    setActionError(null)
    setDeletingId(a.id)
    try {
      await deleteKnowledgeArticle(token, a.id)
      setArticles((prev) => prev.filter((item) => item.id !== a.id))
    } catch (err) {
      setActionError(permissionMessage(err, 'Could not delete the article. Please try again.'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Knowledge Base</h1>
        <div className="topbar-actions">
          <span className="chip">
            Articles <span className="chip-badge">{articles.length}</span>
          </span>
          {canWrite && (
            <button type="button" className="btn-solid" onClick={() => setShowNew((v) => !v)}>
              <IconPlus /> New Article
            </button>
          )}
        </div>
      </header>

      {showNew && (
        <form className="card knowledge-form" onSubmit={handleCreate}>
          <div className="field-row">
            <label className="field">
              <span>Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="How NDAs work…"
                autoComplete="off"
                required
              />
            </label>
            <label className="field">
              <span>Category</span>
              <input
                type="text"
                list="knowledge-categories"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Glossary…"
                autoComplete="off"
                required
              />
              <datalist id="knowledge-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          </div>
          <label className="field">
            <span>Content (Markdown)</span>
            <textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} required />
          </label>
          <div className="matter-actions">
            <button type="button" className="btn-ghost" onClick={() => setShowNew(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-solid" disabled={creating}>
              {creating ? 'Creating…' : 'Create Article'}
            </button>
          </div>
          {createError && <p className="matter-error" aria-live="polite">{createError}</p>}
        </form>
      )}

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading knowledge base…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for knowledge articles.</p>
          <button type="button" className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      {actionError && <p className="matter-error" aria-live="polite">{actionError}</p>}

      {status === 'ready' && (
        <section className="knowledge-list">
          {articles.map((a) =>
            editingId === a.id ? (
              <form key={a.id} onSubmit={handleSaveEdit} className="card knowledge-form knowledge-edit-form">
                <div className="field-row">
                  <label className="field">
                    <span>Title</span>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      required
                      autoComplete="off"
                    />
                  </label>
                  <label className="field">
                    <span>Category</span>
                    <input
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      list="knowledge-categories"
                      required
                      autoComplete="off"
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Content (Markdown)</span>
                  <textarea rows={8} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                </label>
                {editError && <p className="matter-error" aria-live="polite">{editError}</p>}
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
              <div key={a.id} className="card knowledge-card">
                <div className="knowledge-card-top">
                  <span className="knowledge-card-title-block">
                    <span className="template-name">{a.title}</span>
                    <span className="template-category">{a.category}</span>
                  </span>
                  <div className="template-card-actions">
                    <span className={`status-badge${a.is_published ? ' published' : ''}`}>
                      {a.is_published ? 'Published' : 'Draft'}
                    </span>
                    {canWrite && (
                      <>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => startEdit(a)}
                          aria-label={`Edit ${a.title}`}
                        >
                          <IconEdit />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => handleDelete(a)}
                          disabled={deletingId === a.id}
                          aria-label={`Delete ${a.title}`}
                        >
                          <IconTrash />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="knowledge-markdown">
                  {previewId === a.id ? (
                    <ReactMarkdown>{a.content}</ReactMarkdown>
                  ) : (
                    <p className="template-description knowledge-excerpt">{a.content}</p>
                  )}
                </div>

                <div className="knowledge-card-footer">
                  <button type="button" className="btn-ghost template-use-btn" onClick={() => setPreviewId(previewId === a.id ? null : a.id)}>
                    {previewId === a.id ? 'Show Excerpt' : 'Preview'}
                  </button>
                  {canWrite && (
                    <button type="button" className="btn-ghost template-use-btn" onClick={() => handleTogglePublish(a)}>
                      {a.is_published ? 'Unpublish' : 'Publish'}
                    </button>
                  )}
                </div>
              </div>
            ),
          )}
          {articles.length === 0 && <p className="muted">No knowledge articles yet.</p>}
        </section>
      )}
    </main>
  )
}

export default KnowledgeArticles
