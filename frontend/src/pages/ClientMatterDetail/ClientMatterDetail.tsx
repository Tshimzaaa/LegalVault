import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '../MatterDetail/MatterDetail.css'
import ProfileMenu from '../../components/ProfileMenu'
import { IconDownload, IconSend, IconTrash } from '../../components/icons'
import type { ClientContact } from '../../api/clientAuth'
import {
  listClientMatters,
  listClientMatterDocuments,
  uploadClientMatterDocument,
  getClientMatterDocumentDownloadUrl,
  listClientMessages,
  createClientMessage,
  deleteClientMessage,
} from '../../api/clientMatters'
import type { Matter, MatterStatus, MatterDocument, MatterMessage } from '../../api/matters'
import { listMyPendingClientSignatures } from '../../api/signatures'
import type { SignatureRequest } from '../../api/signatures'

type LoadState = 'loading' | 'error' | 'ready'

const statusLabel: Record<MatterStatus, string> = {
  intake: 'Intake',
  in_review: 'In Review',
  awaiting_signature: 'Awaiting Signature',
  signed: 'Signed',
  closed: 'Closed',
  declined: 'Declined',
}

const statusColor: Record<MatterStatus, string> = {
  intake: '#eab308',
  in_review: '#3987e5',
  awaiting_signature: '#a855f7',
  signed: '#199e70',
  closed: '#22c55e',
  declined: '#ef4444',
}

interface ClientMatterDetailProps {
  contact: ClientContact
  onLogout: () => void
}

function ClientMatterDetail({ contact, onLogout }: ClientMatterDetailProps) {
  const { matterId } = useParams<{ matterId: string }>()
  const navigate = useNavigate()

  const [matter, setMatter] = useState<Matter | null>(null)
  const [documents, setDocuments] = useState<MatterDocument[]>([])
  const [pendingSignatures, setPendingSignatures] = useState<SignatureRequest[]>([])
  const [status, setStatus] = useState<LoadState>('loading')

  const [docTitle, setDocTitle] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

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
      listClientMatters(token),
      listClientMatterDocuments(token, matterId),
      listClientMessages(token, matterId),
      listMyPendingClientSignatures(token).catch(() => []),
    ])
      .then(([matters, docs, msgs, sigs]) => {
        const found = matters.find((m) => m.id === matterId) ?? null
        if (!found) {
          setStatus('error')
          return
        }
        setMatter(found)
        setDocuments(docs)
        setMessages(msgs)
        setPendingSignatures(sigs.filter((s) => s.matter_id === matterId))
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }

  async function handleSendMessage(e: FormEvent) {
    e.preventDefault()
    if (!token || !matterId || !messageBody.trim()) return
    setMessageError(null)
    setSendingMessage(true)
    try {
      const created = await createClientMessage(token, matterId, messageBody.trim())
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
      await deleteClientMessage(token, matterId, message.id)
      setMessages((prev) => prev.filter((m) => m.id !== message.id))
    } finally {
      setMessageBusyId(null)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId])

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
      const uploaded = await uploadClientMatterDocument(token, matterId, docTitle, docFile)
      setDocuments((prev) => [...prev, uploaded])
      setDocTitle('')
      setDocFile(null)
      const fileInput = document.getElementById('client-matter-doc-file') as HTMLInputElement | null
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
      const url = await getClientMatterDocumentDownloadUrl(token, matterId, documentId)
      window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloadingId(null)
    }
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
          <button type="button" className="matter-detail-back" onClick={() => navigate('/client/workflow')}>
            &larr; Back to Workflow
          </button>
          <h1>{matter?.title ?? 'Matter'}</h1>
        </div>
        <div className="topbar-actions">
          {matter && (
            <span
              className="status-badge"
              style={{ color: statusColor[matter.status], background: `${statusColor[matter.status]}22` }}
            >
              {statusLabel[matter.status]}
            </span>
          )}
          <ProfileMenu user={contact} onLogout={onLogout} />
        </div>
      </header>

      {status === 'loading' && (
        <div className="dash-state">
          <span className="dash-spinner" />
          <p>Loading matter…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t load this matter.</p>
          <button type="button" className="btn-ghost" onClick={loadAll}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && matter && (
        <div className="matter-detail-grid">
          <section className="card">
            <div className="card-header">
              <span>Details</span>
            </div>
            <p className="muted">Opened: {new Date(matter.created_at).toLocaleDateString()}</p>
            <p className="matter-detail-description">{matter.description || 'No description provided.'}</p>
          </section>

          {pendingSignatures.length > 0 && (
            <section className="card">
              <div className="card-header">
                <span>Awaiting Your Signature</span>
              </div>
              <div className="list-rows">
                {pendingSignatures.map((sr) => {
                  const myRecipient = sr.recipients.find((r) => r.recipient_type === 'client_contact' && r.recipient_id === contact.id)
                  return (
                    <div key={sr.id} className="matter-doc-row">
                      <span className="matter-doc-title">{sr.title}</span>
                      {myRecipient && myRecipient.status === 'pending' && (
                        <a
                          className="btn-ghost"
                          href={myRecipient.signing_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Sign now
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          <section className="card">
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
              {documentGroups.length === 0 && <p className="muted">No documents shared on this matter yet.</p>}
            </div>

            <form onSubmit={handleUpload} className="matter-doc-upload-row">
              <input
                type="text"
                placeholder="Document title (reuse a title to add a new version)"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                list="client-matter-doc-titles"
                required
              />
              <datalist id="client-matter-doc-titles">
                {documentGroups.map((versions) => (
                  <option key={versions[0].title} value={versions[0].title} />
                ))}
              </datalist>
              <input
                id="client-matter-doc-file"
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.txt"
                required
              />
              <button type="submit" className="btn-ghost" disabled={uploading}>
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </form>
            {uploadError && <p className="matter-error">{uploadError}</p>}
          </section>

          <section className="card">
            <div className="card-header">
              <span>Messages</span>
            </div>

            <div className="matter-messages-list">
              {messages.map((m) => (
                <div key={m.id} className="matter-message-row">
                  <div className="matter-message-meta">
                    <span className="matter-message-author">
                      {m.author_name}
                      {m.author_type === 'staff' ? ' (firm)' : ''}
                    </span>
                    <span className="muted">{new Date(m.created_at).toLocaleString()}</span>
                    {m.author_type === 'client_contact' && (
                      <button
                        type="button"
                        className="icon-btn"
                        disabled={messageBusyId === m.id}
                        onClick={() => handleDeleteMessage(m)}
                        aria-label="Delete message"
                      >
                        <IconTrash />
                      </button>
                    )}
                  </div>
                  <p className="matter-message-body">{m.body}</p>
                </div>
              ))}
              {messages.length === 0 && <p className="muted">No messages yet.</p>}
            </div>

            <form onSubmit={handleSendMessage} className="matter-message-compose-row">
              <input
                type="text"
                placeholder="Write a message to the firm…"
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
      )}
    </main>
  )
}

export default ClientMatterDetail
