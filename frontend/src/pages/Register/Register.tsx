import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import '../AuthPage.css'
import { submitInquiry } from '../../api/inquiries'
import Seo from '../../components/Seo'
import { inquiryErrorMessage, validateInquiry } from './inquiryForm'
import type { InquiryFieldErrors } from './inquiryForm'

const MESSAGE_MAX = 5000

function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [organization, setOrganization] = useState('')
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [fieldErrors, setFieldErrors] = useState<InquiryFieldErrors>({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError('')

    const errs = validateInquiry(
      { name, email, phone, organization, message },
      { orgRequired: true, messageRequired: false, consent },
    )
    setFieldErrors(errs)
    const first = Object.keys(errs)[0]
    if (first) {
      document.getElementById(`access-${first}`)?.focus()
      return
    }

    setSubmitting(true)
    try {
      await submitInquiry({
        kind: 'access_request',
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        organization_name: organization.trim(),
        message: message.trim() || undefined,
        consent: true,
        website,
      })
      setDone(true)
    } catch (err) {
      setError(inquiryErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  function fieldProps(key: keyof InquiryFieldErrors) {
    return {
      id: `access-${key}`,
      'aria-invalid': Boolean(fieldErrors[key]),
      'aria-describedby': fieldErrors[key] ? `access-${key}-error` : undefined,
    }
  }

  function fieldError(key: keyof InquiryFieldErrors) {
    return fieldErrors[key] ? (
      <span id={`access-${key}-error`} className="modal-field-error">
        {fieldErrors[key]}
      </span>
    ) : null
  }

  return (
    <div className="auth-page">
      <Seo title="Request Access" description="Request access to LegalVault for your firm." path="/register" noindex />
      <div className="modal-box wide">
        {done ? (
          <div className="request-success" role="status" aria-live="polite">
            <h2>Request received</h2>
            <p className="modal-sub">
              Thanks, we have your request. We will review it and set up your organization, then reply to you by
              email. We usually reply within one business day.
            </p>
            <Link to="/" className="modal-submit request-home-link">
              Back to home
            </Link>
          </div>
        ) : (
          <>
            <h2>Request access</h2>
            <p className="modal-sub">
              LegalVault organizations are set up by our team. Tell us about your firm and we will be in touch.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="modal-field-row">
                <div className="modal-field">
                  <label htmlFor="access-name">Your name</label>
                  <input
                    {...fieldProps('name')}
                    type="text"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                  {fieldError('name')}
                </div>
                <div className="modal-field">
                  <label htmlFor="access-email">Work email</label>
                  <input
                    {...fieldProps('email')}
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    spellCheck={false}
                    required
                  />
                  {fieldError('email')}
                </div>
              </div>

              <div className="modal-field">
                <label htmlFor="access-phone">Phone (optional)</label>
                <input
                  {...fieldProps('phone')}
                  type="tel"
                  name="phone"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  maxLength={30}
                />
                {fieldError('phone')}
              </div>

              <div className="modal-field">
                <label htmlFor="access-organization">Firm / organization name</label>
                <input
                  {...fieldProps('organization')}
                  type="text"
                  name="organization"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  autoComplete="organization"
                  required
                />
                {fieldError('organization')}
              </div>

              <div className="modal-field">
                <label htmlFor="access-message">Anything we should know (optional)</label>
                <textarea
                  {...fieldProps('message')}
                  name="message"
                  rows={4}
                  maxLength={MESSAGE_MAX}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <span className="request-counter" aria-hidden="true">
                  {message.length}/{MESSAGE_MAX}
                </span>
                {fieldError('message')}
              </div>

              <div className="hp-field" aria-hidden="true">
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              <div className="modal-field modal-field-checkbox">
                <input
                  {...fieldProps('consent')}
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                />
                <span>
                  <label htmlFor="access-consent">I agree to be contacted about my request.</label> See our{' '}
                  <Link to="/terms" target="_blank" rel="noreferrer">Terms and Conditions</Link> and{' '}
                  <Link to="/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</Link>.
                </span>
              </div>
              {fieldError('consent')}

              <div aria-live="polite">
                {error && <p className="modal-error">{error}</p>}
                {submitting && <p className="request-sending">Sending your request…</p>}
              </div>

              <button type="submit" className="modal-submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Request access'}
              </button>
            </form>

            <Link to="/login" className="auth-page-link">
              Already have an account? Log in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

export default Register
