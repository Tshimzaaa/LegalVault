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

const revenueTrend = [
  { month: 'Jan', value: 620 },
  { month: 'Feb', value: 680 },
  { month: 'Mar', value: 750 },
  { month: 'Apr', value: 810 },
  { month: 'May', value: 890 },
  { month: 'Jun', value: 960 },
]

const fallbackCaseOutcomes: OutcomeSlice[] = [
  { label: 'Won', value: 45, color: '#3987e5' },
  { label: 'Settled', value: 30, color: '#199e70' },
  { label: 'Ongoing', value: 15, color: '#c98500' },
  { label: 'Dismissed', value: 10, color: '#008300' },
]

const demoStatTiles = [
  { label: 'Total revenue', value: 'R4.71M', delta: '+8% vs last period', up: true },
  { label: 'Win rate', value: '78%', delta: '+2pts vs last period', up: true },
  { label: 'Avg. case duration', value: '94 days', delta: '-6 days vs last period', up: true },
]

function RevenueLineChart() {
  const width = 300
  const height = 130
  const padding = 8
  const [hover, setHover] = useState<number | null>(null)

  const values = revenueTrend.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const stepX = (width - padding * 2) / (revenueTrend.length - 1)

  const points = revenueTrend.map((d, i) => {
    const x = padding + i * stepX
    const y = height - padding - ((d.value - min) / span) * (height - padding * 2)
    return { x, y, ...d }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`

  return (
    <div className="chart-wrap">
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        onMouseLeave={() => setHover(null)}
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={padding}
            x2={width - padding}
            y1={padding + f * (height - padding * 2)}
            y2={padding + f * (height - padding * 2)}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        ))}

        <path d={areaPath} fill="#22c55e" opacity="0.1" stroke="none" />
        <path d={linePath} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <g key={p.month}>
            <rect
              x={p.x - stepX / 2}
              y={0}
              width={stepX}
              height={height}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            {(hover === i || i === points.length - 1) && (
              <circle cx={p.x} cy={p.y} r="4" fill="#22c55e" stroke="#0b0b0d" strokeWidth="2" />
            )}
          </g>
        ))}

        {hover !== null && (
          <line
            x1={points[hover].x}
            x2={points[hover].x}
            y1={padding}
            y2={height - padding}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />
        )}

        <text x={points[points.length - 1].x} y={points[points.length - 1].y - 10} textAnchor="end" className="chart-end-label">
          R{points[points.length - 1].value}k
        </text>
      </svg>

      <div className="chart-x-axis">
        {revenueTrend.map((d) => (
          <span key={d.month}>{d.month}</span>
        ))}
      </div>

      {hover !== null && (
        <div className="chart-tooltip" style={{ left: `${(points[hover].x / width) * 100}%` }}>
          <strong>R{points[hover].value}k</strong>
          <span>{points[hover].month}</span>
        </div>
      )}
    </div>
  )
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
          {total}
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
  const [caseOutcomes, setCaseOutcomes] = useState<OutcomeSlice[]>(fallbackCaseOutcomes)
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
        {demoStatTiles.map((t) => (
          <div key={t.label} className="card">
            <div className="card-header">
              <span>{t.label}</span>
            </div>
            <div className="stat-line">
              <span className="stat-big">{t.value}</span>
            </div>
            <span className={`stat-delta${t.up ? ' up' : ' down'}`}>{t.delta} (demo data)</span>
          </div>
        ))}
      </section>

      <section className="dash-row reporting-charts">
        <div className="card reporting-chart-card">
          <div className="card-header">
            <span>Revenue Trend</span>
          </div>
          <span className="card-subtitle">last 6 months (demo data)</span>
          <RevenueLineChart />
        </div>

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
