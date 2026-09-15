import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import './LoginModal.css'
import { forgotPassword } from '../api/auth'
import { isDesktopPointer } from '../utils/device'

interface LoginModalProps {
  onClose: () => void
  onSubmit: (email: string, password: string) => Promise<void>
}

function LoginModal({ onClose, onSubmit }: LoginModalProps) {
  const [mode, setMode] = useState<'login' | 'forgot' | 'sent'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [waking, setWaking] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Focus the first focusable element whenever the modal (re)mounts or switches mode
  // (login/forgot/sent each render different fields), so keyboard users land inside it.
  useEffect(() => {
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    focusable?.[0]?.focus()
  }, [mode])

  function getFocusable(): HTMLElement[] {
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    return focusable ? Array.from(focusable) : []
  }

  function handleModalKeyDown(e: ReactKeyboardEvent) {
    if (e.key !== 'Tab') return
    const elements = getFocusable()
    if (elements.length === 0) return
    const first = elements[0]
    const last = elements[elements.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

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
      setError(err instanceof Error ? err.message : 'Login failed. Check your email and password and try again.')
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
      await forgotPassword(email)
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
        <div
          ref={modalRef}
          className="modal-box"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleModalKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-modal-reset-title"
        >
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>

          <h2 id="login-modal-reset-title">Reset Password</h2>
          <p className="modal-sub">
            {mode === 'sent'
              ? 'If that email exists, a reset link is on its way.'
              : 'Enter your email and we’ll send you a reset link.'}
          </p>

          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit}>
              <label className="modal-field">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus={isDesktopPointer}
                  autoComplete="email"
                  spellCheck={false}
                />
              </label>

              {error && <p className="modal-error" aria-live="polite">{error}</p>}

              <button type="submit" className="modal-submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          )}

          <button type="button" className="modal-link-back" onClick={() => setMode('login')}>
            <span aria-hidden="true">&larr; </span>Back to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleModalKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <h2 id="login-modal-title">Log In</h2>
        <p className="modal-sub">Welcome back, enter your details below</p>

        <form onSubmit={handleSubmit}>
          <label className="modal-field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus={isDesktopPointer}
              autoComplete="email"
              spellCheck={false}
            />
          </label>

          <label className="modal-field">
            <span>Password</span>
            <div className="modal-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="modal-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          {error && <p className="modal-error" aria-live="polite">{error}</p>}

          <button type="submit" className="modal-submit" disabled={submitting}>
            {submitting && <span className="modal-spinner" aria-hidden="true" />}
            {waking ? 'Waking up server…' : submitting ? 'Logging in…' : 'Login'}
          </button>

          {waking && (
            <p className="modal-hint">
              The server was asleep and is starting up; this can take up to a minute.
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
            Forgot Password?
          </button>

          <Link to="/register" className="modal-link-back" onClick={onClose}>
            Don&rsquo;t have an organization yet? Create one
          </Link>
        </form>
      </div>
    </div>
  )
}

export default LoginModal
