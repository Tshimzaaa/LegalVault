import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import './ClientKnowledgeArticleDetail.css'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'
import { getPublishedArticle } from '../../api/clientKnowledgeArticles'
import type { KnowledgeArticle } from '../../api/knowledgeArticles'

type LoadState = 'loading' | 'error' | 'ready'

interface ClientKnowledgeArticleDetailProps {
  contact: ClientContact
  onLogout: () => void
}

function ClientKnowledgeArticleDetail({ contact, onLogout }: ClientKnowledgeArticleDetailProps) {
  const { articleId } = useParams<{ articleId: string }>()
  const navigate = useNavigate()
  const [article, setArticle] = useState<KnowledgeArticle | null>(null)
  const [status, setStatus] = useState<LoadState>('loading')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    const token = localStorage.getItem('access_token')
    if (!token || !articleId) {
      setStatus('error')
      return
    }
    getPublishedArticle(token, articleId)
      .then((data) => {
        if (cancelled) return
        setArticle(data)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [articleId])

  if (status === 'loading') {
    return (
      <main className="dash-main">
        <div className="dash-state">
          <span className="dash-spinner" />
          <p>Loading article…</p>
        </div>
      </main>
    )
  }

  if (status === 'error' || !article) {
    return (
      <main className="dash-main">
        <div className="dash-state">
          <p>This article isn&rsquo;t available.</p>
          <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <div>
          <button type="button" className="btn-ghost intake-detail-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h1>{article.title}</h1>
        </div>
        <div className="topbar-actions">
          <span className="chip small">{article.category}</span>
          <ProfileMenu user={contact} onLogout={onLogout} />
        </div>
      </header>

      <section className="card client-knowledge-article-card">
        <div className="knowledge-markdown">
          <ReactMarkdown>{article.content}</ReactMarkdown>
        </div>
      </section>
    </main>
  )
}

export default ClientKnowledgeArticleDetail
