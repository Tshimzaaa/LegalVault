import { useState } from 'react'
import type { FormEvent } from 'react'
import './Contact.css'

interface ContactProps {
  onOpenLawFirmPortal?: () => void
}

function Contact({ onOpenLawFirmPortal }: ContactProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [firm, setFirm] = useState('')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <section id="contact" className="contact-page">
      <div className="contact-hero">
        <h1>Get in touch</h1>
        <h2>Questions about pricing, onboarding, or a live demo? We usually reply within one business day.</h2>
      </div>

      <div className="contact-grid">
        <div className="contact-card contact-form-card">
          {submitted ? (
            <div className="contact-success">
              <span className="contact-success-icon">✓</span>
              <h3>Message sent</h3>
              <p>Thanks for reaching out — someone from our team will get back to you shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="contact-field-row">
                <label className="contact-field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    required
                  />
                </label>
                <label className="contact-field">
                  <span>Work email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@firm.com"
                    required
                  />
                </label>
              </div>

              <label className="contact-field">
                <span>Firm name</span>
                <input
                  type="text"
                  value={firm}
                  onChange={(e) => setFirm(e.target.value)}
                  placeholder="Doe & Associates"
                />
              </label>

              <label className="contact-field">
                <span>Message</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us a bit about your firm and what you're looking for…"
                  rows={5}
                  required
                />
              </label>

              <button type="submit" className="btn btn-primary contact-submit">
                Send message
              </button>
            </form>
          )}
        </div>

        <div className="contact-info">
          <div className="contact-card">
            <span className="contact-info-label">Email</span>
            <span className="contact-info-value">hello@indexlegal.com</span>
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

      <footer className="contact-footer">
        <span className="contact-footer-text">&copy; {new Date().getFullYear()} Index Legal</span>
        <button type="button" className="contact-footer-link" onClick={onOpenLawFirmPortal}>
          Law Firm Portal
        </button>
      </footer>
    </section>
  )
}

export default Contact
