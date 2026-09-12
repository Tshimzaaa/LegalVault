import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import './NewMatter.css'
import { IconPlus, IconCalendar, IconSearch } from '../../components/icons'
import { listClients, createClient, inviteContact } from '../../api/clients'
import type { Client } from '../../api/clients'
import { createMatter, assignStaff } from '../../api/matters'
import { listUsers } from '../../api/auth'
import type { User } from '../../api/auth'

function NewMatter() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [staff, setStaff] = useState<User[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [clientId, setClientId] = useState('')
  const [openedDate, setOpenedDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [attorneyId, setAttorneyId] = useState('')
  const [caseManagerId, setCaseManagerId] = useState('')
  const [contactFirstName, setContactFirstName] = useState('')
  const [contactLastName, setContactLastName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [matterType, setMatterType] = useState('')
  const [practiceArea, setPracticeArea] = useState('')
  const [feeType, setFeeType] = useState('hourly')
  const [conflictCheck, setConflictCheck] = useState('')
  const [clientGoal, setClientGoal] = useState('')
  const [caseStrategyNotes, setCaseStrategyNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [assignWarning, setAssignWarning] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)
  const clientSelectRef = useRef<HTMLSelectElement>(null)

  const [showAddClient, setShowAddClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [addingClient, setAddingClient] = useState(false)
  const [addClientError, setAddClientError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    listClients(token)
      .then(setClients)
      .catch(() => setClients([]))
    listUsers(token)
      .then(setStaff)
      .catch(() => setStaff([]))
  }, [])

  const isDirty = Boolean(
    title ||
      description ||
      clientId ||
      attorneyId ||
      caseManagerId ||
      contactFirstName ||
      contactLastName ||
      contactEmail ||
      matterType ||
      practiceArea ||
      conflictCheck ||
      clientGoal ||
      caseStrategyNotes,
  )

  // Browser back/refresh/tab-close bypass the in-app Cancel confirmation — warn there too
  // so a half-filled matter form isn't silently discarded.
  useEffect(() => {
    if (submitted) return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty) return
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty, submitted])

  async function handleAddClient() {
    setAddClientError(null)
    const token = localStorage.getItem('access_token')
    if (!token || !newClientName) {
      setAddClientError('Enter a company name.')
      return
    }

    setAddingClient(true)
    try {
      const created = await createClient(token, newClientName)
      setClients((prev) => [...prev, created])
      setClientId(created.id)
      setNewClientName('')
      setShowAddClient(false)
    } catch {
      setAddClientError('Could not create the client.')
    } finally {
      setAddingClient(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setAssignWarning(null)
    setTitleError(null)
    setClientError(null)

    const titleMissing = !title.trim()
    const clientMissing = !clientId
    if (titleMissing) setTitleError('Enter a matter name.')
    if (clientMissing) setClientError('Select a client.')
    if (titleMissing || clientMissing) {
      if (titleMissing) titleRef.current?.focus()
      else clientSelectRef.current?.focus()
      return
    }

    const token = localStorage.getItem('access_token')
    if (!token) {
      setError('You need to be logged in to create a matter.')
      return
    }

    setSubmitting(true)
    try {
      // The backend's matter record has no dedicated columns for matter type, practice
      // area, fee type, conflict check, client goal, or case strategy notes yet, so we
      // fold them into the description to avoid silently discarding what the user typed.
      const extraDetails = [
        matterType && `Matter Type: ${matterType}`,
        practiceArea && `Practice Area: ${practiceArea}`,
        feeType && `Fee Type: ${feeType}`,
        conflictCheck && `Conflict Check: ${conflictCheck}`,
        clientGoal && `Client's Goal: ${clientGoal}`,
        caseStrategyNotes && `Case Strategy Notes: ${caseStrategyNotes}`,
      ].filter(Boolean)
      const fullDescription = [description, ...extraDetails].filter(Boolean).join('\n')

      const matter = await createMatter(token, {
        client_id: clientId,
        title,
        description: fullDescription || null,
        due_date: dueDate || null,
      })

      const assignmentFailures: string[] = []
      if (attorneyId) {
        try {
          await assignStaff(token, matter.id, { user_id: attorneyId, role_on_matter: 'lead_lawyer' })
        } catch {
          assignmentFailures.push('attorney')
        }
      }
      if (caseManagerId) {
        try {
          await assignStaff(token, matter.id, { user_id: caseManagerId, role_on_matter: 'paralegal' })
        } catch {
          assignmentFailures.push('case manager')
        }
      }
      if (contactFirstName && contactLastName && contactEmail) {
        try {
          await inviteContact(token, clientId, {
            first_name: contactFirstName,
            last_name: contactLastName,
            email: contactEmail,
          })
        } catch {
          assignmentFailures.push('client contact invite')
        }
      }
      if (assignmentFailures.length > 0) {
        setAssignWarning(`Matter created, but could not assign: ${assignmentFailures.join(', ')}.`)
      }

      setSubmitted(true)
    } catch {
      setError('Could not create the matter. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="dash-main matter-main">
      <header className="dash-topbar matter-topbar">
        <h1>Open New Matter</h1>
      </header>

      <form className="matter-form" onSubmit={handleSubmit}>
        <div className="matter-col">
          <section className="card form-section">
            <h3>1. Matter Information</h3>

            <label className="field">
              <span>Matter Name</span>
              <input
                ref={titleRef}
                type="text"
                placeholder="Smith v. Acme Corp…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoComplete="off"
                aria-invalid={Boolean(titleError)}
                aria-describedby={titleError ? 'matter-title-error' : undefined}
              />
              {titleError && (
                <span className="matter-error" id="matter-title-error" aria-live="polite">
                  {titleError}
                </span>
              )}
            </label>

            <div className="field-row">
              <label className="field">
                <span>Matter Type</span>
                <select value={matterType} onChange={(e) => setMatterType(e.target.value)}>
                  <option value="" disabled>
                    Select matter type
                  </option>
                  <option value="corporate">Corporate</option>
                  <option value="litigation">Litigation</option>
                  <option value="family">Family Law</option>
                </select>
              </label>
              <label className="field">
                <span>Practice Area</span>
                <select value={practiceArea} onChange={(e) => setPracticeArea(e.target.value)}>
                  <option value="" disabled>
                    Select practice area
                  </option>
                  <option value="employment">Employment Law</option>
                  <option value="ip">Intellectual Property</option>
                  <option value="real-estate">Real Estate</option>
                </select>
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span>Assigned Attorney</span>
                <select value={attorneyId} onChange={(e) => setAttorneyId(e.target.value)}>
                  <option value="">Select attorney</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Case Manager</span>
                <select value={caseManagerId} onChange={(e) => setCaseManagerId(e.target.value)}>
                  <option value="">Select case manager</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span>Opened Date</span>
                <div className="input-with-icon">
                  <input type="date" value={openedDate} onChange={(e) => setOpenedDate(e.target.value)} />
                  <IconCalendar aria-hidden="true" />
                </div>
              </label>
              <label className="field">
                <span>Deadline</span>
                <div className="input-with-icon">
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  <IconCalendar />
                </div>
              </label>
            </div>

            <label className="field">
              <span>Description</span>
              <textarea
                placeholder="Matter Description…"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </section>
        </div>

        <div className="matter-col">
          <section className="card form-section">
            <div className="form-section-header">
              <h3>2. Client Information</h3>
              <button type="button" className="add-client-btn" onClick={() => setShowAddClient((v) => !v)}>
                <IconPlus /> Add New Client
              </button>
            </div>

            {showAddClient && (
              <div className="field-row">
                <label className="field">
                  <span>New client company name</span>
                  <input
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Acme Corporation…"
                    autoComplete="organization"
                  />
                </label>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ alignSelf: 'flex-end', marginBottom: 14 }}
                  disabled={addingClient}
                  onClick={handleAddClient}
                >
                  {addingClient ? 'Adding…' : 'Add'}
                </button>
              </div>
            )}
            {addClientError && <p className="matter-error" aria-live="polite">{addClientError}</p>}

            <label className="field">
              <span>Client</span>
              <select
                ref={clientSelectRef}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                aria-invalid={Boolean(clientError)}
                aria-describedby={clientError ? 'matter-client-error' : undefined}
              >
                <option value="" disabled>
                  Select existing client
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
              {clientError && (
                <span className="matter-error" id="matter-client-error" aria-live="polite">
                  {clientError}
                </span>
              )}
            </label>

            <p className="muted" style={{ fontSize: 12, marginTop: -4 }}>
              Optionally invite a client contact for this matter; leave blank to skip.
            </p>

            <div className="field-row">
              <label className="field">
                <span>Contact First Name</span>
                <input
                  type="text"
                  placeholder="Jane…"
                  autoComplete="given-name"
                  value={contactFirstName}
                  onChange={(e) => setContactFirstName(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Contact Last Name</span>
                <input
                  type="text"
                  placeholder="Doe…"
                  autoComplete="family-name"
                  value={contactLastName}
                  onChange={(e) => setContactLastName(e.target.value)}
                />
              </label>
            </div>

            <label className="field">
              <span>Contact Email</span>
              <input
                type="email"
                placeholder="jane@acmecorp.com…"
                autoComplete="email"
                spellCheck={false}
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </label>
          </section>

          <section className="card form-section">
            <h3>4. Fee Arrangement</h3>

            <label className="field">
              <span>Fee Type</span>
              <select value={feeType} onChange={(e) => setFeeType(e.target.value)}>
                <option value="hourly">Hourly</option>
                <option value="flat">Flat Fee</option>
                <option value="contingency">Contingency</option>
                <option value="retainer">Retainer</option>
              </select>
            </label>
          </section>
        </div>

        <div className="matter-col">
          <section className="card form-section">
            <h3>3. Matter Details &amp; Strategy</h3>

            <label className="field">
              <span>Conflict Check</span>
              <div className="input-with-icon leading">
                <IconSearch />
                <input
                  type="text"
                  placeholder="Search names and entities to run conflict check…"
                  autoComplete="off"
                  value={conflictCheck}
                  onChange={(e) => setConflictCheck(e.target.value)}
                />
              </div>
            </label>

            <label className="field">
              <span>Client&rsquo;s Goal</span>
              <input
                type="text"
                placeholder="Client's Goal…"
                autoComplete="off"
                value={clientGoal}
                onChange={(e) => setClientGoal(e.target.value)}
              />
            </label>

            <label className="field">
              <span>Case Strategy Notes</span>
              <textarea
                placeholder="Reference field for related matters…"
                rows={2}
                value={caseStrategyNotes}
                onChange={(e) => setCaseStrategyNotes(e.target.value)}
              />
            </label>
          </section>
        </div>

        <div className="matter-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              if (isDirty && !window.confirm('Discard this new matter? Your changes will be lost.')) {
                return
              }
              navigate('/staff/matters')
            }}
          >
            Cancel
          </button>
          <button type="submit" className="btn-solid" disabled={submitting}>
            {submitting ? 'Opening…' : 'Open Matter'}
          </button>
        </div>
        {submitted && <p className="matter-success" aria-live="polite">Matter created.</p>}
        {assignWarning && <p className="matter-error" aria-live="polite">{assignWarning}</p>}
        {error && <p className="matter-error" aria-live="polite">{error}</p>}
      </form>
    </main>
  )
}

export default NewMatter
