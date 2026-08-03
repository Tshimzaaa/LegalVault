import { useState } from 'react'
import type { FormEvent } from 'react'
import './LoginModal.css'
import { forgotPassword } from '../api/auth'
import { clientForgotPassword } from '../api/clientAuth'

interface LoginModalProps {
  onClose: () => void
  onSubmit: (email: string, password: string) => Promise<void>
  staffOnly?: boolean
}

function LoginModal({ onClose, onSubmit, staffOnly }: LoginModalProps) {
  const [mode, setMode] = useState<'login' | 'forgot' | 'sent'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [waking, setWaking] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    // The API host can be a free-tier instance that sleeps when idle, so a
    // cold start takes much longer than a normal login request.
    const wakeTimer = setTimeout(() => setWaking(true), 4000)
    try {
      await onSubmit(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      clearTimeout(wakeTimer)
      setSubmitting(false)
      setWaking(false)
    }
  }

  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await (staffOnly ? forgotPassword(email) : clientForgotPassword(email))
      setMode('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (mode === 'forgot' || mode === 'sent') {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>

          <h2>Reset password</h2>
          <p className="modal-sub">
            {mode === 'sent'
              ? 'If that email exists, a reset link is on its way.'
              : "Enter your email and we'll send you a reset link."}
          </p>

          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit}>
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

              {error && <p className="modal-error">{error}</p>}

              <button type="submit" className="modal-submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}

          <button type="button" className="modal-link-back" onClick={() => setMode('login')}>
            &larr; Back to login
          </button>
        </div>
      </div>
    )
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
            <div className="modal-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="modal-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          {error && <p className="modal-error">{error}</p>}

          <button type="submit" className="modal-submit" disabled={submitting}>
            {submitting && <span className="modal-spinner" aria-hidden="true" />}
            {waking ? 'Waking up server…' : submitting ? 'Logging in…' : 'Login'}
          </button>

          {waking && (
            <p className="modal-hint">
              The server was asleep and is starting up — this can take up to a minute.
            </p>
          )}

          <button
            type="button"
            className="modal-link-back"
            onClick={() => {
              setError('')
              setMode('forgot')
            }}
          >
            Forgot password?
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginModal
