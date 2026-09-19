import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import './Contact.css'
import { submitInquiry } from '../../api/inquiries'
import { inquiryErrorMessage, validateInquiry } from '../Register/inquiryForm'
import type { InquiryFieldErrors } from '../Register/inquiryForm'

function Contact() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [organization, setOrganization] = useState('')
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [fieldErrors, setFieldErrors] = useState<InquiryFieldErrors>({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError('')

    const errs = validateInquiry(
      { name, email, phone: '', organization, message },
      { orgRequired: false, messageRequired: true, consent },
    )
    setFieldErrors(errs)
    const first = Object.keys(errs)[0]
    if (first) {
      document.getElementById(`contact-${first}`)?.focus()
      return
    }

    setSubmitting(true)
    try {
      await submitInquiry({
        kind: 'contact',
        name: name.trim(),
        email: email.trim(),
        organization_name: organization.trim() || undefined,
        message: message.trim(),
        consent: true,
        website,
      })
      setSubmitted(true)
    } catch (err) {
      setError(inquiryErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  function fp(key: keyof InquiryFieldErrors) {
    return {
      id: `contact-${key}`,
      'aria-invalid': Boolean(fieldErrors[key]),
      'aria-describedby': fieldErrors[key] ? `contact-${key}-error` : undefined,
    }
  }

  function fe(key: keyof InquiryFieldErrors) {
    return fieldErrors[key] ? (
      <span id={`contact-${key}-error`} className="contact-field-error">
        {fieldErrors[key]}
      </span>
    ) : null
  }

  return (
    <section id="contact" className="contact-page">
      <div className="contact-hero">
        <h2>Get in Touch</h2>
        <p>Questions about pricing, onboarding, or a live demo? We usually reply within one business day.</p>
      </div>

      <div className="contact-grid">
        <div className="contact-card contact-form-card">
          {submitted ? (
            <div className="contact-success" role="status" aria-live="polite">
              <span className="contact-success-icon" aria-hidden="true">✓</span>
              <h2>Message sent</h2>
              <p>Thanks for reaching out, someone from our team will get back to you shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="contact-field-row">
                <label className="contact-field">
                  <span>Name</span>
                  <input
                    {...fp('name')}
                    type="text"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    required
                    autoComplete="name"
                  />
                  {fe('name')}
                </label>
                <label className="contact-field">
                  <span>Work email</span>
                  <input
                    {...fp('email')}
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@company.com"
                    required
                    autoComplete="email"
                    spellCheck={false}
                  />
                  {fe('email')}
                </label>
              </div>

              <label className="contact-field">
                <span>Organization name</span>
                <input
                  {...fp('organization')}
                  type="text"
                  name="organization"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Acme Inc"
                  autoComplete="organization"
                />
                {fe('organization')}
              </label>

              <label className="contact-field">
                <span>Message</span>
                <textarea
                  {...fp('message')}
                  name="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us a bit about your organization and what you’re looking for…"
                  rows={5}
                  required
                />
                {fe('message')}
              </label>

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

              <label className="contact-field contact-field-checkbox">
                <input
                  {...fp('consent')}
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                />
                <span>
                  I agree to the <Link to="/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</Link>{' '}
                  and consent to being contacted about my enquiry.
                </span>
              </label>

              {fe('consent')}

              <div aria-live="polite">
                {error && <p className="contact-error">{error}</p>}
              </div>

              <button type="submit" className="btn btn-primary contact-submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send Message'}
              </button>
            </form>
          )}
        </div>

        <div className="contact-info">
          <div className="contact-card">
            <span className="contact-info-label">Email</span>
            <span className="contact-info-value">
              <a href="mailto:hello@legalvault.example.com">hello@legalvault.example.com</a>
            </span>
          </div>
          <div className="contact-card">
            <span className="contact-info-label">Phone</span>
            <span className="contact-info-value">
              <a href="tel:+27115550134">+27 11 555 0134</a>
            </span>
          </div>
          <div className="contact-card">
            <span className="contact-info-label">Office</span>
            <span className="contact-info-value">
              12 Fredman Drive, Sandton
              <br />
              Johannesburg, 2196
            </span>
          </div>
          <div className="contact-card">
            <span className="contact-info-label">Hours</span>
            <span className="contact-info-value">Mon&nbsp;–&nbsp;Fri, 08:00&nbsp;–&nbsp;17:00 SAST</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Contact
