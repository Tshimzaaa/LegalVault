import { useEffect, useState } from 'react'
import './LearnedFriend.css'
import { IconChevron, IconShield, IconDollar, IconClock, IconUser, IconFolder, IconGavel, IconX } from '../../components/icons'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'
import { listClientFallbackClauses } from '../../api/clientFallbackClauses'
import type { FallbackClause } from '../../api/clientFallbackClauses'

type LoadState = 'loading' | 'error' | 'ready'

const categoryIcons: Record<string, React.ReactNode> = {
  Risk: <IconShield />,
  Commercial: <IconDollar />,
  Term: <IconClock />,
  Privacy: <IconUser />,
  Confidentiality: <IconFolder />,
}

function iconForCategory(category: string) {
  return categoryIcons[category] ?? <IconGavel />
}

interface LearnedFriendProps {
  contact: ClientContact
  onLogout: () => void
}

function LearnedFriend({ contact, onLogout }: LearnedFriendProps) {
  const [clauses, setClauses] = useState<FallbackClause[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [showFilters, setShowFilters] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [approvedOnly, setApprovedOnly] = useState(false)
  const [openClause, setOpenClause] = useState<FallbackClause | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setStatus('error')
      return
    }
    setStatus('loading')
    listClientFallbackClauses(token)
      .then((data) => {
        setClauses(data)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [attempt])

  const categories = [...new Set(clauses.map((c) => c.category))].sort()

  function cycleCategory() {
    if (categoryFilter === null) {
      setCategoryFilter(categories[0] ?? null)
      return
    }
    const nextIndex = categories.indexOf(categoryFilter) + 1
    setCategoryFilter(nextIndex < categories.length ? categories[nextIndex] : null)
  }

  const visibleClauses = clauses.filter(
    (c) => (categoryFilter === null || c.category === categoryFilter) && (!approvedOnly || c.pre_approved),
  )

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>My Learned Friend</h1>
        <div className="topbar-actions">
          <button
            type="button"
            className="chip"
            aria-pressed={showFilters}
            onClick={() => setShowFilters((v) => !v)}
          >
            Filter <IconChevron aria-hidden="true" /> <span className="chip-badge">{visibleClauses.length}</span>
          </button>
          <ProfileMenu user={contact} onLogout={onLogout} />
        </div>
      </header>

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading fallback positions…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state" role="status" aria-live="polite">
          <p>Couldn&rsquo;t reach the backend for fallback positions.</p>
          <button type="button" className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
          {showFilters && (
            <div className="fallback-filter-bar">
              <span className="deadlines-filter-label">Category</span>
              <button
                type="button"
                className={`chip small${categoryFilter !== null ? ' active' : ''}`}
                aria-pressed={categoryFilter !== null}
                onClick={cycleCategory}
              >
                {categoryFilter ?? 'All categories'} <IconChevron aria-hidden="true" />
              </button>
              <span className="deadlines-filter-label">Risk Tolerance</span>
              <button
                type="button"
                className={`chip small${approvedOnly ? ' active' : ''}`}
                aria-pressed={approvedOnly}
                onClick={() => setApprovedOnly((v) => !v)}
              >
                Pre-approved <IconChevron aria-hidden="true" />
              </button>
            </div>
          )}

          <section className="templates-grid learned-friend-grid">
            {visibleClauses.map((c) => (
              <div key={c.id} className="card template-card">
                <span className="template-icon">{iconForCategory(c.category)}</span>
                <span className="template-name">{c.name}</span>
                <span className="template-category">{c.category}</span>
                <p className="template-description">{c.description}</p>
                <button type="button" className="btn-ghost template-use-btn" onClick={() => setOpenClause(c)}>
                  View Fallback Position
                </button>
              </div>
            ))}
            {visibleClauses.length === 0 && (
              <p className="muted">
                {clauses.length === 0 ? 'No fallback positions have been added yet.' : 'No fallback positions match these filters.'}
              </p>
            )}
          </section>
        </>
      )}

      {openClause && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={openClause.name} onClick={() => setOpenClause(null)}>
          <div className="card fallback-clause-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fallback-clause-modal-header">
              <h2>{openClause.name}</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setOpenClause(null)}>
                <IconX />
              </button>
            </div>
            <span className="template-category">{openClause.category}</span>
            <p className="fallback-clause-content">{openClause.content}</p>
          </div>
        </div>
      )}
    </main>
  )
}

export default LearnedFriend
