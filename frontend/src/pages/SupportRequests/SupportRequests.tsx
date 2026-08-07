import { useEffect, useState } from 'react'
import './SupportRequests.css'
import { listSupportRequestsForFirm, updateSupportRequestStatus } from '../../api/supportRequests'
import type { SupportRequest, SupportRequestStatus } from '../../api/supportRequests'
import { listClients, listContacts } from '../../api/clients'
import type { Client, Contact } from '../../api/clients'

type LoadState = 'loading' | 'error' | 'ready'

const statusLabel: Record<SupportRequestStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
}

const statusColor: Record<SupportRequestStatus, string> = {
  open: '#eab308',
  in_progress: '#3987e5',
  resolved: '#22c55e',
}

const priorityColor: Record<SupportRequest['priority'], string> = {
  high: '#ef4444',
  medium: '#eab308',
  low: '#22c55e',
}

const typeLabel: Record<SupportRequest['request_type'], string> = {
  nda: 'NDA Review',
  consultancy: 'Consultancy Agreement',
  supplier: 'Supplier Agreement',
  general: 'General Inquiry',
}

function SupportRequests() {
  const [requests, setRequests] = useState<SupportRequest[]>([])
  const [clientsById, setClientsById] = useState<Record<string, Client>>({})
  const [contactsById, setContactsById] = useState<Record<string, Contact>>({})
  const [status, setStatus] = useState<LoadState>('loading')
  const [statusFilter, setStatusFilter] = useState<SupportRequestStatus | 'all'>('all')
  const [savingId, setSavingId] = useState<string | null>(null)

  const token = localStorage.getItem('access_token')

  function loadAll() {
    if (!token) {
      setStatus('error')
      return
    }
    setStatus('loading')

    Promise.all([listSupportRequestsForFirm(token), listClients(token)])
      .then(async ([requestList, clientList]) => {
        setRequests(requestList)
        setClientsById(Object.fromEntries(clientList.map((c) => [c.id, c])))

        // Contacts only come back scoped per-client, so resolve names for just the
        // clients that actually have a request — not every client in the firm.
        const distinctClientIds = [...new Set(requestList.map((r) => r.client_id))]
        const contactLists = await Promise.all(
          distinctClientIds.map((clientId) => listContacts(token, clientId).catch(() => [] as Contact[])),
        )
        const contacts = contactLists.flat()
        setContactsById(Object.fromEntries(contacts.map((c) => [c.id, c])))
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }

  useEffect(loadAll, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleStatusChange(request: SupportRequest, newStatus: SupportRequestStatus) {
    if (!token) return
    setSavingId(request.id)
    try {
      const updated = await updateSupportRequestStatus(token, request.id, newStatus)
      setRequests((prev) => prev.map((r) => (r.id === request.id ? updated : r)))
    } finally {
      setSavingId(null)
    }
  }

  const visibleRequests = requests
    .filter((r) => statusFilter === 'all' || r.status === statusFilter)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const openCount = requests.filter((r) => r.status === 'open').length

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Support Requests</h1>
        <div className="topbar-actions">
          <span className="chip">
            Open <span className="chip-badge">{openCount}</span>
          </span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as SupportRequestStatus | 'all')}>
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </header>

      {status === 'loading' && (
        <div className="dash-state">
          <span className="dash-spinner" />
          <p>Loading support requests…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for support requests.</p>
          <button type="button" className="btn-ghost" onClick={loadAll}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <section className="card support-requests-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Client</th>
                <th>Contact</th>
                <th>Type</th>
                <th>Priority</th>
                <th>Needed By</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.map((r) => {
                const client = clientsById[r.client_id]
                const contact = contactsById[r.contact_id]
                return (
                  <tr key={r.id}>
                    <td className="muted tabular">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td>{client?.company_name ?? '—'}</td>
                    <td className="muted">{contact ? `${contact.first_name} ${contact.last_name}` : '—'}</td>
                    <td className="muted">{typeLabel[r.request_type]}</td>
                    <td>
                      <span
                        className="status-badge"
                        style={{ color: priorityColor[r.priority], background: `${priorityColor[r.priority]}22` }}
                      >
                        {r.priority}
                      </span>
                    </td>
                    <td className="muted tabular">{r.needed_by ? new Date(r.needed_by).toLocaleDateString() : '—'}</td>
                    <td className="muted support-requests-description" title={r.description}>
                      {r.description}
                    </td>
                    <td>
                      <select
                        value={r.status}
                        disabled={savingId === r.id}
                        onChange={(e) => handleStatusChange(r, e.target.value as SupportRequestStatus)}
                        style={{ color: statusColor[r.status] }}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
              {visibleRequests.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted">
                    {statusFilter === 'all' ? 'No support requests yet.' : `No ${statusLabel[statusFilter].toLowerCase()} requests.`}
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

export default SupportRequests
