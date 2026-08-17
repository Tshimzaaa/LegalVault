import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './IntakeSubmissions.css'
import { listIntakeSubmissions, updateIntakeSubmissionStatus } from '../../api/intakeSubmissions'
import type { IntakeSubmission, SubmissionStatus } from '../../api/intakeSubmissions'
import { listIntakeForms } from '../../api/intakeForms'
import type { IntakeForm } from '../../api/intakeForms'
import { listClients, listContacts } from '../../api/clients'
import type { Client, Contact } from '../../api/clients'

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

function IntakeSubmissions() {
  const navigate = useNavigate()
  const [submissions, setSubmissions] = useState<IntakeSubmission[]>([])
  const [formsById, setFormsById] = useState<Record<string, IntakeForm>>({})
  const [clientsById, setClientsById] = useState<Record<string, Client>>({})
  const [contactsById, setContactsById] = useState<Record<string, Contact>>({})
  const [status, setStatus] = useState<LoadState>('loading')
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'all'>('all')
  const [savingId, setSavingId] = useState<string | null>(null)

  const token = localStorage.getItem('access_token')

  function loadAll() {
    if (!token) {
      setStatus('error')
      return
    }
    setStatus('loading')

    Promise.all([listIntakeSubmissions(token), listIntakeForms(token), listClients(token)])
      .then(async ([submissionList, formList, clientList]) => {
        setSubmissions(submissionList)
        setFormsById(Object.fromEntries(formList.map((f) => [f.id, f])))
        setClientsById(Object.fromEntries(clientList.map((c) => [c.id, c])))

        const distinctClientIds = [...new Set(submissionList.map((s) => s.client_id))]
        const contactLists = await Promise.all(
          distinctClientIds.map((clientId) => listContacts(token, clientId).catch(() => [] as Contact[])),
        )
        setContactsById(Object.fromEntries(contactLists.flat().map((c) => [c.id, c])))
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }

  useEffect(loadAll, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStatusChange(submission: IntakeSubmission, newStatus: SubmissionStatus) {
    if (!token) return
    setSavingId(submission.id)
    try {
      const updated = await updateIntakeSubmissionStatus(token, submission.id, newStatus)
      setSubmissions((prev) => prev.map((s) => (s.id === submission.id ? updated : s)))
    } finally {
      setSavingId(null)
    }
  }

  const visible = submissions
    .filter((s) => statusFilter === 'all' || s.status === statusFilter)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const newCount = submissions.filter((s) => s.status === 'submitted').length

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Intake Inbox</h1>
        <div className="topbar-actions">
          <span className="chip">
            New <span className="chip-badge">{newCount}</span>
          </span>
          <select
            className="select-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SubmissionStatus | 'all')}
          >
            <option value="all">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="in_review">In Review</option>
            <option value="converted">Converted</option>
            <option value="declined">Declined</option>
          </select>
        </div>
      </header>

      {status === 'loading' && (
        <div className="dash-state">
          <span className="dash-spinner" />
          <p>Loading submissions…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for intake submissions.</p>
          <button type="button" className="btn-ghost" onClick={loadAll}>
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
                <th>Client</th>
                <th>Contact</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => {
                const client = clientsById[s.client_id]
                const contact = contactsById[s.contact_id]
                return (
                  <tr key={s.id} className="intake-submission-row" onClick={() => navigate(s.id)}>
                    <td className="muted tabular">{new Date(s.created_at).toLocaleDateString()}</td>
                    <td>{formsById[s.form_id]?.title ?? '—'}</td>
                    <td>{client?.company_name ?? '—'}</td>
                    <td className="muted">{contact ? `${contact.first_name} ${contact.last_name}` : '—'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        className="select-input"
                        value={s.status}
                        disabled={savingId === s.id}
                        onChange={(e) => handleStatusChange(s, e.target.value as SubmissionStatus)}
                        style={{ color: statusColor[s.status] }}
                      >
                        <option value="submitted">Submitted</option>
                        <option value="in_review">In Review</option>
                        <option value="converted">Converted</option>
                        <option value="declined">Declined</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    {statusFilter === 'all' ? 'No submissions yet.' : `No ${statusLabel[statusFilter].toLowerCase()} submissions.`}
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

export default IntakeSubmissions
