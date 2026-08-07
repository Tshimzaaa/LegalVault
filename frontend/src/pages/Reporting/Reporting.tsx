import { useEffect, useState } from 'react'
import './Reporting.css'
import { listMatters } from '../../api/matters'
import { getDashboardSummary } from '../../api/dashboard'
import { getReportingOverview, downloadMattersCsv } from '../../api/reporting'
import type { ReportingOverview } from '../../api/reporting'

interface OutcomeSlice {
  label: string
  value: number
  color: string
}

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
        {segments.map((s, i) => (
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
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
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
        {data.length === 0 && <p className="muted">No matters yet.</p>}
      </div>
    </div>
  )
}

function StaffWorkloadTable({ overview }: { overview: ReportingOverview | null }) {
  const rows = overview?.staff_workload ?? []

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Staff</th>
          <th>Active</th>
          <th>Open tasks</th>
          <th>Overdue</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.user_id}>
            <td>{r.name}</td>
            <td className="muted tabular">{r.active_matters}</td>
            <td className="muted tabular">{r.open_tasks}</td>
            <td className="muted tabular" style={{ color: r.overdue_tasks > 0 ? '#ef4444' : undefined }}>
              {r.overdue_tasks}
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={4} className="muted">
              No staff assigned to matters yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

function Reporting() {
  const [activeMatters, setActiveMatters] = useState<number | null>(null)
  const [caseOutcomes, setCaseOutcomes] = useState<OutcomeSlice[]>([])
  const [overview, setOverview] = useState<ReportingOverview | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    listMatters(token)
      .then((matters) => setActiveMatters(matters.filter((m) => m.status !== 'closed' && m.status !== 'declined').length))
      .catch(() => setActiveMatters(null))

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
      await downloadMattersCsv(token)
    } catch {
      setExportError('Could not export matters.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Reporting</h1>
        <div className="topbar-actions">
          {exportError && <span className="matter-error">{exportError}</span>}
          <button type="button" className="btn-ghost" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export matters (CSV)'}
          </button>
        </div>
      </header>

      <section className="dash-row reporting-stats">
        <div className="card">
          <div className="card-header">
            <span>Active matters</span>
          </div>
          <div className="stat-line">
            <span className="stat-big">{activeMatters ?? '—'}</span>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span>Unassigned active matters</span>
          </div>
          <div className="stat-line">
            <span className="stat-big">{overview?.unassigned_active_matters ?? '—'}</span>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span>Open tasks</span>
          </div>
          <div className="stat-line">
            <span className="stat-big">{overview?.open_tasks ?? '—'}</span>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span>Overdue tasks</span>
          </div>
          <div className="stat-line">
            <span className="stat-big" style={{ color: overview && overview.overdue_tasks > 0 ? '#ef4444' : undefined }}>
              {overview?.overdue_tasks ?? '—'}
            </span>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span>Deadlines (7 days)</span>
          </div>
          <div className="stat-line">
            <span className="stat-big">{overview?.upcoming_deadlines_7_days ?? '—'}</span>
          </div>
        </div>
      </section>

      <section className="dash-row reporting-charts">
        <div className="card reporting-chart-card">
          <div className="card-header">
            <span>Case Outcomes</span>
          </div>
          <span className="card-subtitle">by matter status</span>
          <CaseOutcomesDonut data={caseOutcomes} />
        </div>

        <div className="card reporting-chart-card">
          <div className="card-header">
            <span>Staff Workload</span>
          </div>
          <span className="card-subtitle">active matters &amp; tasks, by assignee</span>
          <StaffWorkloadTable overview={overview} />
        </div>
      </section>
    </main>
  )
}

export default Reporting
