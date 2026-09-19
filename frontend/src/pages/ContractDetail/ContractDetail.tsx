import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import './ContractDetail.css'
import {
  getContract,
  listAssignments,
  assignStaff,
  updateContractDetails,
  updateContractStage,
  updateContractDeadline,
  listContractDocuments,
  uploadContractDocument,
  getContractDocumentDownloadUrl,
  deleteContractDocument,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  listMessages,
  createMessage,
  deleteMessage,
  listContractApprovals,
  requestContractApproval,
  decideContractApproval,
  isGatedTransition,
  CONTRACT_STATUS_TRANSITIONS,
} from '../../api/contracts'
import type {
  Contract,
  ContractAssignment,
  ContractRole,
  ContractDocument,
  ContractTask,
  TaskStatus,
  ContractMessage,
  ContractApproval,
} from '../../api/contracts'
import { listUsers, getCurrentUser } from '../../api/auth'
import type { User } from '../../api/auth'
import { listSignatureRequests, sendForSignature, voidSignatureRequest } from '../../api/signatures'
import type { SignatureRequest, SignatureRecipientInput } from '../../api/signatures'
import { IconDownload, IconTrash, IconSend, IconEdit } from '../../components/icons'

type LoadState = 'loading' | 'error' | 'ready'
type DetailTab = 'overview' | 'tasks' | 'documents' | 'messages'

const statusOptions: { value: Contract['status']; label: string }[] = [
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
  todo: 'var(--text-muted)',
  in_progress: '#3987e5',
  done: 'var(--accent)',
}

// See statusColorRgb below for why this parallel rgb-triple map exists.
const taskStatusColorRgb: Record<TaskStatus, string> = {
  todo: 'var(--text-muted-rgb)',
  in_progress: '57, 135, 229',
  done: 'var(--accent-rgb)',
}

const roleOptions: { value: ContractRole; label: string }[] = [
  { value: 'lead_lawyer', label: 'Lead Lawyer' },
  { value: 'paralegal', label: 'Paralegal' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'reviewer', label: 'Reviewer' },
]

const sigStatusColor: Record<SignatureRequest['status'], string> = {
  pending: 'var(--warning)',
  completed: 'var(--accent)',
  declined: 'var(--danger)',
  voided: 'var(--text-muted)',
}

const sigStatusColorRgb: Record<SignatureRequest['status'], string> = {
  pending: 'var(--warning-rgb)',
  completed: 'var(--accent-rgb)',
  declined: 'var(--danger-rgb)',
  voided: 'var(--text-muted-rgb)',
}

const statusColor: Record<Contract['status'], string> = {
  intake: 'var(--warning)',
  in_review: '#3987e5',
  awaiting_signature: '#a855f7',
  signed: '#199e70',
  closed: 'var(--accent)',
  declined: 'var(--danger)',
}

// Matching rgb triples so a translucent badge background can be composed with rgba() —
// appending a hex alpha suffix directly to a `var(--token)` string produces invalid CSS
// (e.g. "var(--accent)22"), which browsers silently drop.
const statusColorRgb: Record<Contract['status'], string> = {
  intake: 'var(--warning-rgb)',
  in_review: '57, 135, 229',
  awaiting_signature: '168, 85, 247',
  signed: '25, 158, 112',
  closed: 'var(--accent-rgb)',
  declined: 'var(--danger-rgb)',
}

function ContractDetail() {
  const { contractId } = useParams<{ contractId: string }>()

  const [contract, setContract] = useState<Contract | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [assignments, setAssignments] = useState<ContractAssignment[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [approvals, setApprovals] = useState<ContractApproval[]>([])
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const [decidingApproval, setDecidingApproval] = useState(false)
  const [status, setStatus] = useState<LoadState>('loading')

  const [editingDetails, setEditingDetails] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [detailsSaving, setDetailsSaving] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)

  const [statusValue, setStatusValue] = useState<Contract['status']>('intake')
  const [statusSaving, setStatusSaving] = useState(false)

  const [deadlineValue, setDeadlineValue] = useState('')
  const [deadlineSaving, setDeadlineSaving] = useState(false)

  const [assignUserId, setAssignUserId] = useState('')
  const [assignRole, setAssignRole] = useState<ContractRole>('lead_lawyer')
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  const [documents, setDocuments] = useState<ContractDocument[]>([])
  const [docTitle, setDocTitle] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [docBusyId, setDocBusyId] = useState<string | null>(null)

  const [tasks, setTasks] = useState<ContractTask[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [taskAssignee, setTaskAssignee] = useState('')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [creatingTask, setCreatingTask] = useState(false)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [taskBusyId, setTaskBusyId] = useState<string | null>(null)

  const [messages, setMessages] = useState<ContractMessage[]>([])
  const [messageBody, setMessageBody] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [messageBusyId, setMessageBusyId] = useState<string | null>(null)

  const [signatureRequests, setSignatureRequests] = useState<SignatureRequest[]>([])
  const [sigDocId, setSigDocId] = useState('')
  const [sigTitle, setSigTitle] = useState('')
  const [sigStaffIds, setSigStaffIds] = useState<string[]>([])
  const [externalName, setExternalName] = useState('')
  const [externalEmail, setExternalEmail] = useState('')
  const [externalRecipients, setExternalRecipients] = useState<{ name: string; email: string }[]>([])
  const [sending, setSending] = useState(false)
  const [sigError, setSigError] = useState<string | null>(null)
  const [sigBusyId, setSigBusyId] = useState<string | null>(null)

  const [tab, setTab] = useState<DetailTab>('overview')
  const [moreOpen, setMoreOpen] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [showSign, setShowSign] = useState(false)
  const [showAssign, setShowAssign] = useState(false)

  const token = localStorage.getItem('access_token')

  function loadAll() {
    if (!token || !contractId) {
      setStatus('error')
      return
    }
    setStatus('loading')
    Promise.all([
      getContract(token, contractId),
      listAssignments(token, contractId),
      listUsers(token),
      listContractDocuments(token, contractId),
      listTasks(token, contractId),
      listMessages(token, contractId),
      listSignatureRequests(token, contractId),
      getCurrentUser(token),
      listContractApprovals(token, contractId),
    ])
      .then(([m, a, u, docs, t, msgs, sigs, me, appr]) => {
        setContract(m)
        setStatusValue(m.status)
        setDeadlineValue(m.due_date ?? '')
        setAssignments(a)
        setUsers(u)
        setDocuments(docs)
        setTasks(t)
        setMessages(msgs)
        setSignatureRequests(sigs)
        setCurrentUser(me)
        setApprovals(appr)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId])

  function startEditDetails() {
    if (!contract) return
    setEditTitle(contract.title)
    setEditDescription(contract.description ?? '')
    setDetailsError(null)
    setEditingDetails(true)
    setTab('overview')
  }

  async function handleSaveDetails(e: FormEvent) {
    e.preventDefault()
    if (!token || !contractId) return
    setDetailsError(null)
    setDetailsSaving(true)
    try {
      const updated = await updateContractDetails(token, contractId, {
        title: editTitle,
        description: editDescription || null,
      })
      setContract(updated)
      setEditingDetails(false)
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : 'Could not save changes.')
    } finally {
      setDetailsSaving(false)
    }
  }

  async function handleStatusSave() {
    if (!token || !contractId) return
    setStatusSaving(true)
    try {
      const updated = await updateContractStage(token, contractId, statusValue)
      setContract(updated)
    } finally {
      setStatusSaving(false)
    }
  }

  async function handleRequestApproval() {
    if (!token || !contractId || !contract) return
    setApprovalError(null)
    setStatusSaving(true)
    try {
      const approval = await requestContractApproval(token, contractId, statusValue)
      setApprovals((prev) => [approval, ...prev])
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : 'Could not request approval.')
    } finally {
      setStatusSaving(false)
    }
  }

  async function handleDecideApproval(approval: ContractApproval, decision: 'approved' | 'rejected') {
    if (!token || !contractId) return
    setApprovalError(null)
    setDecidingApproval(true)
    try {
      const updated = await decideContractApproval(token, contractId, approval.id, decision)
      setApprovals((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
      if (updated.status === 'approved') {
        const refreshed = await getContract(token, contractId)
        setContract(refreshed)
        setStatusValue(refreshed.status)
      }
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : 'Could not record the decision.')
    } finally {
      setDecidingApproval(false)
    }
  }

  async function handleDeadlineSave() {
    if (!token || !contractId) return
    setDeadlineSaving(true)
    try {
      const updated = await updateContractDeadline(token, contractId, deadlineValue || null)
      setContract(updated)
    } finally {
      setDeadlineSaving(false)
    }
  }

  async function handleAssign() {
    if (!token || !contractId || !assignUserId) {
      setAssignError('Select a staff member to assign.')
      return
    }
    setAssignError(null)
    setAssigning(true)
    try {
      const created = await assignStaff(token, contractId, { user_id: assignUserId, role_on_contract: assignRole })
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
    if (!token || !contractId || !docFile) {
      setUploadError('Choose a file to upload.')
      return
    }
    setUploadError(null)
    setUploading(true)
    try {
      const uploaded = await uploadContractDocument(token, contractId, docTitle, docFile)
      setDocuments((prev) => [...prev, uploaded])
      setDocTitle('')
      setDocFile(null)
      const fileInput = document.getElementById('contract-doc-file') as HTMLInputElement | null
      if (fileInput) fileInput.value = ''
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not upload the document.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(documentId: string) {
    if (!token || !contractId) return
    setDownloadingId(documentId)
    try {
      const url = await getContractDocumentDownloadUrl(token, contractId, documentId)
      window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleDeleteDocument(doc: ContractDocument) {
    if (!token || !contractId) return
    if (!window.confirm(`Delete “${doc.title}”?`)) return
    setUploadError(null)
    setDocBusyId(doc.id)
    const index = documents.findIndex((d) => d.id === doc.id)
    // Optimistic: remove immediately, put it back at its original position if the delete fails.
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    try {
      await deleteContractDocument(token, contractId, doc.id)
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
    if (!token || !contractId || !taskTitle) {
      setTaskError('Enter a task title.')
      return
    }
    setTaskError(null)
    setCreatingTask(true)
    try {
      const created = await createTask(token, contractId, {
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

  async function handleTaskStatusChange(task: ContractTask, nextStatus: TaskStatus) {
    if (!token || !contractId) return
    setTaskError(null)
    setTaskBusyId(task.id)
    // Optimistic: flip the status immediately, reconcile with the server's copy after, and
    // put the original status back if the request fails.
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)))
    try {
      const updated = await updateTask(token, contractId, task.id, { status: nextStatus })
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)))
      setTaskError(err instanceof Error ? err.message : 'Could not update the task status.')
    } finally {
      setTaskBusyId(null)
    }
  }

  async function handleDeleteTask(task: ContractTask) {
    if (!token || !contractId) return
    if (!window.confirm(`Delete task “${task.title}”?`)) return
    setTaskError(null)
    setTaskBusyId(task.id)
    const index = tasks.findIndex((t) => t.id === task.id)
    // Optimistic: remove immediately, put it back at its original position if the delete fails.
    setTasks((prev) => prev.filter((t) => t.id !== task.id))
    try {
      await deleteTask(token, contractId, task.id)
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
    if (!token || !contractId || !messageBody.trim()) return
    setMessageError(null)
    setSendingMessage(true)
    try {
      const created = await createMessage(token, contractId, messageBody.trim())
      setMessages((prev) => [...prev, created])
      setMessageBody('')
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : 'Could not send the message.')
    } finally {
      setSendingMessage(false)
    }
  }

  async function handleDeleteMessage(message: ContractMessage) {
    if (!token || !contractId) return
    if (!window.confirm('Delete this message?')) return
    setMessageError(null)
    setMessageBusyId(message.id)
    const index = messages.findIndex((m) => m.id === message.id)
    // Optimistic: remove immediately, put it back at its original position if the delete fails.
    setMessages((prev) => prev.filter((m) => m.id !== message.id))
    try {
      await deleteMessage(token, contractId, message.id)
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

  function toggleSigStaff(userId: string) {
    setSigStaffIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
  }

  function handleAddExternalRecipient(e: FormEvent) {
    e.preventDefault()
    if (!externalName.trim() || !externalEmail.trim()) return
    setExternalRecipients((prev) => [...prev, { name: externalName.trim(), email: externalEmail.trim() }])
    setExternalName('')
    setExternalEmail('')
  }

  function handleRemoveExternalRecipient(index: number) {
    setExternalRecipients((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSendForSignature(e: FormEvent) {
    e.preventDefault()
    if (!token || !contractId) return
    if (!sigDocId) {
      setSigError('Choose a document to send.')
      return
    }
    if (sigStaffIds.length === 0 && externalRecipients.length === 0) {
      setSigError('Select at least one recipient.')
      return
    }
    setSigError(null)
    setSending(true)
    try {
      const recipients: SignatureRecipientInput[] = [
        ...sigStaffIds.map((recipient_id) => ({ recipient_id })),
        ...externalRecipients.map((r) => ({ external_name: r.name, external_email: r.email })),
      ]
      const created = await sendForSignature(token, contractId, {
        source_document_id: sigDocId,
        title: sigTitle || documentGroups.find((v) => v[0].id === sigDocId)?.[0].title || 'Untitled document',
        recipients,
      })
      setSignatureRequests((prev) => [created, ...prev])
      setSigDocId('')
      setSigTitle('')
      setSigStaffIds([])
      setExternalRecipients([])
    } catch (err) {
      setSigError(err instanceof Error ? err.message : 'Could not send the document for signature.')
    } finally {
      setSending(false)
    }
  }

  async function handleVoidSignature(request: SignatureRequest) {
    if (!token || !contractId) return
    if (!window.confirm('Void this signature request? Signers will no longer be able to sign it.')) return
    setSigError(null)
    setSigBusyId(request.id)
    try {
      const updated = await voidSignatureRequest(token, contractId, request.id)
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

  // A person can hold more than one role on a contract — only hide them from the picker
  // once they already have the specific role currently selected.
  const userIdsWithSelectedRole = new Set(
    assignments.filter((a) => a.role_on_contract === assignRole).map((a) => a.user_id),
  )
  const assignableUsers = users.filter((u) => !userIdsWithSelectedRole.has(u.id))

  const pendingApproval = approvals.find((a) => a.status === 'pending')
  const canDecideApprovals = Boolean(
    currentUser &&
      (currentUser.role === 'admin' ||
        assignments.some((a) => a.user_id === currentUser.id && a.role_on_contract === 'lead_lawyer')),
  )
  const availableStatusOptions = contract
    ? statusOptions.filter((o) => o.value === contract.status || CONTRACT_STATUS_TRANSITIONS[contract.status].includes(o.value))
    : statusOptions
  const statusChangeIsGated = contract ? isGatedTransition(contract.status, statusValue) : false

  function uploaderName(doc: ContractDocument): string {
    if (doc.uploaded_by) return userName(doc.uploaded_by)
    return 'N/A'
  }

  const documentGroups = Object.values(
    documents.reduce<Record<string, ContractDocument[]>>((groups, doc) => {
      ;(groups[doc.title] ??= []).push(doc)
      return groups
    }, {}),
  )
    .map((versions) => versions.slice().sort((a, b) => b.version - a.version))
    .sort((a, b) => b[0].created_at.localeCompare(a[0].created_at))

  return (
    <main className="dash-main">
      <header className="dash-topbar m-header cd-head">
        <div>
          <Link to="/staff/contracts" className="contract-detail-back">
            &larr; Back to Contracts
          </Link>
          <h1>{contract?.title ?? 'Contract'}</h1>
        </div>
        {contract && (
          <div className="topbar-actions">
            <button type="button" className="icon-btn cd-edit-btn" onClick={startEditDetails} aria-label="Edit contract details">
              <IconEdit />
            </button>
            <button
              type="button"
              className="btn-ghost cd-more-btn"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(true)}
            >
              More
            </button>
            <span
              className="status-badge cd-head-status"
              style={{ color: statusColor[contract.status], background: `rgba(${statusColorRgb[contract.status]}, 0.13)` }}
            >
              {statusOptions.find((o) => o.value === contract.status)?.label}
            </span>
          </div>
        )}
      </header>

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading contract…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for this contract.</p>
          <button type="button" className="btn-ghost" onClick={loadAll}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && contract && (
        <>
        <div className="cd-facts">
          <div>
            <span className="cd-fact-label">Deadline</span>
            <span className="cd-fact-value">
              {contract.due_date ? new Date(contract.due_date).toLocaleDateString() : 'Not set'}
            </span>
          </div>
          <div>
            <span className="cd-fact-label">Opened</span>
            <span className="cd-fact-value">{new Date(contract.created_at).toLocaleDateString()}</span>
          </div>
          <div>
            <span className="cd-fact-label">Open tasks</span>
            <span className="cd-fact-value">{tasks.filter((t) => t.status !== 'done').length}</span>
          </div>
          <div>
            <span className="cd-fact-label">Staff</span>
            <span className="cd-fact-value">{assignments.length}</span>
          </div>
        </div>

        <div className="cd-tabs" role="tablist" aria-label="Contract sections">
          {(
            [
              ['overview', 'Overview', null],
              ['tasks', 'Tasks', tasks.length],
              ['documents', 'Documents', documentGroups.length + signatureRequests.length],
              ['messages', 'Messages', messages.length],
            ] as [DetailTab, string, number | null][]
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`cd-tab-${key}`}
              aria-selected={tab === key}
              aria-controls="cd-panel"
              className={`cd-tab ${tab === key ? 'is-active' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
              {count ? <span className="cd-tab-count">{count}</span> : null}
            </button>
          ))}
        </div>

        <div className="contract-detail-grid" data-tab={tab} id="cd-panel" role="tabpanel" aria-labelledby={`cd-tab-${tab}`}>
          <div className="cd-col">
            <section className="card cd-sec" data-sec="documents">
              <div className="card-header">
                <h2>Documents</h2>
                <button
                  type="button"
                  className="btn-ghost cd-add-toggle"
                  aria-expanded={showUpload}
                  onClick={() => setShowUpload((v) => !v)}
                >
                  {showUpload ? 'Close' : 'Upload'}
                </button>
              </div>

              <div className="list-rows">
                {documentGroups.map((versions) => {
                  const latest = versions[0]
                  return (
                    <div key={latest.title} className="contract-doc-group">
                      <div className="contract-doc-row">
                        <span className="contract-doc-title">{latest.title}</span>
                        <span className="chip small">v{latest.version}</span>
                        <span className="muted contract-doc-meta">
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
                        <div className="contract-doc-history">
                          {versions.slice(1).map((v) => (
                            <div key={v.id} className="contract-doc-row muted">
                              <span className="contract-doc-title">{v.title}</span>
                              <span className="chip small">v{v.version}</span>
                              <span className="muted contract-doc-meta">
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

              <form onSubmit={handleUpload} className={`contract-doc-upload-row cd-collapsible ${showUpload ? 'is-open' : ''}`}>
                <input
                  type="text"
                  aria-label="Document title"
                  placeholder="Document title (reuse a title to add a new version)…"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  list="contract-doc-titles"
                  required
                />
                <datalist id="contract-doc-titles">
                  {documentGroups.map((versions) => (
                    <option key={versions[0].title} value={versions[0].title} />
                  ))}
                </datalist>
                <input
                  id="contract-doc-file"
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
              {uploadError && <p className="contract-error" aria-live="polite">{uploadError}</p>}
            </section>

            <section className="card cd-sec" data-sec="documents" style={{ marginTop: 16 }}>
              <div className="card-header">
                <h2>Signatures</h2>
                <button
                  type="button"
                  className="btn-ghost cd-add-toggle"
                  aria-expanded={showSign}
                  onClick={() => setShowSign((v) => !v)}
                >
                  {showSign ? 'Close' : 'Send'}
                </button>
              </div>

              <div className="list-rows">
                {signatureRequests.map((sr) => (
                  <div key={sr.id} className="contract-doc-group">
                    <div className="contract-doc-row">
                      <span className="contract-doc-title">{sr.title}</span>
                      <span
                        className="status-badge"
                        style={{ color: sigStatusColor[sr.status], background: `rgba(${sigStatusColorRgb[sr.status]}, 0.13)` }}
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
                    <div className="contract-doc-history">
                      {sr.recipients.map((r) => {
                        const isMe = currentUser && r.recipient_id === currentUser.id
                        return (
                          <div key={r.id} className="contract-doc-row muted">
                            <span className="contract-doc-title">
                              {r.name} {r.recipient_id ? '' : '(external)'}
                            </span>
                            {isMe && r.status === 'pending' ? (
                              <a className="btn-ghost" href={r.signing_url} target="_blank" rel="noopener noreferrer">
                                Sign now
                              </a>
                            ) : (
                              <span className="chip small">{r.status}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {signatureRequests.length === 0 && <p className="muted">No signature requests sent yet.</p>}
              </div>

              <div className={`cd-collapsible ${showSign ? 'is-open' : ''}`}>
              <form onSubmit={handleSendForSignature} className="contract-doc-upload-row">
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

              <div className="contract-doc-history" style={{ marginTop: 8 }}>
                <span className="muted contract-doc-meta">Staff recipients:</span>
                {assignments.map((a) => (
                  <label key={a.user_id} className="field" style={{ display: 'inline-flex', gap: 4, marginRight: 12 }}>
                    <input
                      type="checkbox"
                      checked={sigStaffIds.includes(a.user_id)}
                      onChange={() => toggleSigStaff(a.user_id)}
                    />
                    <span>{userName(a.user_id)}</span>
                  </label>
                ))}
              </div>

              <div className="contract-doc-history" style={{ marginTop: 8 }}>
                <span className="muted contract-doc-meta">External signers:</span>
                {externalRecipients.map((r, i) => (
                  <span key={`${r.email}-${i}`} className="chip small" style={{ marginRight: 8 }}>
                    {r.name} ({r.email}){' '}
                    <button type="button" className="icon-btn" onClick={() => handleRemoveExternalRecipient(i)} aria-label={`Remove ${r.name}`}>
                      <IconTrash />
                    </button>
                  </span>
                ))}
                <form className="contract-doc-upload-row" style={{ marginTop: 6 }} onSubmit={handleAddExternalRecipient}>
                  <input
                    type="text"
                    aria-label="External signer name"
                    placeholder="External signer name…"
                    value={externalName}
                    onChange={(e) => setExternalName(e.target.value)}
                  />
                  <input
                    type="email"
                    aria-label="External signer email"
                    placeholder="External signer email…"
                    value={externalEmail}
                    onChange={(e) => setExternalEmail(e.target.value)}
                  />
                  <button type="submit" className="btn-ghost">
                    Add signer
                  </button>
                </form>
              </div>
              </div>
              {sigError && <p className="contract-error" aria-live="polite">{sigError}</p>}
            </section>

            <section className="card cd-sec" data-sec="tasks" style={{ marginTop: 16 }}>
              <div className="card-header">
                <h2>Tasks</h2>
                <button
                  type="button"
                  className="btn-ghost cd-add-toggle"
                  aria-expanded={showAddTask}
                  onClick={() => setShowAddTask((v) => !v)}
                >
                  {showAddTask ? 'Close' : 'Add task'}
                </button>
              </div>

              <div className="list-rows">
                {tasks.map((t) => (
                  <div key={t.id} className="contract-task-row">
                    <div className="contract-task-main">
                      <span className="contract-task-title">{t.title}</span>
                      <span className="muted contract-task-meta">
                        {t.assigned_to ? userName(t.assigned_to) : 'Unassigned'}
                        {t.due_date ? ` · Due ${new Date(t.due_date).toLocaleDateString()}` : ''}
                      </span>
                    </div>
                    <select
                      aria-label={`Status for task ${t.title}`}
                      value={t.status}
                      disabled={taskBusyId === t.id}
                      onChange={(e) => handleTaskStatusChange(t, e.target.value as TaskStatus)}
                      style={{ color: taskStatusColor[t.status], background: `rgba(${taskStatusColorRgb[t.status]}, 0.13)` }}
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

              <form onSubmit={handleCreateTask} className={`contract-task-add-row cd-collapsible ${showAddTask ? 'is-open' : ''}`}>
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
              {taskError && <p className="contract-error" aria-live="polite">{taskError}</p>}
            </section>

            <section className="card cd-sec" data-sec="messages" style={{ marginTop: 16 }}>
              <div className="card-header">
                <h2>Messages</h2>
              </div>

              <div className="contract-messages-list">
                {messages.map((m) => (
                  <div key={m.id} className="contract-message-row">
                    <div className="contract-message-meta">
                      <span className="contract-message-author">{m.author_name}</span>
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
                    <p className="contract-message-body">{m.body}</p>
                  </div>
                ))}
                {messages.length === 0 && <p className="muted">No messages yet.</p>}
              </div>

              <form onSubmit={handleSendMessage} className="contract-message-compose-row cd-compose">
                <textarea
                  rows={2}
                  aria-label="Message"
                  placeholder="Write an internal note…"
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                />
                <button type="submit" className="btn-ghost" disabled={sendingMessage}>
                  <IconSend /> {sendingMessage ? 'Sending…' : 'Send'}
                </button>
              </form>
              {messageError && <p className="contract-error" aria-live="polite">{messageError}</p>}
            </section>
          </div>

          <div className="cd-col">
            <section className="card cd-sec cd-details" data-sec="overview">
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
                  {detailsError && <p className="contract-error" aria-live="polite">{detailsError}</p>}
                  <div className="contract-actions" style={{ marginTop: 8 }}>
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
                  <p className="muted">Opened: {new Date(contract.created_at).toLocaleDateString()}</p>
                  <p className="contract-detail-description">{contract.description || 'No description provided.'}</p>
                </>
              )}
            </section>

            <section className="card cd-sec cd-status" data-sec="overview" style={{ marginTop: 16 }}>
              <div className="card-header">
                <h2>Status</h2>
              </div>
              <div className="contract-detail-field-row">
                <select
                  aria-label="Contract status"
                  value={statusValue}
                  onChange={(e) => setStatusValue(e.target.value as Contract['status'])}
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
                  disabled={statusSaving || statusValue === contract.status || Boolean(pendingApproval)}
                  onClick={statusChangeIsGated ? handleRequestApproval : handleStatusSave}
                >
                  {statusSaving ? 'Saving…' : statusChangeIsGated ? 'Request Approval' : 'Save'}
                </button>
              </div>
              {approvalError && <p className="contract-error" aria-live="polite">{approvalError}</p>}

              {pendingApproval && (
                <div className="contract-detail-toggle-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                  <span className="muted">
                    Approval pending: {pendingApproval.from_status} &rarr; {pendingApproval.to_status}, requested by{' '}
                    {userName(pendingApproval.requested_by)} on {new Date(pendingApproval.created_at).toLocaleDateString()}
                  </span>
                  {canDecideApprovals && (
                    <div className="contract-actions">
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

              <p className="muted cd-deadline-label" style={{ margin: '12px 0 4px' }}>
                Deadline
              </p>
              <div className="contract-detail-field-row">
                <input
                  type="date"
                  value={deadlineValue}
                  onChange={(e) => setDeadlineValue(e.target.value)}
                  aria-label="Contract deadline"
                />
                <button
                  type="button"
                  className="btn-solid"
                  disabled={deadlineSaving || deadlineValue === (contract.due_date ?? '')}
                  onClick={handleDeadlineSave}
                >
                  {deadlineSaving ? 'Saving…' : 'Save deadline'}
                </button>
              </div>
            </section>

            <section className="card cd-sec cd-staff" data-sec="overview" style={{ marginTop: 16 }}>
              <div className="card-header">
                <h2>Staff Assigned</h2>
                <button
                  type="button"
                  className="btn-ghost cd-add-toggle"
                  aria-expanded={showAssign}
                  onClick={() => setShowAssign((v) => !v)}
                >
                  {showAssign ? 'Close' : 'Assign'}
                </button>
              </div>
              <div className="list-rows">
                {assignments.map((a) => (
                  <div key={a.id} className="assignment-row">
                    <span>{userName(a.user_id)}</span>
                    <span className="muted">{roleOptions.find((r) => r.value === a.role_on_contract)?.label}</span>
                  </div>
                ))}
                {assignments.length === 0 && <p className="muted">No staff assigned yet.</p>}
              </div>

              <div className={`assignment-add-row cd-collapsible ${showAssign ? 'is-open' : ''}`}>
                <select aria-label="Staff member to assign" value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
                  <option value="">Select staff member</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Role on contract"
                  value={assignRole}
                  onChange={(e) => {
                    setAssignRole(e.target.value as ContractRole)
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
              {assignError && <p className="contract-error" aria-live="polite">{assignError}</p>}
            </section>
          </div>
        </div>
        </>
      )}

      {moreOpen && contract && (
        <div className="cd-sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div
            className="cd-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More actions"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && setMoreOpen(false)}
          >
            <div className="cd-sheet-grip" aria-hidden="true" />
            <h2 className="cd-sheet-title">More actions</h2>
            {(
              [
                ['Edit details', () => startEditDetails()],
                ['Add a task', () => { setTab('tasks'); setShowAddTask(true) }],
                ['Upload a document', () => { setTab('documents'); setShowUpload(true) }],
                ['Send for signature', () => { setTab('documents'); setShowSign(true) }],
                ['Assign staff', () => { setTab('overview'); setShowAssign(true) }],
              ] as [string, () => void][]
            ).map(([label, action]) => (
              <button
                key={label}
                type="button"
                className="cd-sheet-item"
                autoFocus={label === 'Edit details'}
                onClick={() => {
                  action()
                  setMoreOpen(false)
                }}
              >
                {label}
              </button>
            ))}
            <Link to="/staff/contracts" className="cd-sheet-item">
              Back to all contracts
            </Link>
            <button type="button" className="btn-ghost cd-sheet-close" onClick={() => setMoreOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

export default ContractDetail
