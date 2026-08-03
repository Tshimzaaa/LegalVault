import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../AuthPage.css'
import { register } from '../../api/auth'

function Register() {
  const navigate = useNavigate()
  const [adminSecret, setAdminSecret] = useState('')
  const [firmName, setFirmName] = useState('')
  const [firmEmail, setFirmEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Admin password must be at least 8 characters.')
      return
    }

    setSubmitting(true)
    try {
      await register({
        admin_secret: adminSecret,
        law_firm: { name: firmName, email: firmEmail },
        admin: { first_name: firstName, last_name: lastName, email: adminEmail, password },
      })
      navigate('/login', { state: { staffOnly: true } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register the firm.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="modal-box wide">
        <h2>Onboard a law firm</h2>
        <p className="modal-sub">SaaS-owner only — requires the shared onboarding secret.</p>

        <form onSubmit={handleSubmit}>
          <label className="modal-field">
            <span>Onboarding secret</span>
            <input type="password" value={adminSecret} onChange={(e) => setAdminSecret(e.target.value)} required />
          </label>

          <div className="modal-field-row">
            <label className="modal-field">
              <span>Firm name</span>
              <input type="text" value={firmName} onChange={(e) => setFirmName(e.target.value)} required />
            </label>
            <label className="modal-field">
              <span>Firm email</span>
              <input type="email" value={firmEmail} onChange={(e) => setFirmEmail(e.target.value)} required />
            </label>
          </div>

          <div className="modal-field-row">
            <label className="modal-field">
              <span>Admin first name</span>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </label>
            <label className="modal-field">
              <span>Admin last name</span>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </label>
          </div>

          <label className="modal-field">
            <span>Admin email</span>
            <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
          </label>

          <label className="modal-field">
            <span>Admin password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />
          </label>

          {error && <p className="modal-error">{error}</p>}

          <button type="submit" className="modal-submit" disabled={submitting}>
            {submitting ? 'Creating firm…' : 'Create firm & admin'}
          </button>
        </form>

        <Link to="/login" className="auth-page-link">
          Back to login
        </Link>
      </div>
    </div>
  )
}

export default Register
