import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import './RequestSupport.css'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'
import { createSupportRequest } from '../../api/supportRequests'
import type { SupportRequestPriority, SupportRequestType } from '../../api/supportRequests'

interface RequestSupportProps {
  contact: ClientContact
  onLogout: () => void
}

function RequestSupport({ contact, onLogout }: RequestSupportProps) {
  const navigate = useNavigate()
  const [requestType, setRequestType] = useState<SupportRequestType | ''>('')
  const [counterparty, setCounterparty] = useState('')
  const [priority, setPriority] = useState<SupportRequestPriority>('medium')
  const [neededBy, setNeededBy] = useState('')
  const [description, setDescription] = useState('')
  const [referenceDocuments, setReferenceDocuments] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const token = localStorage.getItem('access_token')
    if (!token || !requestType || !description) {
      setError('Please select a request type and describe what you need.')
      return
    }

    setSubmitting(true)
    try {
      await createSupportRequest(token, {
        request_type: requestType,
        counterparty: counterparty || null,
        priority,
        needed_by: neededBy || null,
        description,
        reference_documents: referenceDocuments || null,
      })
      setSubmitted(true)
      setRequestType('')
      setCounterparty('')
      setPriority('medium')
      setNeededBy('')
      setDescription('')
      setReferenceDocuments('')
    } catch {
      setError('Could not submit your request. Please try again.')
    } finally {
      setSubmitting(false)
    }
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
            <h2>1. Request Details</h2>

            <label className="field">
              <span>Request Type</span>
              <select value={requestType} onChange={(e) => setRequestType(e.target.value as SupportRequestType)}>
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
              <input
                type="text"
                placeholder="Company or individual name…"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                autoComplete="off"
              />
            </label>

            <label className="field">
              <span>Priority</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value as SupportRequestPriority)}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>

            <label className="field">
              <span>Needed By</span>
              <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
            </label>
          </section>
        </div>

        <div className="matter-col">
          <section className="card form-section">
            <h2>2. Description</h2>

            <label className="field">
              <span>What do you need help with?</span>
              <textarea
                placeholder="Describe your request so legal can review it without back-and-forth email…"
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <label className="field">
              <span>Reference Documents</span>
              <input
                type="url"
                placeholder="Link to any relevant documents…"
                value={referenceDocuments}
                onChange={(e) => setReferenceDocuments(e.target.value)}
                autoComplete="off"
              />
            </label>
          </section>
        </div>

        <div className="matter-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              const isDirty = Boolean(
                requestType || counterparty || neededBy || description || referenceDocuments || priority !== 'medium',
              )
              if (isDirty && !window.confirm('Discard this request? Your changes will be lost.')) return
              navigate('/client/dashboard')
            }}
          >
            Cancel
          </button>
          <button type="submit" className="btn-solid" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
        {submitted && <p className="matter-success" aria-live="polite">Request submitted. Legal will review it shortly.</p>}
        {error && <p className="matter-error" aria-live="polite">{error}</p>}
      </form>
    </main>
  )
}

export default RequestSupport
