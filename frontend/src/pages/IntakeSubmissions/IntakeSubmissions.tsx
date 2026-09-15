import { Fragment, useEffect, useState } from 'react'
import './IntakeSubmissions.css'
import {
  listIntakeSubmissions,
  updateIntakeSubmissionStatus,
  convertIntakeSubmission,
} from '../../api/intakeSubmissions'
import type { IntakeSubmission, SubmissionStatus } from '../../api/intakeSubmissions'
import { listIntakeForms, submitIntakeForm } from '../../api/intakeForms'
import type { IntakeForm } from '../../api/intakeForms'
import { listUsers } from '../../api/auth'
import type { User } from '../../api/auth'

type LoadState = 'loading' | 'error' | 'ready'

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  submitted: 'Submitted',
  in_review: 'In Review',
  resolved: 'Resolved',
  converted: 'Converted',
  declined: 'Declined',
}

function IntakeSubmissions() {
  const [submissions, setSubmissions] = useState<IntakeSubmission[]>([])
  const [forms, setForms] = useState<IntakeForm[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [converting, setConverting] = useState<string | null>(null)

  const [showNewRequest, setShowNewRequest] = useState(false)
  const [newRequestFormId, setNewRequestFormId] = useState<string>('')
  const [newRequestAnswers, setNewRequestAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setStatus('error')
      return
    }
    setStatus('loading')
    Promise.all([listIntakeSubmissions(token), listIntakeForms(token), listUsers(token)])
      .then(([submissionData, formData, userData]) => {
        setSubmissions(submissionData)
        setForms(formData)
        setUsers(userData)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [attempt])

  function refresh() {
    setAttempt((n) => n + 1)
  }

  function formTitle(formId: string) {
    return forms.find((f) => f.id === formId)?.title ?? 'Request'
  }

  function submitterName(userId: string) {
    const user = users.find((u) => u.id === userId)
    return user ? `${user.first_name} ${user.last_name}` : 'Unknown'
  }

  function fieldLabel(formId: string, fieldId: string) {
    const form = forms.find((f) => f.id === formId)
    return form?.fields.find((f) => f.id === fieldId)?.label ?? fieldId
  }

  async function handleStatusChange(submission: IntakeSubmission, newStatus: SubmissionStatus) {
    const token = localStorage.getItem('access_token')
    if (!token) return
    setActionError(null)
    try {
      await updateIntakeSubmissionStatus(token, submission.id, newStatus)
      refresh()
    } catch {
      setActionError('Could not update the status.')
    }
  }

  const publishedForms = forms.filter((f) => f.is_published)
  const selectedForm = publishedForms.find((f) => f.id === newRequestFormId) ?? null

  function openNewRequest() {
    setShowNewRequest(true)
    setSubmitError(null)
    const defaultForm = publishedForms.find((f) => f.is_system) ?? publishedForms[0]
    setNewRequestFormId(defaultForm?.id ?? '')
    setNewRequestAnswers({})
  }

  async function handleSubmitNewRequest() {
    const token = localStorage.getItem('access_token')
    if (!token || !selectedForm) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      await submitIntakeForm(token, selectedForm.id, newRequestAnswers)
      setShowNewRequest(false)
      refresh()
    } catch {
      setSubmitError('Could not submit this request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConvert(submission: IntakeSubmission) {
    const token = localStorage.getItem('access_token')
    if (!token) return
    setActionError(null)
    setConverting(submission.id)
    try {
      await convertIntakeSubmission(token, submission.id)
      refresh()
    } catch {
      setActionError('Could not convert this request into a contract.')
    } finally {
      setConverting(null)
    }
  }

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Requests</h1>
        <div className="topbar-actions">
          <span className="chip">
            Total <span className="chip-badge">{submissions.length}</span>
          </span>
          <button type="button" className="btn-solid" onClick={openNewRequest}>
            + New Request
          </button>
        </div>
      </header>

      {showNewRequest && (
        <div className="card intake-new-request-form">
          <label className="field">
            <span>Form</span>
            <select value={newRequestFormId} onChange={(e) => { setNewRequestFormId(e.target.value); setNewRequestAnswers({}) }}>
              {publishedForms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </label>

          {selectedForm?.fields.map((field) => (
            <label key={field.id} className="field">
              <span>
                {field.label}
                {field.is_required && ' *'}
              </span>
              {field.field_type === 'textarea' ? (
                <textarea
                  rows={3}
                  value={newRequestAnswers[field.id] ?? ''}
                  onChange={(e) => setNewRequestAnswers((a) => ({ ...a, [field.id]: e.target.value }))}
                />
              ) : field.field_type === 'dropdown' ? (
                <select
                  value={newRequestAnswers[field.id] ?? ''}
                  onChange={(e) => setNewRequestAnswers((a) => ({ ...a, [field.id]: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.field_type === 'file' ? (
                <span className="muted">File uploads aren&rsquo;t supported from this quick form yet.</span>
              ) : (
                <input
                  type={field.field_type === 'date' ? 'date' : field.field_type === 'number' ? 'number' : 'text'}
                  value={newRequestAnswers[field.id] ?? ''}
                  onChange={(e) => setNewRequestAnswers((a) => ({ ...a, [field.id]: e.target.value }))}
                  autoComplete="off"
                />
              )}
            </label>
          ))}

          {submitError && <p className="contract-error" aria-live="polite">{submitError}</p>}
          <div className="contract-actions">
            <button type="button" className="btn-ghost" onClick={() => setShowNewRequest(false)}>
              Cancel
            </button>
            <button type="button" className="btn-solid" disabled={submitting || !selectedForm} onClick={handleSubmitNewRequest}>
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </div>
      )}

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading requests…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state" role="status" aria-live="polite">
          <p>Couldn&rsquo;t reach the backend for requests.</p>
          <button type="button" className="btn-ghost" onClick={refresh}>
            Retry
          </button>
        </div>
      )}

      {actionError && <p className="contract-error" aria-live="polite">{actionError}</p>}

      {status === 'ready' && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Form</th>
                <th>Submitted by</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <Fragment key={s.id}>
                  <tr
                    onClick={() => setExpandedId((id) => (id === s.id ? null : s.id))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setExpandedId((id) => (id === s.id ? null : s.id))
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-expanded={expandedId === s.id}
                    className="intake-submission-row"
                  >
                    <td>{formTitle(s.form_id)}</td>
                    <td className="muted">{submitterName(s.submitted_by)}</td>
                    <td>
                      <span className={`status-badge status-${s.status}`}>{STATUS_LABELS[s.status]}</span>
                    </td>
                    <td className="muted tabular">{new Date(s.created_at).toLocaleDateString()}</td>
                    <td>
                      {s.status !== 'converted' && (
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={converting === s.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleConvert(s)
                          }}
                        >
                          {converting === s.id ? 'Converting…' : 'Convert to Contract'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === s.id && (
                    <tr className="intake-submission-detail-row">
                      <td colSpan={5}>
                        <div className="intake-submission-answers">
                          {s.answers.map((a) => (
                            <div key={a.id} className="intake-submission-answer">
                              <span className="muted">{fieldLabel(s.form_id, a.field_id)}</span>
                              <span>{a.value || a.original_filename || '—'}</span>
                            </div>
                          ))}
                          {s.answers.length === 0 && <p className="muted">No answers.</p>}
                          <div className="intake-submission-status-actions">
                            {(['submitted', 'in_review', 'resolved', 'declined'] as SubmissionStatus[]).map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                className={`chip small${s.status === opt ? ' active' : ''}`}
                                onClick={() => handleStatusChange(s, opt)}
                              >
                                {STATUS_LABELS[opt]}
                              </button>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {submissions.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

export default IntakeSubmissions
