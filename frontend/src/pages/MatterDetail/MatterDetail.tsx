import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './MatterDetail.css'
import {
  getMatter,
  listAssignments,
  assignStaff,
  updateMatterStatus,
  updateMatterVisibility,
  listMatterDocuments,
  uploadMatterDocument,
  getMatterDocumentDownloadUrl,
} from '../../api/matters'
import type { Matter, MatterAssignment, MatterRole, MatterDocument } from '../../api/matters'
import { listClients } from '../../api/clients'
import type { Client } from '../../api/clients'
import { listUsers } from '../../api/auth'
import type { User } from '../../api/auth'
import { IconDownload } from '../../components/icons'

type LoadState = 'loading' | 'error' | 'ready'

const statusOptions: { value: Matter['status']; label: string }[] = [
  { value: 'intake', label: 'Intake' },
  { value: 'in_review', label: 'In Review' },
  { value: 'awaiting_signature', label: 'Awaiting Signature' },
  { value: 'signed', label: 'Signed' },
  { value: 'closed', label: 'Closed' },
  { value: 'declined', label: 'Declined' },
]

const roleOptions: { value: MatterRole; label: string }[] = [
  { value: 'lead_lawyer', label: 'Lead Lawyer' },
  { value: 'paralegal', label: 'Paralegal' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'reviewer', label: 'Reviewer' },
]

const statusColor: Record<Matter['status'], string> = {
  intake: '#eab308',
  in_review: '#3987e5',
  awaiting_signature: '#a855f7',
  signed: '#199e70',
  closed: '#22c55e',
  declined: '#ef4444',
}

function MatterDetail() {
  const { matterId } = useParams<{ matterId: string }>()
  const navigate = useNavigate()

  const [matter, setMatter] = useState<Matter | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [assignments, setAssignments] = useState<MatterAssignment[]>([])
  const [status, setStatus] = useState<LoadState>('loading')

  const [statusValue, setStatusValue] = useState<Matter['status']>('intake')
  const [statusSaving, setStatusSaving] = useState(false)
  const [visibilitySaving, setVisibilitySaving] = useState(false)

  const [assignUserId, setAssignUserId] = useState('')
  const [assignRole, setAssignRole] = useState<MatterRole>('lead_lawyer')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  const [documents, setDocuments] = useState<MatterDocument[]>([])
  const [docTitle, setDocTitle] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const token = localStorage.getItem('access_token')

  function loadAll() {
    if (!token || !matterId) {
      setStatus('error')
      return
    }
    setStatus('loading')
    Promise.all([
      getMatter(token, matterId),
      listAssignments(token, matterId),
      listClients(token),
      listUsers(token),
      listMatterDocuments(token, matterId),
    ])
      .then(([m, a, c, u, docs]) => {
        setMatter(m)
        setStatusValue(m.status)
        setAssignments(a)
        setClients(c)
        setUsers(u)
        setDocuments(docs)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId])

  async function handleStatusSave() {
    if (!token || !matterId) return
    setStatusSaving(true)
    try {
      const updated = await updateMatterStatus(token, matterId, statusValue)
      setMatter(updated)
    } finally {
      setStatusSaving(false)
    }
  }

  async function handleVisibilityToggle(next: boolean) {
    if (!token || !matterId) return
    setVisibilitySaving(true)
    try {
      const updated = await updateMatterVisibility(token, matterId, next)
      setMatter(updated)
    } finally {
      setVisibilitySaving(false)
    }
  }

  async function handleAssign() {
    if (!token || !matterId || !assignUserId) {
      setAssignError('Select a staff member to assign.')
      return
    }
    setAssignError(null)
    setAssigning(true)
    try {
      const created = await assignStaff(token, matterId, { user_id: assignUserId, role_on_matter: assignRole })
      setAssignments((prev) => [...prev, created])
      setAssignUserId('')
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Could not assign staff member.')
    } finally {
      setAssigning(false)
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setDocFile(e.target.files?.[0] ?? null)
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault()
    if (!token || !matterId || !docFile) {
      setUploadError('Choose a file to upload.')
      return
    }
    setUploadError(null)
    setUploading(true)
    try {
      const uploaded = await uploadMatterDocument(token, matterId, docTitle, docFile)
      setDocuments((prev) => [...prev, uploaded])
      setDocTitle('')
      setDocFile(null)
      const fileInput = document.getElementById('matter-doc-file') as HTMLInputElement | null
      if (fileInput) fileInput.value = ''
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not upload the document.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(documentId: string) {
    if (!token || !matterId) return
    setDownloadingId(documentId)
    try {
      const url = await getMatterDocumentDownloadUrl(token, matterId, documentId)
      window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloadingId(null)
    }
  }

  function userName(userId: string) {
    const u = users.find((x) => x.id === userId)
    return u ? `${u.first_name} ${u.last_name}` : 'Unknown staff'
  }

  function clientName(clientId: string) {
    return clients.find((c) => c.id === clientId)?.company_name ?? 'Unknown client'
  }

  // A person can hold more than one role on a matter — only hide them from the picker
  // once they already have the specific role currently selected.
  const userIdsWithSelectedRole = new Set(
    assignments.filter((a) => a.role_on_matter === assignRole).map((a) => a.user_id),
  )
  const assignableUsers = users.filter((u) => !userIdsWithSelectedRole.has(u.id))

  const documentGroups = Object.values(
    documents.reduce<Record<string, MatterDocument[]>>((groups, doc) => {
      ;(groups[doc.title] ??= []).push(doc)
      return groups
    }, {}),
  )
    .map((versions) => versions.slice().sort((a, b) => b.version - a.version))
    .sort((a, b) => b[0].created_at.localeCompare(a[0].created_at))

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <div>
          <button type="button" className="matter-detail-back" onClick={() => navigate('/staff/matters')}>
            &larr; Back to Matters
          </button>
          <h1>{matter?.title ?? 'Matter'}</h1>
        </div>
        {matter && (
          <span
            className="status-badge"
            style={{ color: statusColor[matter.status], background: `${statusColor[matter.status]}22` }}
          >
            {statusOptions.find((o) => o.value === matter.status)?.label}
          </span>
        )}
      </header>

      {status === 'loading' && (
        <div className="dash-state">
          <span className="dash-spinner" />
          <p>Loading matter…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for this matter.</p>
          <button type="button" className="btn-ghost" onClick={loadAll}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && matter && (
        <div className="matter-detail-grid">
          <div>
            <section className="card">
              <div className="card-header">
                <span>Details</span>
              </div>
              <p className="muted">Client: {clientName(matter.client_id)}</p>
              <p className="muted">Opened: {new Date(matter.created_at).toLocaleDateString()}</p>
              <p className="matter-detail-description">{matter.description || 'No description provided.'}</p>
            </section>

            <section className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <span>Status</span>
              </div>
              <div className="matter-detail-field-row">
                <select value={statusValue} onChange={(e) => setStatusValue(e.target.value as Matter['status'])}>
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-solid"
                  disabled={statusSaving || statusValue === matter.status}
                  onClick={handleStatusSave}
                >
                  {statusSaving ? 'Saving…' : 'Save'}
                </button>
              </div>

              <div className="matter-detail-toggle-row">
                <span>Visible to client</span>
                <label className="field" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={matter.is_visible_to_client}
                    disabled={visibilitySaving}
                    onChange={(e) => handleVisibilityToggle(e.target.checked)}
                  />
                </label>
              </div>
            </section>

            <section className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <span>Documents</span>
              </div>

              <div className="list-rows">
                {documentGroups.map((versions) => {
                  const latest = versions[0]
                  return (
                    <div key={latest.title} className="matter-doc-group">
                      <div className="matter-doc-row">
                        <span className="matter-doc-title">{latest.title}</span>
                        <span className="chip small">v{latest.version}</span>
                        <span className="muted matter-doc-meta">{new Date(latest.created_at).toLocaleDateString()}</span>
                        <button
                          type="button"
                          className="icon-btn"
                          disabled={downloadingId === latest.id}
                          onClick={() => handleDownload(latest.id)}
                          aria-label={`Download ${latest.title}`}
                        >
                          <IconDownload />
                        </button>
                      </div>
                      {versions.length > 1 && (
                        <div className="matter-doc-history">
                          {versions.slice(1).map((v) => (
                            <div key={v.id} className="matter-doc-row muted">
                              <span className="matter-doc-title">{v.title}</span>
                              <span className="chip small">v{v.version}</span>
                              <span className="muted matter-doc-meta">{new Date(v.created_at).toLocaleDateString()}</span>
                              <button
                                type="button"
                                className="icon-btn"
                                disabled={downloadingId === v.id}
                                onClick={() => handleDownload(v.id)}
                                aria-label={`Download ${v.title} v${v.version}`}
                              >
                                <IconDownload />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {documentGroups.length === 0 && <p className="muted">No documents uploaded yet.</p>}
              </div>

              <form onSubmit={handleUpload} className="matter-doc-upload-row">
                <input
                  type="text"
                  placeholder="Document title (reuse a title to add a new version)"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  list="matter-doc-titles"
                  required
                />
                <datalist id="matter-doc-titles">
                  {documentGroups.map((versions) => (
                    <option key={versions[0].title} value={versions[0].title} />
                  ))}
                </datalist>
                <input id="matter-doc-file" type="file" onChange={handleFileChange} accept=".pdf,.doc,.docx,.txt" required />
                <button type="submit" className="btn-ghost" disabled={uploading}>
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
              </form>
              {uploadError && <p className="matter-error">{uploadError}</p>}
            </section>
          </div>

          <section className="card">
            <div className="card-header">
              <span>Staff Assigned</span>
            </div>
            <div className="list-rows">
              {assignments.map((a) => (
                <div key={a.id} className="assignment-row">
                  <span>{userName(a.user_id)}</span>
                  <span className="muted">{roleOptions.find((r) => r.value === a.role_on_matter)?.label}</span>
                </div>
              ))}
              {assignments.length === 0 && <p className="muted">No staff assigned yet.</p>}
            </div>

            <div className="assignment-add-row">
              <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
                <option value="">Select staff member</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                  </option>
                ))}
              </select>
              <select
                value={assignRole}
                onChange={(e) => {
                  setAssignRole(e.target.value as MatterRole)
                  setAssignUserId('')
                }}
              >
                {roleOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button type="button" className="btn-ghost" disabled={assigning} onClick={handleAssign}>
                {assigning ? 'Assigning…' : 'Assign'}
              </button>
            </div>
            {assignError && <p className="matter-error">{assignError}</p>}
          </section>
        </div>
      )}
    </main>
  )
}

export default MatterDetail
