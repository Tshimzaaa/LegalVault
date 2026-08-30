import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import './MatterDetail.css'
import {
  getMatter,
  listAssignments,
  assignStaff,
  updateMatterDetails,
  updateMatterStatus,
  updateMatterVisibility,
  updateMatterDeadline,
  listMatterDocuments,
  uploadMatterDocument,
  getMatterDocumentDownloadUrl,
  deleteMatterDocument,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  listMessages,
  createMessage,
  deleteMessage,
  listMatterApprovals,
  requestMatterApproval,
  decideMatterApproval,
  generateMatterDocument,
  isGatedTransition,
  MATTER_STATUS_TRANSITIONS,
} from '../../api/matters'
import type {
  Matter,
  MatterAssignment,
  MatterRole,
  MatterDocument,
  MatterTask,
  TaskStatus,
  MatterMessage,
  MatterApproval,
} from '../../api/matters'
import { listClients, listContacts } from '../../api/clients'
import type { Client, Contact } from '../../api/clients'
import { listUsers, getCurrentUser } from '../../api/auth'
import type { User } from '../../api/auth'
import { listSignatureRequests, sendForSignature, voidSignatureRequest } from '../../api/signatures'
import type { SignatureRequest, SignatureRecipientType } from '../../api/signatures'
import { listTemplates } from '../../api/templates'
import type { Template } from '../../api/templates'
import { listIntakeSubmissions } from '../../api/intakeSubmissions'
import type { IntakeSubmission } from '../../api/intakeSubmissions'
import { IconDownload, IconTrash, IconSend, IconEdit } from '../../components/icons'

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

const sigStatusColor: Record<SignatureRequest['status'], string> = {
  pending: '#eab308',
  completed: '#22c55e',
  declined: '#ef4444',
  voided: '#9ca3af',
}

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

  const [matter, setMatter] = useState<Matter | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [assignments, setAssignments] = useState<MatterAssignment[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [approvals, setApprovals] = useState<MatterApproval[]>([])
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const [decidingApproval, setDecidingApproval] = useState(false)
  const [status, setStatus] = useState<LoadState>('loading')

  const [editingDetails, setEditingDetails] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [detailsSaving, setDetailsSaving] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)

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
  const [docBusyId, setDocBusyId] = useState<string | null>(null)

  const [templates, setTemplates] = useState<Template[]>([])
  const [intakeSubmissions, setIntakeSubmissions] = useState<IntakeSubmission[]>([])
  const [genTemplateId, setGenTemplateId] = useState('')
  const [genSubmissionId, setGenSubmissionId] = useState('')
  const [genTitle, setGenTitle] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

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

  const [signatureRequests, setSignatureRequests] = useState<SignatureRequest[]>([])
  const [sigDocId, setSigDocId] = useState('')
  const [sigTitle, setSigTitle] = useState('')
  const [sigRecipientKeys, setSigRecipientKeys] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [sigError, setSigError] = useState<string | null>(null)
  const [sigBusyId, setSigBusyId] = useState<string | null>(null)

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
      listSignatureRequests(token, matterId),
      getCurrentUser(token),
      listMatterApprovals(token, matterId),
      listTemplates(token),
      listIntakeSubmissions(token),
    ])
      .then(([m, a, c, u, docs, t, msgs, sigs, me, appr, tmpls, submissions]) => {
        setMatter(m)
        setStatusValue(m.status)
        setDeadlineValue(m.due_date ?? '')
        setAssignments(a)
        setClients(c)
        setUsers(u)
        setDocuments(docs)
        setTasks(t)
        setMessages(msgs)
        setSignatureRequests(sigs)
        setCurrentUser(me)
        setApprovals(appr)
        setTemplates(tmpls)
        setIntakeSubmissions(submissions.filter((s) => s.client_id === m.client_id))
        setStatus('ready')
        listContacts(token, m.client_id)
          .then((contactList) => setContacts(contactList))
          .catch(() => setContacts([]))
      })
      .catch(() => setStatus('error'))
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId])

  function startEditDetails() {
    if (!matter) return
    setEditTitle(matter.title)
    setEditDescription(matter.description ?? '')
    setDetailsError(null)
    setEditingDetails(true)
  }

  async function handleSaveDetails(e: FormEvent) {
    e.preventDefault()
    if (!token || !matterId) return
    setDetailsError(null)
    setDetailsSaving(true)
    try {
      const updated = await updateMatterDetails(token, matterId, {
        title: editTitle,
        description: editDescription || null,
      })
      setMatter(updated)
      setEditingDetails(false)
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : 'Could not save changes.')
    } finally {
      setDetailsSaving(false)
    }
  }

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

  async function handleRequestApproval() {
    if (!token || !matterId || !matter) return
    setApprovalError(null)
    setStatusSaving(true)
    try {
      const approval = await requestMatterApproval(token, matterId, statusValue)
      setApprovals((prev) => [approval, ...prev])
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : 'Could not request approval.')
    } finally {
      setStatusSaving(false)
    }
  }

  async function handleDecideApproval(approval: MatterApproval, decision: 'approved' | 'rejected') {
    if (!token || !matterId) return
    setApprovalError(null)
    setDecidingApproval(true)
    try {
      const updated = await decideMatterApproval(token, matterId, approval.id, decision)
      setApprovals((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
      if (updated.status === 'approved') {
        const refreshed = await getMatter(token, matterId)
        setMatter(refreshed)
        setStatusValue(refreshed.status)
      }
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : 'Could not record the decision.')
    } finally {
      setDecidingApproval(false)
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

  async function handleGenerate(e: FormEvent) {
    e.preventDefault()
    if (!token || !matterId || !genTemplateId || !genSubmissionId) {
      setGenerateError('Choose a template and an intake submission.')
      return
    }
    setGenerateError(null)
    setGenerating(true)
    try {
      const generated = await generateMatterDocument(token, matterId, {
        template_id: genTemplateId,
        intake_submission_id: genSubmissionId,
        title: genTitle || undefined,
      })
      setDocuments((prev) => [...prev, generated])
      setGenTitle('')
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Could not generate the document.')
    } finally {
      setGenerating(false)
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

  async function handleDeleteDocument(doc: MatterDocument) {
    if (!token || !matterId) return
    if (!window.confirm(`Delete “${doc.title}”?`)) return
    setUploadError(null)
    setDocBusyId(doc.id)
    const index = documents.findIndex((d) => d.id === doc.id)
    // Optimistic: remove immediately, put it back at its original position if the delete fails.
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    try {
      await deleteMatterDocument(token, matterId, doc.id)
    } catch (err) {
      setDocuments((prev) => {
        const next = [...prev]
        next.splice(index, 0, doc)
        return next
      })
      setUploadError(err instanceof Error ? err.message : 'Could not delete the document.')
    } finally {
      setDocBusyId(null)
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
    setTaskError(null)
    setTaskBusyId(task.id)
    // Optimistic: flip the status immediately, reconcile with the server's copy after, and
    // put the original status back if the request fails.
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)))
    try {
      const updated = await updateTask(token, matterId, task.id, { status: nextStatus })
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)))
      setTaskError(err instanceof Error ? err.message : 'Could not update the task status.')
    } finally {
      setTaskBusyId(null)
    }
  }

  async function handleDeleteTask(task: MatterTask) {
    if (!token || !matterId) return
    if (!window.confirm(`Delete task “${task.title}”?`)) return
    setTaskError(null)
    setTaskBusyId(task.id)
    const index = tasks.findIndex((t) => t.id === task.id)
    // Optimistic: remove immediately, put it back at its original position if the delete fails.
    setTasks((prev) => prev.filter((t) => t.id !== task.id))
    try {
      await deleteTask(token, matterId, task.id)
    } catch (err) {
      setTasks((prev) => {
        const next = [...prev]
        next.splice(index, 0, task)
        return next
      })
      setTaskError(err instanceof Error ? err.message : 'Could not delete the task.')
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
    if (!window.confirm('Delete this message?')) return
    setMessageError(null)
    setMessageBusyId(message.id)
    const index = messages.findIndex((m) => m.id === message.id)
    // Optimistic: remove immediately, put it back at its original position if the delete fails.
    setMessages((prev) => prev.filter((m) => m.id !== message.id))
    try {
      await deleteMessage(token, matterId, message.id)
    } catch (err) {
      setMessages((prev) => {
        const next = [...prev]
        next.splice(index, 0, message)
        return next
      })
      setMessageError(err instanceof Error ? err.message : 'Could not delete the message.')
    } finally {
      setMessageBusyId(null)
    }
  }

  function recipientKey(type: SignatureRecipientType, id: string) {
    return `${type}:${id}`
  }

  function toggleSigRecipient(key: string) {
    setSigRecipientKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  async function handleSendForSignature(e: FormEvent) {
    e.preventDefault()
    if (!token || !matterId) return
    if (!sigDocId) {
      setSigError('Choose a document to send.')
      return
    }
    if (sigRecipientKeys.length === 0) {
      setSigError('Select at least one recipient.')
      return
    }
    setSigError(null)
    setSending(true)
    try {
      const created = await sendForSignature(token, matterId, {
        source_document_id: sigDocId,
        title: sigTitle || documentGroups.find((v) => v[0].id === sigDocId)?.[0].title || 'Untitled document',
        recipients: sigRecipientKeys.map((key) => {
          const [recipient_type, recipient_id] = key.split(':') as [SignatureRecipientType, string]
          return { recipient_type, recipient_id }
        }),
      })
      setSignatureRequests((prev) => [created, ...prev])
      setSigDocId('')
      setSigTitle('')
      setSigRecipientKeys([])
    } catch (err) {
      setSigError(err instanceof Error ? err.message : 'Could not send the document for signature.')
    } finally {
      setSending(false)
    }
  }

  async function handleVoidSignature(request: SignatureRequest) {
    if (!token || !matterId) return
    setSigError(null)
    setSigBusyId(request.id)
    try {
      const updated = await voidSignatureRequest(token, matterId, request.id)
      setSignatureRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    } catch (err) {
      setSigError(err instanceof Error ? err.message : 'Could not void the signature request.')
    } finally {
      setSigBusyId(null)
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

  const pendingApproval = approvals.find((a) => a.status === 'pending')
  const canDecideApprovals = Boolean(
    currentUser &&
      (currentUser.role === 'admin' ||
        assignments.some((a) => a.user_id === currentUser.id && a.role_on_matter === 'lead_lawyer')),
  )
  const availableStatusOptions = matter
    ? statusOptions.filter((o) => o.value === matter.status || MATTER_STATUS_TRANSITIONS[matter.status].includes(o.value))
    : statusOptions
  const statusChangeIsGated = matter ? isGatedTransition(matter.status, statusValue) : false

  const generatableTemplates = templates.filter((t) => t.body)

  function uploaderName(doc: MatterDocument): string {
    if (doc.uploaded_by) return userName(doc.uploaded_by)
    if (doc.uploaded_by_contact_id) {
      const contact = contacts.find((c) => c.id === doc.uploaded_by_contact_id)
      return contact ? `${contact.first_name} ${contact.last_name} (client)` : 'Client'
    }
    return '—'
  }

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
          <Link to="/staff/matters" className="matter-detail-back">
            &larr; Back to Matters
          </Link>
          <h1>{matter?.title ?? 'Matter'}</h1>
        </div>
        {matter && (
          <div className="topbar-actions">
            <button type="button" className="icon-btn" onClick={startEditDetails} aria-label="Edit matter details">
              <IconEdit />
            </button>
            <span
              className="status-badge"
              style={{ color: statusColor[matter.status], background: `${statusColor[matter.status]}22` }}
            >
              {statusOptions.find((o) => o.value === matter.status)?.label}
            </span>
          </div>
        )}
      </header>

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
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
                <h2>Details</h2>
              </div>
              {editingDetails ? (
                <form onSubmit={handleSaveDetails}>
                  <label className="field">
                    <span>Title</span>
                    <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required minLength={2} />
                  </label>
                  <label className="field" style={{ marginTop: 8 }}>
                    <span>Description</span>
                    <textarea rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                  </label>
                  {detailsError && <p className="matter-error" aria-live="polite">{detailsError}</p>}
                  <div className="matter-actions" style={{ marginTop: 8 }}>
                    <button type="button" className="btn-ghost" onClick={() => setEditingDetails(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-solid" disabled={detailsSaving}>
                      {detailsSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="muted">Client: {clientName(matter.client_id)}</p>
                  <p className="muted">Opened: {new Date(matter.created_at).toLocaleDateString()}</p>
                  <p className="matter-detail-description">{matter.description || 'No description provided.'}</p>
                </>
              )}
            </section>

            <section className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <h2>Status</h2>
              </div>
              <div className="matter-detail-field-row">
                <select
                  aria-label="Matter status"
                  value={statusValue}
                  onChange={(e) => setStatusValue(e.target.value as Matter['status'])}
                >
                  {availableStatusOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-solid"
                  disabled={statusSaving || statusValue === matter.status || Boolean(pendingApproval)}
                  onClick={statusChangeIsGated ? handleRequestApproval : handleStatusSave}
                >
                  {statusSaving ? 'Saving…' : statusChangeIsGated ? 'Request Approval' : 'Save'}
                </button>
              </div>
              {approvalError && <p className="matter-error" aria-live="polite">{approvalError}</p>}

              {pendingApproval && (
                <div className="matter-detail-toggle-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                  <span className="muted">
                    Approval pending: {pendingApproval.from_status} &rarr; {pendingApproval.to_status}, requested by{' '}
                    {userName(pendingApproval.requested_by)} on {new Date(pendingApproval.created_at).toLocaleDateString()}
                  </span>
                  {canDecideApprovals && (
                    <div className="matter-actions">
                      <button
                        type="button"
                        className="btn-solid"
                        disabled={decidingApproval}
                        onClick={() => handleDecideApproval(pendingApproval, 'approved')}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={decidingApproval}
                        onClick={() => handleDecideApproval(pendingApproval, 'rejected')}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              )}

              {approvals.filter((a) => a.status !== 'pending').length > 0 && (
                <div className="list-rows" style={{ marginTop: 8 }}>
                  {approvals
                    .filter((a) => a.status !== 'pending')
                    .map((a) => (
                      <div key={a.id} className="assignment-row">
                        <span className="muted">
                          {a.from_status} &rarr; {a.to_status}
                        </span>
                        <span className={`chip small ${a.status === 'approved' ? '' : 'muted'}`}>{a.status}</span>
                      </div>
                    ))}
                </div>
              )}

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
                <label className="field" style={{ margin: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={matter.is_visible_to_client}
                    disabled={visibilitySaving}
                    onChange={(e) => handleVisibilityToggle(e.target.checked)}
                  />
                  <span>Visible to client</span>
                </label>
              </div>
            </section>

            <section className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <h2>Documents</h2>
              </div>

              <div className="list-rows">
                {documentGroups.map((versions) => {
                  const latest = versions[0]
                  return (
                    <div key={latest.title} className="matter-doc-group">
                      <div className="matter-doc-row">
                        <span className="matter-doc-title">{latest.title}</span>
                        <span className="chip small">v{latest.version}</span>
                        <span className="muted matter-doc-meta">
                          {uploaderName(latest)} · {new Date(latest.created_at).toLocaleDateString()}
                        </span>
                        <button
                          type="button"
                          className="icon-btn"
                          disabled={downloadingId === latest.id}
                          onClick={() => handleDownload(latest.id)}
                          aria-label={`Download ${latest.title}`}
                        >
                          <IconDownload />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          disabled={docBusyId === latest.id}
                          onClick={() => handleDeleteDocument(latest)}
                          aria-label={`Delete ${latest.title}`}
                        >
                          <IconTrash />
                        </button>
                      </div>
                      {versions.length > 1 && (
                        <div className="matter-doc-history">
                          {versions.slice(1).map((v) => (
                            <div key={v.id} className="matter-doc-row muted">
                              <span className="matter-doc-title">{v.title}</span>
                              <span className="chip small">v{v.version}</span>
                              <span className="muted matter-doc-meta">
                                {uploaderName(v)} · {new Date(v.created_at).toLocaleDateString()}
                              </span>
                              <button
                                type="button"
                                className="icon-btn"
                                disabled={downloadingId === v.id}
                                onClick={() => handleDownload(v.id)}
                                aria-label={`Download ${v.title} v${v.version}`}
                              >
                                <IconDownload />
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                disabled={docBusyId === v.id}
                                onClick={() => handleDeleteDocument(v)}
                                aria-label={`Delete ${v.title} v${v.version}`}
                              >
                                <IconTrash />
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
                  aria-label="Document title"
                  placeholder="Document title (reuse a title to add a new version)…"
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
                <input
                  id="matter-doc-file"
                  type="file"
                  aria-label="Document file"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.txt"
                  required
                />
                <button type="submit" className="btn-ghost" disabled={uploading}>
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
              </form>
              {uploadError && <p className="matter-error" aria-live="polite">{uploadError}</p>}

              {generatableTemplates.length > 0 && (
                <form onSubmit={handleGenerate} className="matter-doc-upload-row" style={{ marginTop: 10 }}>
                  <select value={genTemplateId} onChange={(e) => setGenTemplateId(e.target.value)} aria-label="Template">
                    <option value="">Generate from template…</option>
                    {generatableTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={genSubmissionId}
                    onChange={(e) => setGenSubmissionId(e.target.value)}
                    aria-label="Intake submission"
                  >
                    <option value="">Using submission…</option>
                    {intakeSubmissions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {new Date(s.created_at).toLocaleDateString()} ({s.status})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    aria-label="Generated document title"
                    placeholder="Document title (optional)…"
                    value={genTitle}
                    onChange={(e) => setGenTitle(e.target.value)}
                  />
                  <button type="submit" className="btn-ghost" disabled={generating}>
                    {generating ? 'Generating…' : 'Generate'}
                  </button>
                </form>
              )}
              {generateError && <p className="matter-error" aria-live="polite">{generateError}</p>}
            </section>

            <section className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <h2>Signatures</h2>
              </div>

              <div className="list-rows">
                {signatureRequests.map((sr) => (
                  <div key={sr.id} className="matter-doc-group">
                    <div className="matter-doc-row">
                      <span className="matter-doc-title">{sr.title}</span>
                      <span
                        className="status-badge"
                        style={{ color: sigStatusColor[sr.status], background: `${sigStatusColor[sr.status]}22` }}
                      >
                        {sr.status}
                      </span>
                      {sr.status === 'pending' && (
                        <button
                          type="button"
                          className="icon-btn"
                          disabled={sigBusyId === sr.id}
                          onClick={() => handleVoidSignature(sr)}
                          aria-label={`Void ${sr.title}`}
                        >
                          <IconTrash />
                        </button>
                      )}
                    </div>
                    <div className="matter-doc-history">
                      {sr.recipients.map((r) => (
                        <div key={r.id} className="matter-doc-row muted">
                          <span className="matter-doc-title">
                            {r.name} {r.recipient_type === 'client_contact' ? '(client)' : ''}
                          </span>
                          <span className="chip small">{r.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {signatureRequests.length === 0 && <p className="muted">No signature requests sent yet.</p>}
              </div>

              <form onSubmit={handleSendForSignature} className="matter-doc-upload-row">
                <select value={sigDocId} onChange={(e) => setSigDocId(e.target.value)} aria-label="Document to send">
                  <option value="">Choose a document…</option>
                  {documentGroups.map((versions) => (
                    <option key={versions[0].id} value={versions[0].id}>
                      {versions[0].title} (v{versions[0].version})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  aria-label="Signature request title"
                  placeholder="Signature request title (defaults to document title)…"
                  value={sigTitle}
                  onChange={(e) => setSigTitle(e.target.value)}
                />
                <button type="submit" className="btn-ghost" disabled={sending}>
                  {sending ? 'Sending…' : 'Send for Signature'}
                </button>
              </form>

              <div className="matter-doc-history" style={{ marginTop: 8 }}>
                <span className="muted matter-doc-meta">Recipients:</span>
                {assignments.map((a) => {
                  const key = recipientKey('staff', a.user_id)
                  return (
                    <label key={key} className="field" style={{ display: 'inline-flex', gap: 4, marginRight: 12 }}>
                      <input
                        type="checkbox"
                        checked={sigRecipientKeys.includes(key)}
                        onChange={() => toggleSigRecipient(key)}
                      />
                      <span>{userName(a.user_id)}</span>
                    </label>
                  )
                })}
                {contacts.map((c) => {
                  const key = recipientKey('client_contact', c.id)
                  return (
                    <label key={key} className="field" style={{ display: 'inline-flex', gap: 4, marginRight: 12 }}>
                      <input
                        type="checkbox"
                        checked={sigRecipientKeys.includes(key)}
                        onChange={() => toggleSigRecipient(key)}
                      />
                      <span>
                        {c.first_name} {c.last_name} (client)
                      </span>
                    </label>
                  )
                })}
              </div>
              {sigError && <p className="matter-error" aria-live="polite">{sigError}</p>}
            </section>

            <section className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <h2>Tasks</h2>
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
                      aria-label={`Status for task ${t.title}`}
                      value={t.status}
                      disabled={taskBusyId === t.id}
                      onChange={(e) => handleTaskStatusChange(t, e.target.value as TaskStatus)}
                      style={{ color: taskStatusColor[t.status], background: `${taskStatusColor[t.status]}22` }}
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
                  aria-label="New task title"
                  placeholder="New task title…"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                />
                <select aria-label="Assign task to" value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}>
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  aria-label="Task due date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
                <button type="submit" className="btn-ghost" disabled={creatingTask}>
                  {creatingTask ? 'Adding…' : 'Add Task'}
                </button>
              </form>
              {taskError && <p className="matter-error" aria-live="polite">{taskError}</p>}
            </section>

            <section className="card" style={{ marginTop: 16 }}>
              <div className="card-header">
                <h2>Messages</h2>
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
                  aria-label="Message"
                  placeholder="Write a message to the client…"
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                />
                <button type="submit" className="btn-ghost" disabled={sendingMessage || !messageBody.trim()}>
                  <IconSend /> {sendingMessage ? 'Sending…' : 'Send'}
                </button>
              </form>
              {messageError && <p className="matter-error" aria-live="polite">{messageError}</p>}
            </section>
          </div>

          <section className="card">
            <div className="card-header">
              <h2>Staff Assigned</h2>
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
              <select aria-label="Staff member to assign" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
                <option value="">Select staff member</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Role on matter"
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
            {assignError && <p className="matter-error" aria-live="polite">{assignError}</p>}
          </section>
        </div>
      )}
    </main>
  )
}

export default MatterDetail
