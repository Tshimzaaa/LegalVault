import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import './Search.css'
import { IconSearch } from '../../components/icons'
import { search } from '../../api/search'
import type { SearchResponse, SearchResultItem } from '../../api/search'

type SearchState = 'idle' | 'loading' | 'error' | 'ready'

const categories: { key: keyof SearchResponse; label: string }[] = [
  { key: 'matters', label: 'Matters' },
  { key: 'clients', label: 'Clients' },
  { key: 'contacts', label: 'Client Contacts' },
  { key: 'staff', label: 'Staff' },
  { key: 'documents', label: 'Documents' },
]

function Search() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>('idle')
  const [results, setResults] = useState<SearchResponse | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const token = localStorage.getItem('access_token')
    if (!token || !query.trim()) return

    setState('loading')
    try {
      const data = await search(token, query.trim())
      setResults(data)
      setState('ready')
    } catch {
      setState('error')
    }
  }

  function handleResultClick(categoryKey: keyof SearchResponse, item: SearchResultItem) {
    if (categoryKey === 'matters') {
      navigate(`/staff/matters/${item.id}`)
    }
  }

  const totalResults = results
    ? categories.reduce((sum, c) => sum + results[c.key].length, 0)
    : 0

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Search</h1>
      </header>

      <form onSubmit={handleSubmit} className="search-bar-row">
        <div className="input-with-icon leading search-input-wrap">
          <IconSearch />
          <input
            type="text"
            placeholder="Search clients, contacts, matters, staff, documents…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <button type="submit" className="btn-solid" disabled={!query.trim() || state === 'loading'}>
          {state === 'loading' ? 'Searching…' : 'Search'}
        </button>
      </form>

      {state === 'idle' && <div className="dash-state"><p>Search across your firm&rsquo;s data.</p></div>}

      {state === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for search.</p>
        </div>
      )}

      {state === 'ready' && results && (
        <>
          <p className="muted search-summary">
            {totalResults} result{totalResults === 1 ? '' : 's'} for &ldquo;{query}&rdquo;
          </p>
          <div className="search-results">
            {categories.map(({ key, label }) => {
              const items = results[key]
              if (items.length === 0) return null
              return (
                <section key={key} className="card">
                  <div className="card-header">
                    <span>{label}</span>
                    <span className="chip-badge">{items.length}</span>
                  </div>
                  <div className="list-rows">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`search-result-row${key === 'matters' ? ' clickable' : ''}`}
                        onClick={() => handleResultClick(key, item)}
                        disabled={key !== 'matters'}
                      >
                        <span className="search-result-title">{item.title}</span>
                        {item.subtitle && <span className="muted search-result-subtitle">{item.subtitle}</span>}
                      </button>
                    ))}
                  </div>
                </section>
              )
            })}
            {totalResults === 0 && (
              <div className="dash-state">
                <p>No matches found.</p>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  )
}

export default Search
