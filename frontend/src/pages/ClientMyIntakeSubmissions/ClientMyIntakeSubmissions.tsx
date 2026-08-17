import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './ClientMyIntakeSubmissions.css'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'
import { listMyIntakeSubmissions, listPublishedIntakeForms } from '../../api/clientIntake'
import type { IntakeSubmission, SubmissionStatus } from '../../api/intakeSubmissions'
import type { IntakeForm } from '../../api/intakeForms'

type LoadState = 'loading' | 'error' | 'ready'

const statusLabel: Record<SubmissionStatus, string> = {
  submitted: 'Submitted',
  in_review: 'In Review',
  converted: 'Converted',
  declined: 'Declined',
}

const statusColor: Record<SubmissionStatus, string> = {
  submitted: '#eab308',
  in_review: '#3987e5',
  converted: '#22c55e',
  declined: '#ef4444',
}

interface ClientMyIntakeSubmissionsProps {
  contact: ClientContact
  onLogout: () => void
}

function ClientMyIntakeSubmissions({ contact, onLogout }: ClientMyIntakeSubmissionsProps) {
  const navigate = useNavigate()
  const [submissions, setSubmissions] = useState<IntakeSubmission[]>([])
  const [formsById, setFormsById] = useState<Record<string, IntakeForm>>({})
  const [status, setStatus] = useState<LoadState>('loading')

  function load() {
    setStatus('loading')
    const token = localStorage.getItem('access_token')
    if (!token) {
      setStatus('error')
      return
    }
    Promise.all([listMyIntakeSubmissions(token), listPublishedIntakeForms(token).catch(() => [] as IntakeForm[])])
      .then(([submissionList, formList]) => {
        setSubmissions(submissionList)
        setFormsById(Object.fromEntries(formList.map((f) => [f.id, f])))
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }

  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = [...submissions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>My Requests</h1>
        <ProfileMenu user={contact} onLogout={onLogout} />
      </header>

      {status === 'loading' && (
        <div className="dash-state">
          <span className="dash-spinner" />
          <p>Loading your requests…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for your requests.</p>
          <button type="button" className="btn-ghost" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <section className="card intake-submissions-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Form</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.id} className="intake-submission-row" onClick={() => navigate(s.id)}>
                  <td className="muted tabular">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td>{formsById[s.form_id]?.title ?? 'Intake Form'}</td>
                  <td>
                    <span className="status-badge" style={{ color: statusColor[s.status], background: `${statusColor[s.status]}22` }}>
                      {statusLabel[s.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    You haven&rsquo;t submitted any intake forms yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </main>
  )
}

export default ClientMyIntakeSubmissions
