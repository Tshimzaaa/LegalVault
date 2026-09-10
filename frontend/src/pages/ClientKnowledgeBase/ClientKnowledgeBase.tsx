import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import '../KnowledgeArticles/KnowledgeArticles.css'
import './ClientKnowledgeBase.css'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'
import { listPublishedArticles } from '../../api/clientKnowledgeArticles'
import type { KnowledgeArticle } from '../../api/knowledgeArticles'

type LoadState = 'loading' | 'error' | 'ready'

interface ClientKnowledgeBaseProps {
  contact: ClientContact
  onLogout: () => void
}

function ClientKnowledgeBase({ contact, onLogout }: ClientKnowledgeBaseProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)

  const categoryFilter = searchParams.get('category') ?? 'all'
  const search = searchParams.get('q') ?? ''

  function setCategoryFilter(next: string) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next === 'all') {
          params.delete('category')
        } else {
          params.set('category', next)
        }
        return params
      },
      { replace: true },
    )
  }

  function setSearch(next: string) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next) {
          params.set('q', next)
        } else {
          params.delete('q')
        }
        return params
      },
      { replace: true },
    )
  }

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    const token = localStorage.getItem('access_token')
    if (!token) {
      setStatus('error')
      return
    }
    listPublishedArticles(token)
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
  }, [attempt])

  const categories = [...new Set(articles.map((a) => a.category))].sort()
  const query = search.trim().toLowerCase()
  const visible = articles.filter((a) => {
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false
    if (!query) return true
    return a.title.toLowerCase().includes(query) || a.content.toLowerCase().includes(query)
  })

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Knowledge Base</h1>
        <div className="topbar-actions">
          <input
            type="search"
            className="select-input knowledge-search"
            aria-label="Search articles"
            placeholder="Search articles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
          <select
            className="select-input"
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <ProfileMenu user={contact} onLogout={onLogout} />
        </div>
      </header>

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading knowledge base…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state" role="status" aria-live="polite">
          <p>Couldn&rsquo;t reach the backend for the knowledge base.</p>
          <button type="button" className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <section className="knowledge-list">
          {visible.map((a) => (
            <div key={a.id} className="card knowledge-card">
              <span className="template-name">{a.title}</span>
              <span className="template-category">{a.category}</span>
              <p className="template-description knowledge-excerpt">{a.content}</p>
              <Link to={a.id} className="btn-ghost template-use-btn">
                Read Article
              </Link>
            </div>
          ))}
          {visible.length === 0 && <p className="muted">No articles match your search.</p>}
        </section>
      )}
    </main>
  )
}

export default ClientKnowledgeBase
