import { useEffect, useState } from 'react'
import type { DragEvent } from 'react'
import { Link } from 'react-router-dom'
import './Workflow.css'
import { IconPlus } from '../../components/icons'
import { listMatters, updateMatterStatus, requestMatterApproval, listPendingApprovals, isGatedTransition, MATTER_STATUS_TRANSITIONS } from '../../api/matters'
import type { Matter, MatterStatus, MatterApproval } from '../../api/matters'
import { listClients } from '../../api/clients'
import type { Client } from '../../api/clients'
import { formatDate } from '../../utils/date'

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
  const [matters, setMatters] = useState<Matter[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<MatterApproval[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<MatterStatus | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    const token = localStorage.getItem('access_token')
    if (!token) {
      setStatus('error')
      return
    }

    Promise.all([listMatters(token), listClients(token), listPendingApprovals(token)])
      .then(([matterList, clientList, approvalList]) => {
        if (cancelled) return
        setMatters(matterList)
        setClients(clientList)
        setPendingApprovals(approvalList)
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

  function isValidTarget(matter: Matter, targetStatus: MatterStatus) {
    return MATTER_STATUS_TRANSITIONS[matter.status].includes(targetStatus)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, targetStatus: MatterStatus) {
    const matter = matters.find((m) => m.id === draggingId)
    if (!matter || !isValidTarget(matter, targetStatus)) return // no preventDefault -> browser shows "not allowed"
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStatus(targetStatus)
  }

  async function moveMatter(matter: Matter, targetStatus: MatterStatus) {
    if (matter.status === targetStatus || !isValidTarget(matter, targetStatus)) return

    const token = localStorage.getItem('access_token')
    if (!token) return

    setMoveError(null)

    if (isGatedTransition(matter.status, targetStatus)) {
      // Status doesn't move yet — the card stays in its current column until an eligible
      // approver decides on the request from the matter's detail page.
      try {
        const approval = await requestMatterApproval(token, matter.id, targetStatus)
        setPendingApprovals((prev) => [...prev, approval])
      } catch {
        // Most likely: an approval is already pending for this matter. Nothing to roll
        // back since nothing moved.
        setMoveError(`Could not request approval for "${matter.title}". It may already have one pending.`)
      }
      return
    }

    const previousStatus = matter.status
    setMatters((prev) => prev.map((m) => (m.id === matter.id ? { ...m, status: targetStatus } : m)))

    try {
      await updateMatterStatus(token, matter.id, targetStatus)
    } catch {
      setMatters((prev) => prev.map((m) => (m.id === matter.id ? { ...m, status: previousStatus } : m)))
      setMoveError(`Could not move "${matter.title}". Please try again.`)
    }
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>, targetStatus: MatterStatus) {
    e.preventDefault()
    const matterId = e.dataTransfer.getData('text/plain')
    setDragOverStatus(null)
    setDraggingId(null)

    const matter = matters.find((m) => m.id === matterId)
    if (!matter) return
    await moveMatter(matter, targetStatus)
  }

  return (
    <main className="dash-main workflow-main">
      <header className="dash-topbar">
        <h1>Workflow</h1>
        <div className="topbar-actions">
          <span className="chip">
            Total Matters <span className="chip-badge">{matters.length}</span>
          </span>
          <Link to="/staff/new-matter" className="btn-solid">
            <IconPlus /> New Matter
          </Link>
        </div>
      </header>

      {moveError && (
        <p className="matter-error" role="alert" aria-live="polite">
          {moveError}
        </p>
      )}

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
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
                    >
                      <Link to={`/staff/matters/${m.id}`} className="row-stretched-link" aria-label={`Open matter ${m.title}`} />
                      <span className="workflow-card-title">{m.title}</span>
                      <span className="workflow-card-client">{clientName(m.client_id)}</span>
                      <div className="workflow-card-footer">
                        <span className="deadline-sub">Opened {formatDate(m.created_at)}</span>
                        {pendingApprovals.some((a) => a.matter_id === m.id) && (
                          <span className="chip small">Approval pending</span>
                        )}
                      </div>
                      {MATTER_STATUS_TRANSITIONS[m.status].length > 0 && (
                        <select
                          className="workflow-card-move"
                          aria-label={`Move ${m.title} to a different status`}
                          value=""
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const target = e.target.value as MatterStatus
                            if (target) moveMatter(m, target)
                          }}
                        >
                          <option value="">Move to…</option>
                          {MATTER_STATUS_TRANSITIONS[m.status].map((s) => (
                            <option key={s} value={s}>
                              {columnOrder.find((c) => c.status === s)?.label ?? s}
                            </option>
                          ))}
                        </select>
                      )}
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
