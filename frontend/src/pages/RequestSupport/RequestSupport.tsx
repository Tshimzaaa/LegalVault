import { useState } from 'react'
import type { FormEvent } from 'react'
import './RequestSupport.css'
import { IconCalendar } from '../../components/icons'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'

interface RequestSupportProps {
  contact: ClientContact
  onLogout: () => void
}

function RequestSupport({ contact, onLogout }: RequestSupportProps) {
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <main className="dash-main matter-main">
      <header className="dash-topbar matter-topbar">
        <h1>Request Support</h1>
        <ProfileMenu user={contact} onLogout={onLogout} />
      </header>

      <form className="matter-form request-form" onSubmit={handleSubmit}>
        <div className="matter-col">
          <section className="card form-section">
            <h3>1. Request Details</h3>

            <label className="field">
              <span>Request Type</span>
              <select defaultValue="">
                <option value="" disabled>
                  Select request type
                </option>
                <option value="nda">NDA Review</option>
                <option value="consultancy">Consultancy Agreement</option>
                <option value="supplier">Supplier Agreement</option>
                <option value="general">General Inquiry</option>
              </select>
            </label>

            <label className="field">
              <span>Vendor / Counterparty</span>
              <input type="text" placeholder="Company or individual name" />
            </label>

            <label className="field">
              <span>Priority</span>
              <select defaultValue="medium">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>

            <label className="field">
              <span>Needed By</span>
              <div className="input-with-icon">
                <input type="text" placeholder="Date Picker" />
                <IconCalendar />
              </div>
            </label>
          </section>
        </div>

        <div className="matter-col">
          <section className="card form-section">
            <h3>2. Description</h3>

            <label className="field">
              <span>What do you need help with?</span>
              <textarea placeholder="Describe your request so legal can review it without back-and-forth email" rows={6} />
            </label>

            <label className="field">
              <span>Reference Documents</span>
              <input type="text" placeholder="Link to any relevant documents" />
            </label>
          </section>
        </div>

        <div className="matter-actions">
          <button type="button" className="btn-ghost">
            Cancel
          </button>
          <button type="submit" className="btn-solid">
            Submit Request
          </button>
        </div>
        {submitted && <p className="matter-success">Request submitted. Legal will review it shortly.</p>}
      </form>
    </main>
  )
}

export default RequestSupport
