import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import './Contact.css'

function Contact() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [firm, setFirm] = useState('')
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
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
            <form onSubmit={handleSubmit}>
              <div className="contact-field-row">
                <label className="contact-field">
                  <span>Name</span>
                  <input
                    type="text"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe…"
                    required
                    autoComplete="name"
                  />
                </label>
                <label className="contact-field">
                  <span>Work email</span>
                  <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@firm.com…"
                    required
                    autoComplete="email"
                    spellCheck={false}
                  />
                </label>
              </div>

              <label className="contact-field">
                <span>Firm name</span>
                <input
                  type="text"
                  name="organization"
                  value={firm}
                  onChange={(e) => setFirm(e.target.value)}
                  placeholder="Doe & Associates…"
                  autoComplete="organization"
                />
              </label>

              <label className="contact-field">
                <span>Message</span>
                <textarea
                  name="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us a bit about your firm and what you’re looking for…"
                  rows={5}
                  required
                />
              </label>

              <label className="contact-field contact-field-checkbox">
                <input
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

              <button type="submit" className="btn btn-primary contact-submit">
                Send Message
              </button>
            </form>
          )}
        </div>

        <div className="contact-info">
          <div className="contact-card">
            <span className="contact-info-label">Email</span>
            <span className="contact-info-value">hello@legalvault.example.com</span>
          </div>
          <div className="contact-card">
            <span className="contact-info-label">Phone</span>
            <span className="contact-info-value">+27 11 555 0134</span>
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
            <span className="contact-info-value">Mon – Fri, 08:00 – 17:00 SAST</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Contact
