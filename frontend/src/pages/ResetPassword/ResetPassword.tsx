import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import '../AuthPage.css'
import { resetPassword } from '../../api/auth'
import { clientResetPassword } from '../../api/clientAuth'

function ResetPassword() {
  const [searchParams] = useSearchParams()
  const tokenFromLink = searchParams.get('token') ?? ''
  const [token, setToken] = useState(tokenFromLink)
  const [editToken, setEditToken] = useState(!tokenFromLink)
  const [accountType, setAccountType] = useState<'staff' | 'client'>('staff')
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
      <div className="modal-box">
        <h2>Reset password</h2>
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
                <input type="text" value={token} onChange={(e) => setToken(e.target.value)} required />
              </label>
            ) : (
              <p className="modal-sub">
                Reset token detected from your link.{' '}
                <button type="button" className="auth-page-link auth-page-link-inline" onClick={() => setEditToken(true)}>
                  Enter a different one
                </button>
              </p>
            )}

            <label className="modal-field">
              <span>New password</span>
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
