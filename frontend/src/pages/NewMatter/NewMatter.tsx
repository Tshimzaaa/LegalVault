import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import './NewMatter.css'
import { IconCalendar, IconSearch } from '../../components/icons'
import { createMatter, assignStaff } from '../../api/matters'
import { listUsers } from '../../api/auth'
import type { User } from '../../api/auth'

function NewMatter() {
  const navigate = useNavigate()
  const [staff, setStaff] = useState<User[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [openedDate, setOpenedDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [attorneyId, setAttorneyId] = useState('')
  const [caseManagerId, setCaseManagerId] = useState('')
  const [matterType, setMatterType] = useState('')
  const [practiceArea, setPracticeArea] = useState('')
  const [feeType, setFeeType] = useState('hourly')
  const [conflictCheck, setConflictCheck] = useState('')
  const [clientGoal, setClientGoal] = useState('')
  const [caseStrategyNotes, setCaseStrategyNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [assignWarning, setAssignWarning] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    listUsers(token)
      .then(setStaff)
      .catch(() => setStaff([]))
  }, [])

  const isDirty = Boolean(
    title ||
      description ||
      attorneyId ||
      caseManagerId ||
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setAssignWarning(null)
    setTitleError(null)

    const titleMissing = !title.trim()
    if (titleMissing) {
      setTitleError('Enter a matter name.')
      titleRef.current?.focus()
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
            <h3>2. Fee Arrangement</h3>

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
