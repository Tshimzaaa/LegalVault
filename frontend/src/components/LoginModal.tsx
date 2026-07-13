import { useState } from 'react'
import type { FormEvent } from 'react'
import './LoginModal.css'

interface LoginModalProps {
  onClose: () => void
  onSubmit: (email: string, password: string) => Promise<void>
}

function LoginModal({ onClose, onSubmit }: LoginModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onSubmit(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <h2>Log in</h2>
        <p className="modal-sub">Welcome back, enter your details below</p>

        <form onSubmit={handleSubmit}>
          <label className="modal-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </label>

          <label className="modal-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          {error && <p className="modal-error">{error}</p>}

          <button type="submit" className="modal-submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginModal
