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
  updateMatterDeadline,
  listMatterDocuments,
  uploadMatterDocument,
  getMatterDocumentDownloadUrl,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  listMessages,
  createMessage,
  deleteMessage,
} from '../../api/matters'
import type {
  Matter,
  MatterAssignment,
  MatterRole,
  MatterDocument,
  MatterTask,
  TaskStatus,
  MatterMessage,
} from '../../api/matters'
import { listClients } from '../../api/clients'
import type { Client } from '../../api/clients'
import { listUsers } from '../../api/auth'
import type { User } from '../../api/auth'
import { IconDownload, IconTrash, IconSend } from '../../components/icons'

type LoadState = 'loading' | 'error' | 'ready'

const statusOptions: { value: Matter['status']; label: string }[] = [
  { value: 'intake', label: 'Intake' },
  { value: 'in_review', label: 'In Review' },
  { value: 'awaiting_signature', label: 'Awaiting Signature' },
  { value: 'signed', label: 'Signed' },
  { value: 'closed', label: 'Closed' },
  { value: 'declined', label: 'Declined' },
]

const taskStatusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
]

const taskStatusColor: Record<TaskStatus, string> = {
  todo: '#9ca3af',
  in_progress: '#3987e5',
  done: '#22c55e',
}

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

  const [deadlineValue, setDeadlineValue] = useState('')
  const [deadlineSaving, setDeadlineSaving] = useState(false)

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

  const [tasks, setTasks] = useState<MatterTask[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [taskAssignee, setTaskAssignee] = useState('')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [creatingTask, setCreatingTask] = useState(false)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [taskBusyId, setTaskBusyId] = useState<string | null>(null)

  const [messages, setMessages] = useState<MatterMessage[]>([])
  const [messageBody, setMessageBody] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [messageBusyId, setMessageBusyId] = useState<string | null>(null)

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
      listTasks(token, matterId),
      listMessages(token, matterId),
    ])
      .then(([m, a, c, u, docs, t, msgs]) => {
        setMatter(m)
        setStatusValue(m.status)
        setDeadlineValue(m.due_date ?? '')
        setAssignments(a)
        setClients(c)
        setUsers(u)
        setDocuments(docs)
        setTasks(t)
        setMessages(msgs)
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

  async function handleDeadlineSave() {
    if (!token || !matterId) return
    setDeadlineSaving(true)
    try {
      const updated = await updateMatterDeadline(token, matterId, deadlineValue || null)
      setMatter(updated)
    } finally {
      setDeadlineSaving(false)
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

  async function handleCreateTask(e: FormEvent) {
    e.preventDefault()
    if (!token || !matterId || !taskTitle) {
      setTaskError('Enter a task title.')
      return
    }
    setTaskError(null)
    setCreatingTask(true)
    try {
      const created = await createTask(token, matterId, {
        title: taskTitle,
        assigned_to: taskAssignee || null,
        due_date: taskDueDate || null,
      })
      setTasks((prev) => [...prev, created])
      setTaskTitle('')
      setTaskAssignee('')
      setTaskDueDate('')
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : 'Could not create the task.')
    } finally {
      setCreatingTask(false)
    }
  }

  async function handleTaskStatusChange(task: MatterTask, nextStatus: TaskStatus) {
    if (!token || !matterId) return
    setTaskBusyId(task.id)
    try {
      const updated = await updateTask(token, matterId, task.id, { status: nextStatus })
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
    } finally {
      setTaskBusyId(null)
    }
  }

  async function handleDeleteTask(task: MatterTask) {
    if (!token || !matterId) return
    setTaskBusyId(task.id)
    try {
      await deleteTask(token, matterId, task.id)
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
    } finally {
      setTaskBusyId(null)
    }
  }

  async function handleSendMessage(e: FormEvent) {
    e.preventDefault()
    if (!token || !matterId || !messageBody.trim()) return
    setMessageError(null)
    setSendingMessage(true)
    try {
      const created = await createMessage(token, matterId, messageBody.trim())
      setMessages((prev) => [...prev, created])
      setMessageBody('')
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : 'Could not send the message.')
    } finally {
      setSendingMessage(false)
    }
  }

  async function handleDeleteMessage(message: MatterMessage) {
    if (!token || !matterId) return
    setMessageBusyId(message.id)
    try {
      await deleteMessage(token, matterId, message.id)
      setMessages((prev) => prev.filter((m) => m.id !== message.id))
    } finally {
      setMessageBusyId(null)
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

              <p className="muted" style={{ margin: '12px 0 4px' }}>
                Deadline
              </p>
              <div className="matter-detail-field-row">
                <input
                  type="date"
                  value={deadlineValue}
                  onChange={(e) => setDeadlineValue(e.target.value)}
                  aria-label="Matter deadline"
                />
                <button
                  type="button"
                  className="btn-solid"
                  disabled={deadlineSaving || deadlineValue === (matter.due_date ?? '')}
                  onClick={handleDeadlineSave}
                >
                  {deadlineSaving ? 'Saving…' : 'Save deadline'}
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

            <section className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <span>Tasks</span>
              </div>

              <div className="list-rows">
                {tasks.map((t) => (
                  <div key={t.id} className="matter-task-row">
                    <div className="matter-task-main">
                      <span className="matter-task-title">{t.title}</span>
                      <span className="muted matter-task-meta">
                        {t.assigned_to ? userName(t.assigned_to) : 'Unassigned'}
                        {t.due_date ? ` · Due ${new Date(t.due_date).toLocaleDateString()}` : ''}
                      </span>
                    </div>
                    <select
                      value={t.status}
                      disabled={taskBusyId === t.id}
                      onChange={(e) => handleTaskStatusChange(t, e.target.value as TaskStatus)}
                      style={{ color: taskStatusColor[t.status] }}
                    >
                      {taskStatusOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={taskBusyId === t.id}
                      onClick={() => handleDeleteTask(t)}
                      aria-label={`Delete task ${t.title}`}
                    >
                      <IconTrash />
                    </button>
                  </div>
                ))}
                {tasks.length === 0 && <p className="muted">No tasks yet.</p>}
              </div>

              <form onSubmit={handleCreateTask} className="matter-task-add-row">
                <input
                  type="text"
                  placeholder="New task title"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                />
                <select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}>
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name}
                    </option>
                  ))}
                </select>
                <input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
                <button type="submit" className="btn-ghost" disabled={creatingTask}>
                  {creatingTask ? 'Adding…' : 'Add Task'}
                </button>
              </form>
              {taskError && <p className="matter-error">{taskError}</p>}
            </section>

            <section className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <span>Messages</span>
              </div>

              <div className="matter-messages-list">
                {messages.map((m) => (
                  <div key={m.id} className="matter-message-row">
                    <div className="matter-message-meta">
                      <span className="matter-message-author">
                        {m.author_name}
                        {m.author_type === 'client_contact' ? ' (client)' : ''}
                      </span>
                      <span className="muted">{new Date(m.created_at).toLocaleString()}</span>
                      <button
                        type="button"
                        className="icon-btn"
                        disabled={messageBusyId === m.id}
                        onClick={() => handleDeleteMessage(m)}
                        aria-label="Delete message"
                      >
                        <IconTrash />
                      </button>
                    </div>
                    <p className="matter-message-body">{m.body}</p>
                  </div>
                ))}
                {messages.length === 0 && <p className="muted">No messages yet.</p>}
              </div>

              <form onSubmit={handleSendMessage} className="matter-message-compose-row">
                <input
                  type="text"
                  placeholder="Write a message to the client…"
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                />
                <button type="submit" className="btn-ghost" disabled={sendingMessage || !messageBody.trim()}>
                  <IconSend /> {sendingMessage ? 'Sending…' : 'Send'}
                </button>
              </form>
              {messageError && <p className="matter-error">{messageError}</p>}
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
