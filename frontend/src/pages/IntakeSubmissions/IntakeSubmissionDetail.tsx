import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import './IntakeSubmissionDetail.css'
import {
  getIntakeSubmission,
  updateIntakeSubmissionStatus,
  convertIntakeSubmission,
  getIntakeAnswerDownloadUrl,
} from '../../api/intakeSubmissions'
import type { IntakeSubmission, SubmissionStatus } from '../../api/intakeSubmissions'
import { getIntakeForm } from '../../api/intakeForms'
import type { IntakeForm, IntakeField } from '../../api/intakeForms'
import { listClients, listContacts } from '../../api/clients'
import type { Client, Contact } from '../../api/clients'
import { ApiError } from '../../api/client'
import PermissionError from '../../components/PermissionError'
import { IconDownload } from '../../components/icons'
import type { User } from '../../api/auth'

type LoadState = 'loading' | 'error' | 'ready'

const statusColor: Record<SubmissionStatus, string> = {
  submitted: '#eab308',
  in_review: '#3987e5',
  resolved: '#199e70',
  converted: '#22c55e',
  declined: '#ef4444',
}

const canConvert = (role: User['role']) => role === 'admin' || role === 'lawyer' || role === 'paralegal'

interface IntakeSubmissionDetailProps {
  user: User
}

function fieldFor(form: IntakeForm | null, fieldId: string): IntakeField | undefined {
  return form?.fields.find((f) => f.id === fieldId)
}

function IntakeSubmissionDetail({ user }: IntakeSubmissionDetailProps) {
  const { submissionId } = useParams<{ submissionId: string }>()
  const navigate = useNavigate()

  const [submission, setSubmission] = useState<IntakeSubmission | null>(null)
  const [form, setForm] = useState<IntakeForm | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [contact, setContact] = useState<Contact | null>(null)
  const [status, setStatus] = useState<LoadState>('loading')
  const [statusSaving, setStatusSaving] = useState(false)
  const [downloadingAnswerId, setDownloadingAnswerId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [converting, setConverting] = useState(false)
  const [matterTitle, setMatterTitle] = useState('')

  const token = localStorage.getItem('access_token')

  function load() {
    if (!token || !submissionId) {
      setStatus('error')
      return
    }
    setStatus('loading')
    getIntakeSubmission(token, submissionId)
      .then(async (s) => {
        setSubmission(s)
        const [formData, clientList] = await Promise.all([getIntakeForm(token, s.form_id), listClients(token)])
        setForm(formData)
        setClient(clientList.find((c) => c.id === s.client_id) ?? null)
        try {
          const contacts = await listContacts(token, s.client_id)
          setContact(contacts.find((c) => c.id === s.contact_id) ?? null)
        } catch {
          setContact(null)
        }
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }

  useEffect(load, [submissionId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStatusChange(newStatus: SubmissionStatus) {
    if (!token || !submission) return
    setStatusSaving(true)
    setActionError(null)
    try {
      const updated = await updateIntakeSubmissionStatus(token, submission.id, newStatus)
      setSubmission(updated)
    } catch (err) {
      setActionError(err instanceof ApiError && err.status === 403 ? err.message : 'Could not update status.')
    } finally {
      setStatusSaving(false)
    }
  }

  async function handleConvert(e: FormEvent) {
    e.preventDefault()
    if (!token || !submission) return
    setConverting(true)
    setActionError(null)
    try {
      const updated = await convertIntakeSubmission(token, submission.id, matterTitle || undefined)
      setSubmission(updated)
    } catch (err) {
      setActionError(err instanceof ApiError && err.status === 403 ? err.message : 'Could not convert to a matter.')
    } finally {
      setConverting(false)
    }
  }

  async function handleDownload(answerId: string) {
    if (!token || !submission) return
    setDownloadingAnswerId(answerId)
    try {
      const { download_url } = await getIntakeAnswerDownloadUrl(token, submission.id, answerId)
      window.open(download_url, '_blank', 'noopener,noreferrer')
    } catch {
      setActionError('Could not open that file. Please try again.')
    } finally {
      setDownloadingAnswerId(null)
    }
  }

  if (status === 'loading') {
    return (
      <main className="dash-main">
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading submission…</p>
        </div>
      </main>
    )
  }

  if (status === 'error' || !submission) {
    return (
      <main className="dash-main">
        <div className="dash-state">
          <p>Couldn&rsquo;t load this submission.</p>
          <button type="button" className="btn-ghost" onClick={load}>
            Retry
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <div>
          <button type="button" className="btn-ghost intake-detail-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h1>{form?.title ?? 'Submission'}</h1>
        </div>
        <div className="topbar-actions">
          <select
            className="select-input"
            aria-label="Submission status"
            value={submission.status}
            disabled={statusSaving}
            onChange={(e) => handleStatusChange(e.target.value as SubmissionStatus)}
            style={{ color: statusColor[submission.status], background: `${statusColor[submission.status]}22` }}
          >
            <option value="submitted">Submitted</option>
            <option value="in_review">In Review</option>
            <option value="resolved">Resolved</option>
            <option value="converted">Converted</option>
            <option value="declined">Declined</option>
          </select>
        </div>
      </header>

      <section className="card intake-detail-meta">
        <div>
          <span className="muted">Client</span>
          <span>{client?.company_name ?? '—'}</span>
        </div>
        <div>
          <span className="muted">Contact</span>
          <span>{contact ? `${contact.first_name} ${contact.last_name}` : '—'}</span>
        </div>
        <div>
          <span className="muted">Submitted</span>
          <span className="tabular">{new Date(submission.created_at).toLocaleString()}</span>
        </div>
      </section>

      {actionError && <p className="matter-error" aria-live="polite">{actionError}</p>}

      {submission.converted_matter_id ? (
        <p className="intake-converted-note">
          Converted to matter — <Link to={`/staff/matters/${submission.converted_matter_id}`}>view matter</Link>
        </p>
      ) : canConvert(user.role) ? (
        <form className="card intake-convert-form" onSubmit={handleConvert}>
          <label className="field">
            <span>Matter title (optional — defaults to “{client?.company_name ?? 'Client'} – {form?.title ?? 'Intake'}”)</span>
            <input
              value={matterTitle}
              onChange={(e) => setMatterTitle(e.target.value)}
              placeholder="Optional override…"
              autoComplete="off"
            />
          </label>
          <button type="submit" className="btn-solid" disabled={converting}>
            {converting ? 'Converting…' : 'Convert to Matter'}
          </button>
        </form>
      ) : (
        <PermissionError message="Only admins, lawyers, and paralegals can convert a submission to a matter." />
      )}

      <section className="card intake-answers-card">
        <div className="card-header">Responses</div>
        <div className="intake-answers-list">
          {submission.answers.map((answer) => {
            const field = fieldFor(form, answer.field_id)
            return (
              <div key={answer.id} className="intake-answer-row">
                <span className="intake-answer-label">{field?.label ?? 'Unknown field'}</span>
                {field?.field_type === 'file' ? (
                  answer.original_filename ? (
                    <button
                      type="button"
                      className="btn-ghost intake-answer-download"
                      disabled={downloadingAnswerId === answer.id}
                      onClick={() => handleDownload(answer.id)}
                    >
                      <IconDownload /> {answer.original_filename}
                    </button>
                  ) : (
                    <span className="muted">No file uploaded</span>
                  )
                ) : field?.field_type === 'checkbox' ? (
                  <span>{answer.value === 'true' ? '✓ Yes' : '— No'}</span>
                ) : (
                  <span>{answer.value || '—'}</span>
                )}
              </div>
            )
          })}
          {submission.answers.length === 0 && <p className="muted">No answers recorded.</p>}
        </div>
      </section>
    </main>
  )
}

export default IntakeSubmissionDetail
