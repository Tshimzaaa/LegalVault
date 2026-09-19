import { useEffect, useRef, useState } from 'react'
import '../../styles/dashboard.css'
import './Reporting.css'
import { listContracts } from '../../api/contracts'
import { getDashboardSummary } from '../../api/dashboard'
import { getReportingOverview, downloadContractsCsv } from '../../api/reporting'
import type { ReportingOverview } from '../../api/reporting'
import { updateStaffCapacity } from '../../api/auth'
import type { User } from '../../api/auth'
import { IconX } from '../../components/icons'

interface OutcomeSlice {
  label: string
  value: number
  color: string
}

const numberFormat = new Intl.NumberFormat()

function CaseOutcomesDonut({ data }: { data: OutcomeSlice[] }) {
  const size = 148
  const stroke = 22
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const [hover, setHover] = useState<number | null>(null)

  let cumulative = 0
  const segments = data.map((d) => {
    const fraction = d.value / total
    const dash = Math.max(fraction * circumference - 2, 0)
    const rotate = (cumulative / total) * 360 - 90
    cumulative += d.value
    return { ...d, dash, rotate }
  })

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const segmentPercent = Math.round((s.value / total) * 100)
          return (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={hover === i ? stroke + 3 : stroke}
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeLinecap="butt"
              transform={`rotate(${s.rotate} ${size / 2} ${size / 2})`}
              className="donut-segment"
              tabIndex={0}
              role="img"
              aria-label={`${s.label}: ${segmentPercent}%`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          )
        })}
        <text x="50%" y="46%" textAnchor="middle" className="donut-center-value">
          {data.length > 0 ? total : 0}
        </text>
        <text x="50%" y="62%" textAnchor="middle" className="donut-center-label">
          cases
        </text>
      </svg>

      <div className="donut-legend">
        {data.map((d, i) => (
          <div key={d.label} className={`donut-legend-row${hover === i ? ' active' : ''}`}>
            <span className="status-dot" style={{ background: d.color }} />
            <span className="donut-legend-label">{d.label}</span>
            <span className="donut-legend-value">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
        {data.length === 0 && <p className="muted">No contracts yet.</p>}
      </div>
    </div>
  )
}

function UtilizationBar({ percent }: { percent: number }) {
  const color = percent >= 100 ? '#ef4444' : percent >= 80 ? '#eab308' : '#22c55e'
  const overloaded = percent > 100
  return (
    <div
      className="progress-track utilization-bar"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={overloaded ? `${percent}%, overloaded` : undefined}
    >
      <span className="progress-fill" style={{ width: `${Math.min(percent, 100)}%`, background: color }} />
    </div>
  )
}

function StaffWorkloadTable({
  overview,
  canEditCapacity,
  onUpdateCapacity,
}: {
  overview: ReportingOverview | null
  canEditCapacity: boolean
  onUpdateCapacity: (userId: string, weeklyCapacityHours: number | null) => void
}) {
  const rows = overview?.staff_workload ?? []
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  function startEdit(r: ReportingOverview['staff_workload'][number]) {
    setEditingId(r.user_id)
    setDraft(r.weekly_capacity_hours != null ? String(r.weekly_capacity_hours) : '')
  }

  function focusTrigger(userId: string) {
    triggerRefs.current[userId]?.focus()
  }

  function cancelEdit(userId: string) {
    setEditingId(null)
    focusTrigger(userId)
  }

  function saveEdit(userId: string) {
    const trimmed = draft.trim()
    if (trimmed === '') {
      onUpdateCapacity(userId, null)
      setEditingId(null)
      focusTrigger(userId)
      return
    }
    const parsed = Number(trimmed)
    if (Number.isNaN(parsed)) {
      // Invalid input — leave the stored capacity untouched.
      setEditingId(null)
      focusTrigger(userId)
      return
    }
    const clamped = Math.min(168, Math.max(0, parsed))
    onUpdateCapacity(userId, clamped)
    setEditingId(null)
    focusTrigger(userId)
  }

  return (
    <div className="table-scroll">
    <table className="data-table data-table-list reporting-workload" role="table">
      <thead role="rowgroup">
        <tr role="row">
          <th role="columnheader">Staff</th>
          <th role="columnheader">Active</th>
          <th role="columnheader">Open tasks</th>
          <th role="columnheader">Overdue</th>
          <th role="columnheader">Weekly capacity</th>
          <th role="columnheader">Utilization</th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {rows.map((r) => (
          <tr key={r.user_id} role="row">
            <td role="cell">{r.name}</td>
            <td role="cell" data-label="Active" className="muted tabular">{r.active_contracts}</td>
            <td role="cell" data-label="Open tasks" className="muted tabular">{r.open_tasks}</td>
            <td role="cell" data-label="Overdue" className="muted tabular" style={{ color: r.overdue_tasks > 0 ? '#ef4444' : undefined }}>
              {r.overdue_tasks}
            </td>
            <td role="cell" data-label="Capacity" className="tabular">
              {editingId === r.user_id ? (
                <span className="capacity-edit-wrap">
                  <input
                    type="number"
                    min={0}
                    max={168}
                    step={0.5}
                    className="capacity-input"
                    aria-label={`Weekly capacity for ${r.name}`}
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => saveEdit(r.user_id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(r.user_id)
                      if (e.key === 'Escape') cancelEdit(r.user_id)
                    }}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Cancel editing capacity for ${r.name}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => cancelEdit(r.user_id)}
                  >
                    <IconX />
                  </button>
                </span>
              ) : canEditCapacity ? (
                <button
                  type="button"
                  className="capacity-edit-btn"
                  ref={(el) => {
                    triggerRefs.current[r.user_id] = el
                  }}
                  onClick={() => startEdit(r)}
                >
                  {r.weekly_capacity_hours != null ? `${r.weekly_capacity_hours}h/wk` : 'Set capacity'}
                </button>
              ) : (
                <span className="muted">{r.weekly_capacity_hours != null ? `${r.weekly_capacity_hours}h/wk` : 'Not set'}</span>
              )}
            </td>
            <td role="cell" data-label="Utilization" data-full className="tabular">
              {r.utilization_percent != null ? (
                <>
                  <UtilizationBar percent={r.utilization_percent} />
                  <span className="muted">{r.utilization_percent}%</span>
                </>
              ) : (
                <span className="muted">—</span>
              )}
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr role="row">
            <td role="cell" colSpan={6} className="muted">
              No staff assigned to contracts yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
    </div>
  )
}

interface ReportingProps {
  user?: User
}

function Reporting({ user }: ReportingProps) {
  const [activeContracts, setActiveContracts] = useState<number | null>(null)
  const [caseOutcomes, setCaseOutcomes] = useState<OutcomeSlice[]>([])
  const [overview, setOverview] = useState<ReportingOverview | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function handleUpdateCapacity(userId: string, weeklyCapacityHours: number | null) {
    const token = localStorage.getItem('access_token')
    if (!token) return
    try {
      await updateStaffCapacity(token, userId, weeklyCapacityHours)
      getReportingOverview(token).then(setOverview).catch(() => {})
    } catch {
      // Silently ignored — the input reverts to the last-known value on the next overview refresh.
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    listContracts(token)
      .then((contracts) => setActiveContracts(contracts.filter((m) => m.status !== 'closed' && m.status !== 'declined').length))
      .catch(() => setActiveContracts(null))

    getDashboardSummary(token)
      .then((summary) => {
        const breakdown = summary.contractStatus.breakdown
          .filter((b) => b.count > 0)
          .map((b) => ({ label: b.label, value: b.count, color: b.color }))
        if (breakdown.length > 0) setCaseOutcomes(breakdown)
      })
      .catch(() => {})

    getReportingOverview(token).then(setOverview).catch(() => setOverview(null))
  }, [])

  async function handleExport() {
    const token = localStorage.getItem('access_token')
    if (!token) return
    setExportError(null)
    setExporting(true)
    try {
      await downloadContractsCsv(token)
    } catch {
      setExportError('Could not export contracts.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="dash-main">
      <header className="dash-topbar m-header">
        <h1>Reporting</h1>
        <div className="topbar-actions">
          {exportError && <span className="contract-error" aria-live="polite">{exportError}</span>}
          <button type="button" className="btn-ghost" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export contracts (CSV)'}
          </button>
        </div>
      </header>

      <section className="dash-row reporting-stats m-stats">
        <div className="card">
          <div className="card-header">
            <span>Active contracts</span>
          </div>
          <div className="stat-line">
            <span className="stat-big">{activeContracts !== null ? numberFormat.format(activeContracts) : 'N/A'}</span>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span>Unassigned active contracts</span>
          </div>
          <div className="stat-line">
            <span className="stat-big">
              {overview ? numberFormat.format(overview.unassigned_active_contracts) : 'N/A'}
            </span>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span>Open tasks</span>
          </div>
          <div className="stat-line">
            <span className="stat-big">{overview ? numberFormat.format(overview.open_tasks) : 'N/A'}</span>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span>Overdue tasks</span>
          </div>
          <div className="stat-line">
            <span className="stat-big" style={{ color: overview && overview.overdue_tasks > 0 ? '#ef4444' : undefined }}>
              {overview ? numberFormat.format(overview.overdue_tasks) : 'N/A'}
            </span>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span>Deadlines (7 days)</span>
          </div>
          <div className="stat-line">
            <span className="stat-big">
              {overview ? numberFormat.format(overview.upcoming_deadlines_7_days) : 'N/A'}
            </span>
          </div>
        </div>
      </section>

      <section className="dash-row reporting-charts">
        <div className="card reporting-chart-card">
          <div className="card-header">
            <span>Case Outcomes</span>
          </div>
          <span className="card-subtitle">by contract status</span>
          <CaseOutcomesDonut data={caseOutcomes} />
        </div>

        <div className="card reporting-chart-card">
          <div className="card-header">
            <span>Staff Workload</span>
          </div>
          <span className="card-subtitle">active contracts &amp; tasks, by assignee</span>
          <StaffWorkloadTable
            overview={overview}
            canEditCapacity={user?.role === 'admin'}
            onUpdateCapacity={handleUpdateCapacity}
          />
        </div>
      </section>
    </main>
  )
}

export default Reporting
