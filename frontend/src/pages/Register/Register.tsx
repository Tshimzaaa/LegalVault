import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../AuthPage.css'
import { register } from '../../api/auth'
import Seo from '../../components/Seo'

function Register() {
  const navigate = useNavigate()
  const [orgName, setOrganizationName] = useState('')
  const [orgEmail, setOrganizationEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const passwordRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setPasswordError('')

    if (password.length < 8) {
      setPasswordError('Admin password must be at least 8 characters.')
      passwordRef.current?.focus()
      return
    }

    if (!consent) {
      setError('You must confirm you have the authority to create this organization account and agree to the Terms and Privacy Policy.')
      return
    }

    setSubmitting(true)
    try {
      await register({
        organization: { name: orgName, email: orgEmail },
        admin: { first_name: firstName, last_name: lastName, email: adminEmail, password },
      })
      navigate('/login', { state: { staffOnly: true } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register the organization.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <Seo title="Create Your Account" description="Sign up your organization." path="/register" noindex />
      <div className="modal-box wide">
        <h2>Create Your Organization</h2>
        <p className="modal-sub">Set up your organization and admin account to get started.</p>

        <form onSubmit={handleSubmit}>
          <div className="modal-field-row">
            <label className="modal-field">
              <span>Organization name</span>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
                autoComplete="organization"
              />
            </label>
            <label className="modal-field">
              <span>Organization email</span>
              <input
                type="email"
                value={orgEmail}
                onChange={(e) => setOrganizationEmail(e.target.value)}
                required
                autoComplete="email"
                spellCheck={false}
              />
            </label>
          </div>

          <div className="modal-field-row">
            <label className="modal-field">
              <span>Admin first name</span>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
              />
            </label>
            <label className="modal-field">
              <span>Admin last name</span>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="family-name"
              />
            </label>
          </div>

          <label className="modal-field">
            <span>Admin email</span>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              required
              autoComplete="email"
              spellCheck={false}
            />
          </label>

          <label className="modal-field">
            <span>Admin password</span>
            <input
              ref={passwordRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters…"
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

          <label className="modal-field modal-field-checkbox">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
            />
            <span>
              I confirm I have the authority to create this organization account, and agree to the{' '}
              <Link to="/terms" target="_blank" rel="noreferrer">Terms and Conditions</Link> and{' '}
              <Link to="/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</Link>.
            </span>
          </label>

          {error && <p className="modal-error" aria-live="polite">{error}</p>}

          <button type="submit" className="modal-submit" disabled={submitting}>
            {submitting ? 'Creating organization…' : 'Create organization & admin'}
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
