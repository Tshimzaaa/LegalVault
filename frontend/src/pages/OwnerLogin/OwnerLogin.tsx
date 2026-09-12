import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import '../AuthPage.css'
import Seo from '../../components/Seo'

interface OwnerLoginProps {
  onSubmit: (secret: string) => Promise<void>
}

function OwnerLogin({ onSubmit }: OwnerLoginProps) {
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onSubmit(secret)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <Seo title="Owner Sign-In" description="SaaS owner console sign-in." path="/owner/login" noindex />
      <div className="modal-box">
        <h2>Owner Sign-In</h2>
        <p className="modal-sub">Platform-wide access: enter the owner secret.</p>

        <form onSubmit={handleSubmit}>
          <label className="modal-field">
            <span>Owner secret</span>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="••••••••"
              required
              autoFocus
              autoComplete="current-password"
            />
          </label>

          {error && <p className="modal-error" aria-live="polite">{error}</p>}

          <button type="submit" className="modal-submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Login'}
          </button>
        </form>

        <Link to="/" className="auth-page-link">
          Back to home
        </Link>
      </div>
    </div>
  )
}

export default OwnerLogin
