import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './ClientIntakeSubmissionDetail.css'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'
import { getMyIntakeSubmission, getPublishedIntakeForm } from '../../api/clientIntake'
import type { IntakeSubmission, SubmissionStatus } from '../../api/intakeSubmissions'
import type { IntakeForm } from '../../api/intakeForms'

type LoadState = 'loading' | 'error' | 'ready'

const statusLabel: Record<SubmissionStatus, string> = {
  submitted: 'Submitted',
  in_review: 'In Review',
  resolved: 'Resolved',
  converted: 'Converted',
  declined: 'Declined',
}

const statusColor: Record<SubmissionStatus, string> = {
  submitted: '#eab308',
  in_review: '#3987e5',
  resolved: '#199e70',
  converted: '#22c55e',
  declined: '#ef4444',
}

interface ClientIntakeSubmissionDetailProps {
  contact: ClientContact
  onLogout: () => void
}

function ClientIntakeSubmissionDetail({ contact, onLogout }: ClientIntakeSubmissionDetailProps) {
  const { submissionId } = useParams<{ submissionId: string }>()
  const navigate = useNavigate()
  const [submission, setSubmission] = useState<IntakeSubmission | null>(null)
  const [form, setForm] = useState<IntakeForm | null>(null)
  const [status, setStatus] = useState<LoadState>('loading')

  function load() {
    setStatus('loading')
    const token = localStorage.getItem('access_token')
    if (!token || !submissionId) {
      setStatus('error')
      return
    }
    getMyIntakeSubmission(token, submissionId)
      .then(async (s) => {
        setSubmission(s)
        try {
          setForm(await getPublishedIntakeForm(token, s.form_id))
        } catch {
          setForm(null)
        }
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }

  useEffect(load, [submissionId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading') {
    return (
      <main className="dash-main">
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading request…</p>
        </div>
      </main>
    )
  }

  if (status === 'error' || !submission) {
    return (
      <main className="dash-main">
        <div className="dash-state" role="status" aria-live="polite">
          <p>Couldn&rsquo;t load this request.</p>
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
          <h1>{form?.title ?? 'Request'}</h1>
        </div>
        <div className="topbar-actions">
          <span
            className="status-badge"
            style={{ color: statusColor[submission.status], background: `${statusColor[submission.status]}22` }}
          >
            {statusLabel[submission.status]}
          </span>
          <ProfileMenu user={contact} onLogout={onLogout} />
        </div>
      </header>

      <section className="card intake-answers-card">
        <div className="card-header">Your Responses</div>
        <div className="intake-answers-list">
          {submission.answers.map((answer) => {
            const field = form?.fields.find((f) => f.id === answer.field_id)
            return (
              <div key={answer.id} className="intake-answer-row">
                <span className="intake-answer-label">{field?.label ?? 'Field'}</span>
                {field?.field_type === 'file' ? (
                  <span className="muted">{answer.original_filename ?? 'No file uploaded'}</span>
                ) : field?.field_type === 'checkbox' ? (
                  <span>{answer.value === 'true' ? '✓ Yes' : '✗ No'}</span>
                ) : (
                  <span>{answer.value || 'N/A'}</span>
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

export default ClientIntakeSubmissionDetail
