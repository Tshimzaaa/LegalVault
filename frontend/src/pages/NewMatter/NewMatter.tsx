import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import './NewMatter.css'
import { IconPlus, IconCalendar, IconSearch } from '../../components/icons'
import { listClients, createClient } from '../../api/clients'
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
  const [dueDate, setDueDate] = useState('')
  const [attorneyId, setAttorneyId] = useState('')
  const [caseManagerId, setCaseManagerId] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assignWarning, setAssignWarning] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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

    const token = localStorage.getItem('access_token')
    if (!token || !clientId || !title) {
      setError('Please select a client and enter a matter name.')
      return
    }

    setSubmitting(true)
    try {
      const matter = await createMatter(token, {
        client_id: clientId,
        title,
        description: description || null,
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
              <input type="text" placeholder="Matter Name" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <div className="field-row">
              <label className="field">
                <span>Matter Type</span>
                <select defaultValue="">
                  <option value="" disabled>
                    Employment Law
                  </option>
                  <option value="corporate">Corporate</option>
                  <option value="litigation">Litigation</option>
                  <option value="family">Family Law</option>
                </select>
              </label>
              <label className="field">
                <span>Practice Area</span>
                <select defaultValue="">
                  <option value="" disabled>
                    Corporate
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
                  <input type="text" placeholder="Date Picker" />
                  <IconCalendar />
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
                placeholder="Matter Description"
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
                    placeholder="Company name"
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
            {addClientError && <p className="matter-error">{addClientError}</p>}

            <label className="field">
              <span>Client</span>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="" disabled>
                  Select existing client
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </label>

            <div className="field-row">
              <label className="field">
                <span>First Name</span>
                <input type="text" placeholder="First Name" />
              </label>
              <label className="field">
                <span>Last Name</span>
                <input type="text" placeholder="Last Name" />
              </label>
            </div>

            <div className="field-row">
              <label className="field">
                <span>Company</span>
                <input type="text" placeholder="Company" />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" placeholder="Email" />
              </label>
            </div>

            <label className="field">
              <span>Address</span>
              <input type="text" placeholder="Address" />
            </label>
          </section>

          <section className="card form-section">
            <h3>4. Fee Arrangement</h3>

            <label className="field">
              <span>Fee Type</span>
              <select defaultValue="hourly">
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
                <input type="text" placeholder="Search names and entities to run conflict check" />
              </div>
            </label>

            <label className="field">
              <span>Client&rsquo;s Goal</span>
              <input type="text" placeholder="Client's Goal" />
            </label>

            <label className="field">
              <span>Case Strategy Notes</span>
              <textarea placeholder="Reference field for related matters" rows={2} />
            </label>
          </section>
        </div>

        <div className="matter-actions">
          <button type="button" className="btn-ghost" onClick={() => navigate('/staff/matters')}>
            Cancel
          </button>
          <button type="submit" className="btn-solid" disabled={submitting}>
            {submitting ? 'Opening…' : 'Open Matter'}
          </button>
        </div>
        {submitted && <p className="matter-success">Matter created.</p>}
        {assignWarning && <p className="matter-error">{assignWarning}</p>}
        {error && <p className="matter-error">{error}</p>}
      </form>
    </main>
  )
}

export default NewMatter
