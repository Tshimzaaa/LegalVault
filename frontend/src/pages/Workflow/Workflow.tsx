import { useEffect, useState } from 'react'
import type { DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import './Workflow.css'
import { IconPlus } from '../../components/icons'
import { listMatters, updateMatterStatus } from '../../api/matters'
import type { Matter, MatterStatus } from '../../api/matters'
import { listClients } from '../../api/clients'
import type { Client } from '../../api/clients'

type LoadState = 'loading' | 'error' | 'ready'

const columnOrder: { status: MatterStatus; label: string; color: string }[] = [
  { status: 'intake', label: 'Intake', color: '#eab308' },
  { status: 'in_review', label: 'In Review', color: '#3987e5' },
  { status: 'awaiting_signature', label: 'Awaiting Signature', color: '#a855f7' },
  { status: 'signed', label: 'Signed', color: '#199e70' },
  { status: 'closed', label: 'Closed', color: '#22c55e' },
  { status: 'declined', label: 'Declined', color: '#ef4444' },
]

function Workflow() {
  const navigate = useNavigate()
  const [matters, setMatters] = useState<Matter[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<MatterStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    const token = localStorage.getItem('access_token')
    if (!token) {
      setStatus('error')
      return
    }

    Promise.all([listMatters(token), listClients(token)])
      .then(([matterList, clientList]) => {
        if (cancelled) return
        setMatters(matterList)
        setClients(clientList)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [attempt])

  function clientName(clientId: string) {
    return clients.find((c) => c.id === clientId)?.company_name ?? 'Unknown client'
  }

  function handleDragStart(e: DragEvent<HTMLDivElement>, matterId: string) {
    e.dataTransfer.setData('text/plain', matterId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(matterId)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOverStatus(null)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, targetStatus: MatterStatus) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStatus(targetStatus)
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>, targetStatus: MatterStatus) {
    e.preventDefault()
    const matterId = e.dataTransfer.getData('text/plain')
    setDragOverStatus(null)
    setDraggingId(null)

    const matter = matters.find((m) => m.id === matterId)
    if (!matter || matter.status === targetStatus) return

    const previousStatus = matter.status
    setMatters((prev) => prev.map((m) => (m.id === matterId ? { ...m, status: targetStatus } : m)))

    const token = localStorage.getItem('access_token')
    if (!token) return

    try {
      await updateMatterStatus(token, matterId, targetStatus)
    } catch {
      setMatters((prev) => prev.map((m) => (m.id === matterId ? { ...m, status: previousStatus } : m)))
    }
  }

  return (
    <main className="dash-main workflow-main">
      <header className="dash-topbar">
        <h1>Workflow</h1>
        <div className="topbar-actions">
          <span className="chip">
            Total Matters <span className="chip-badge">{matters.length}</span>
          </span>
          <button type="button" className="btn-solid" onClick={() => navigate('/staff/new-matter')}>
            <IconPlus /> New Matter
          </button>
        </div>
      </header>

      {status === 'loading' && (
        <div className="dash-state">
          <span className="dash-spinner" />
          <p>Loading matters…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for your matters.</p>
          <button type="button" className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <section className="workflow-board">
          {columnOrder.map((col) => {
            const cards = matters.filter((m) => m.status === col.status)
            return (
              <div
                key={col.status}
                className={`workflow-column${dragOverStatus === col.status ? ' drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, col.status)}
                onDragLeave={() => setDragOverStatus((s) => (s === col.status ? null : s))}
                onDrop={(e) => handleDrop(e, col.status)}
              >
                <div className="workflow-column-header">
                  <span className="status-dot" style={{ background: col.color }} />
                  <span className="workflow-column-title">{col.label}</span>
                  <span className="workflow-column-count">{cards.length}</span>
                </div>

                <div className="workflow-column-body">
                  {cards.map((m) => (
                    <div
                      key={m.id}
                      className={`card workflow-card${draggingId === m.id ? ' dragging' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, m.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => navigate(`/staff/matters/${m.id}`)}
                    >
                      <span className="workflow-card-title">{m.title}</span>
                      <span className="workflow-card-client">{clientName(m.client_id)}</span>
                      <div className="workflow-card-footer">
                        <span className="deadline-sub">Opened {new Date(m.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && dragOverStatus === col.status && (
                    <div className="workflow-drop-placeholder" />
                  )}
                  {cards.length === 0 && dragOverStatus !== col.status && (
                    <p className="muted workflow-empty-col">Nothing here yet.</p>
                  )}
                </div>
              </div>
            )
          })}
        </section>
      )}
    </main>
  )
}

export default Workflow
