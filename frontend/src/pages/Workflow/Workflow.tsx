import { useEffect, useState } from 'react'
import type { DragEvent } from 'react'
import { Link } from 'react-router-dom'
import './Workflow.css'
import { IconPlus } from '../../components/icons'
import { listContracts, updateContractStage, requestContractApproval, listPendingApprovals, isGatedTransition, CONTRACT_STATUS_TRANSITIONS } from '../../api/contracts'
import type { Contract, ContractStage, ContractApproval } from '../../api/contracts'
import { formatDate } from '../../utils/date'

type LoadState = 'loading' | 'error' | 'ready'

const columnOrder: { status: ContractStage; label: string; color: string }[] = [
  { status: 'intake', label: 'Intake', color: '#eab308' },
  { status: 'in_review', label: 'In Review', color: '#3987e5' },
  { status: 'awaiting_signature', label: 'Awaiting Signature', color: '#a855f7' },
  { status: 'signed', label: 'Signed', color: '#199e70' },
  { status: 'closed', label: 'Closed', color: '#22c55e' },
  { status: 'declined', label: 'Declined', color: '#ef4444' },
]

function Workflow() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<ContractApproval[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<ContractStage | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [activeStage, setActiveStage] = useState<ContractStage>('intake')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    const token = localStorage.getItem('access_token')
    if (!token) {
      setStatus('error')
      return
    }

    Promise.all([listContracts(token), listPendingApprovals(token)])
      .then(([contractList, approvalList]) => {
        if (cancelled) return
        setContracts(contractList)
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

  function handleDragStart(e: DragEvent<HTMLDivElement>, contractId: string) {
    e.dataTransfer.setData('text/plain', contractId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(contractId)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOverStatus(null)
  }

  function isValidTarget(contract: Contract, targetStatus: ContractStage) {
    return CONTRACT_STATUS_TRANSITIONS[contract.status].includes(targetStatus)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, targetStatus: ContractStage) {
    const contract = contracts.find((m) => m.id === draggingId)
    if (!contract || !isValidTarget(contract, targetStatus)) return // no preventDefault -> browser shows "not allowed"
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStatus(targetStatus)
  }

  async function moveContract(contract: Contract, targetStatus: ContractStage) {
    if (contract.status === targetStatus || !isValidTarget(contract, targetStatus)) return

    const token = localStorage.getItem('access_token')
    if (!token) return

    setMoveError(null)

    if (isGatedTransition(contract.status, targetStatus)) {
      // Status doesn't move yet — the card stays in its current column until an eligible
      // approver decides on the request from the contract's detail page.
      try {
        const approval = await requestContractApproval(token, contract.id, targetStatus)
        setPendingApprovals((prev) => [...prev, approval])
      } catch {
        // Most likely: an approval is already pending for this contract. Nothing to roll
        // back since nothing moved.
        setMoveError(`Could not request approval for "${contract.title}". It may already have one pending.`)
      }
      return
    }

    const previousStatus = contract.status
    setContracts((prev) => prev.map((m) => (m.id === contract.id ? { ...m, status: targetStatus } : m)))

    try {
      await updateContractStage(token, contract.id, targetStatus)
    } catch {
      setContracts((prev) => prev.map((m) => (m.id === contract.id ? { ...m, status: previousStatus } : m)))
      setMoveError(`Could not move "${contract.title}". Please try again.`)
    }
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>, targetStatus: ContractStage) {
    e.preventDefault()
    const contractId = e.dataTransfer.getData('text/plain')
    setDragOverStatus(null)
    setDraggingId(null)

    const contract = contracts.find((m) => m.id === contractId)
    if (!contract) return
    await moveContract(contract, targetStatus)
  }

  return (
    <main className="dash-main workflow-main">
      <header className="dash-topbar m-header">
        <h1>Workflow</h1>
        <div className="topbar-actions">
          <span className="chip">
            Total Contracts <span className="chip-badge">{contracts.length}</span>
          </span>
          <Link to="/staff/new-contract" className="btn-solid">
            <IconPlus /> New Contract
          </Link>
        </div>
      </header>

      {moveError && (
        <p className="contract-error" role="alert" aria-live="polite">
          {moveError}
        </p>
      )}

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading contracts…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state" role="status" aria-live="polite">
          <p>Couldn&rsquo;t reach the backend for your contracts.</p>
          <button type="button" className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
        <div className="workflow-stage-tabs" role="group" aria-label="Workflow stage">
          {columnOrder.map((col) => (
            <button
              key={col.status}
              type="button"
              className="workflow-stage-tab"
              aria-pressed={activeStage === col.status}
              onClick={() => setActiveStage(col.status)}
            >
              <span className="status-dot" style={{ background: col.color }} aria-hidden="true" />
              {col.label}
              <span className="workflow-column-count">{contracts.filter((m) => m.status === col.status).length}</span>
            </button>
          ))}
        </div>
        <section className="workflow-board">
          {columnOrder.map((col) => {
            const cards = contracts.filter((m) => m.status === col.status)
            return (
              <div
                key={col.status}
                className={`workflow-column${activeStage === col.status ? ' is-active' : ''}${dragOverStatus === col.status ? ' drag-over' : ''}`}
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
                      <Link to={`/staff/contracts/${m.id}`} className="row-stretched-link" aria-label={`Open contract ${m.title}`} />
                      <span className="workflow-card-title">{m.title}</span>
                      <div className="workflow-card-footer">
                        <span className="deadline-sub">Opened {formatDate(m.created_at)}</span>
                        {pendingApprovals.some((a) => a.contract_id === m.id) && (
                          <span className="chip small">Approval pending</span>
                        )}
                      </div>
                      {CONTRACT_STATUS_TRANSITIONS[m.status].length > 0 && (
                        <select
                          className="workflow-card-move select-input"
                          aria-label={`Move ${m.title} to a different status`}
                          value=""
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const target = e.target.value as ContractStage
                            if (target) moveContract(m, target)
                          }}
                        >
                          <option value="">Move to…</option>
                          {CONTRACT_STATUS_TRANSITIONS[m.status].map((s) => (
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
        </>
      )}
    </main>
  )
}

export default Workflow
