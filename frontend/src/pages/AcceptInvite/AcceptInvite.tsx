import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import '../AuthPage.css'
import { acceptInvite } from '../../api/clientAuth'

function AcceptInvite() {
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      await acceptInvite(token, password)
      setDone(true)
      setTimeout(() => navigate('/login'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept the invite. The link may have expired.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="modal-box">
        <h2>Set up your account</h2>
        <p className="modal-sub">
          {done ? 'All set — redirecting you to log in…' : 'Choose a password to activate your client portal login.'}
        </p>

        {!done && (
          <form onSubmit={handleSubmit}>
            {editToken ? (
              <label className="modal-field">
                <span>Invite token</span>
                <input type="text" value={token} onChange={(e) => setToken(e.target.value)} required />
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
              />
            </label>

            {error && <p className="modal-error">{error}</p>}

            <button type="submit" className="modal-submit" disabled={submitting}>
              {submitting ? 'Activating…' : 'Activate account'}
            </button>
          </form>
        )}

        <Link to="/login" className="auth-page-link">
          Back to login
        </Link>
      </div>
    </div>
  )
}

export default AcceptInvite
