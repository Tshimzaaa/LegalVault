import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import '../AuthPage.css'
import { acceptStaffInvite } from '../../api/auth'
import Seo from '../../components/Seo'

function AcceptStaffInvite() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tokenFromLink = searchParams.get('token') ?? ''
  const [token, setToken] = useState(tokenFromLink)
  const [editToken, setEditToken] = useState(!tokenFromLink)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const errorRef = useRef<HTMLParagraphElement>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      errorRef.current?.focus()
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      errorRef.current?.focus()
      return
    }

    setSubmitting(true)
    try {
      await acceptStaffInvite(token, password)
      setDone(true)
      setTimeout(() => navigate('/login', { state: { staffOnly: true } }), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept the invite. The link may have expired.')
      errorRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <Seo
        title="Accept Staff Invite"
        description="Set up your staff account."
        path="/accept-staff-invite"
        noindex
      />
      <div className="modal-box">
        <h2>Join Your Firm’s Workspace</h2>
        <p className="modal-sub">
          {done ? 'All set, redirecting you to log in…' : 'Choose a password to activate your staff account.'}
        </p>

        {!done && (
          <form onSubmit={handleSubmit}>
            {editToken ? (
              <label className="modal-field">
                <span>Invite token</span>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
            ) : (
              <p className="modal-sub">
                Invite token detected from your link.{' '}
                <button type="button" className="auth-page-link auth-page-link-inline" onClick={() => setEditToken(true)}>
                  Enter a different one
                </button>
              </p>
            )}

            <label className="modal-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </label>

            <label className="modal-field">
              <span>Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
              />
            </label>

            {error && (
              <p className="modal-error" role="alert" aria-live="polite" tabIndex={-1} ref={errorRef}>
                {error}
              </p>
            )}

            <button type="submit" className="modal-submit" disabled={submitting}>
              {submitting ? 'Activating…' : 'Activate account'}
            </button>
          </form>
        )}

        <Link to="/login" state={{ staffOnly: true }} className="auth-page-link">
          Back to login
        </Link>
      </div>
    </div>
  )
}

export default AcceptStaffInvite
