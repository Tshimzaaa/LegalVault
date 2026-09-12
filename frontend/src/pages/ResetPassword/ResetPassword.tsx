import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import '../AuthPage.css'
import { resetPassword } from '../../api/auth'
import { clientResetPassword } from '../../api/clientAuth'
import Seo from '../../components/Seo'

function ResetPassword() {
  const [searchParams] = useSearchParams()
  const tokenFromLink = searchParams.get('token') ?? ''
  const [token, setToken] = useState(tokenFromLink)
  const [editToken, setEditToken] = useState(!tokenFromLink)
  const [accountType, setAccountType] = useState<'staff' | 'client'>('staff')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [confirmPasswordError, setConfirmPasswordError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmPasswordRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setPasswordError('')
    setConfirmPasswordError('')

    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      passwordRef.current?.focus()
      return
    }
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.')
      confirmPasswordRef.current?.focus()
      return
    }

    setSubmitting(true)
    try {
      await (accountType === 'staff' ? resetPassword(token, password) : clientResetPassword(token, password))
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password. The link may have expired.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <Seo title="Reset Password" description="Reset your account password." path="/reset-password" noindex />
      <div className="modal-box">
        <h2>Reset Password</h2>
        <p className="modal-sub">
          {done ? 'Your password has been reset.' : 'Enter the reset link token and choose a new password.'}
        </p>

        {!done && (
          <form onSubmit={handleSubmit}>
            <label className="modal-field">
              <span>Account type</span>
              <select value={accountType} onChange={(e) => setAccountType(e.target.value as 'staff' | 'client')}>
                <option value="staff">Firm staff</option>
                <option value="client">Client portal</option>
              </select>
            </label>

            {editToken ? (
              <label className="modal-field">
                <span>Reset token</span>
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
              <p className="modal-sub modal-sub-inline">
                Reset token detected from your link.{' '}
                <button type="button" className="auth-page-link auth-page-link-inline" onClick={() => setEditToken(true)}>
                  Enter a different one
                </button>
              </p>
            )}

            <label className="modal-field">
              <span>New password</span>
              <input
                ref={passwordRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                aria-invalid={Boolean(passwordError)}
              />
              {passwordError && (
                <span className="modal-field-error" aria-live="polite">
                  {passwordError}
                </span>
              )}
            </label>

            <label className="modal-field">
              <span>Confirm password</span>
              <input
                ref={confirmPasswordRef}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                aria-invalid={Boolean(confirmPasswordError)}
              />
              {confirmPasswordError && (
                <span className="modal-field-error" aria-live="polite">
                  {confirmPasswordError}
                </span>
              )}
            </label>

            {error && <p className="modal-error" aria-live="polite">{error}</p>}

            <button type="submit" className="modal-submit" disabled={submitting}>
              {submitting ? 'Resetting…' : 'Reset password'}
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

export default ResetPassword
