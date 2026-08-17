import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [search, setSearch] = useState('')

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
  }, [])

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
            type="text"
            className="select-input knowledge-search"
            placeholder="Search articles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="select-input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
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
        <div className="dash-state">
          <span className="dash-spinner" />
          <p>Loading knowledge base…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for the knowledge base.</p>
        </div>
      )}

      {status === 'ready' && (
        <section className="knowledge-list">
          {visible.map((a) => (
            <div key={a.id} className="card knowledge-card">
              <span className="template-name">{a.title}</span>
              <span className="template-category">{a.category}</span>
              <p className="template-description knowledge-excerpt">{a.content}</p>
              <button type="button" className="btn-ghost template-use-btn" onClick={() => navigate(a.id)}>
                Read Article
              </button>
            </div>
          ))}
          {visible.length === 0 && <p className="muted">No articles match your search.</p>}
        </section>
      )}
    </main>
  )
}

export default ClientKnowledgeBase
