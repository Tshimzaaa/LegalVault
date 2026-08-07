import { useEffect, useState } from 'react'
import './ClientReporting.css'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'
import { listClientMatters } from '../../api/clientMatters'
import type { Matter } from '../../api/matters'
import { listClientSignedContracts } from '../../api/clientSignedContracts'
import type { ContractType } from '../../api/signedContracts'
import { listMySupportRequests } from '../../api/supportRequests'
import type { SupportRequest, SupportRequestType } from '../../api/supportRequests'

interface TrendPoint {
  month: string
  value: number
}

interface OutcomeSlice {
  label: string
  value: number
  color: string
}

interface BarPoint {
  label: string
  value: number
}

const contractTypeLabel: Record<ContractType, string> = {
  nda: 'NDA',
  consultancy: 'Consultancy',
  supplier: 'Supplier',
  general: 'General',
}

const contractTypeColor: Record<ContractType, string> = {
  nda: '#3987e5',
  consultancy: '#199e70',
  supplier: '#c98500',
  general: '#008300',
}

const requestTypeLabel: Record<SupportRequestType, string> = {
  nda: 'NDA',
  consultancy: 'Consultancy',
  supplier: 'Supplier',
  general: 'General',
}

/** Last `count` calendar months, oldest first, as {year, month, label} — used to bucket real records. */
function lastMonths(count: number) {
  const now = new Date()
  const months = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString('en-US', { month: 'short' }) })
  }
  return months
}

/**
 * Active-matter count at the end of each of the last 6 months. We don't keep status history, so
 * this approximates "was it active then" from what we do have: a matter counts as active at a
 * given cutoff if it existed by then, and — if it's currently closed/declined — only if it was
 * still open at that point (using `updated_at` as a proxy for when it closed).
 */
function activeMattersTrend(matters: Matter[]): TrendPoint[] {
  return lastMonths(6).map(({ year, month, label }) => {
    const cutoff = new Date(year, month + 1, 1)
    const count = matters.filter((m) => {
      if (new Date(m.created_at) >= cutoff) return false
      const isClosed = m.status === 'closed' || m.status === 'declined'
      return !isClosed || new Date(m.updated_at) >= cutoff
    }).length
    return { month: label, value: count }
  })
}

function ActiveMattersLineChart({ data }: { data: TrendPoint[] }) {
  const width = 300
  const height = 130
  const padding = 8
  const [hover, setHover] = useState<number | null>(null)

  // Empty on first render, before the matters fetch resolves — every point[] access below
  // assumes at least one entry, so bail out to an empty state rather than crash the page.
  if (data.length === 0) {
    return (
      <div className="chart-wrap">
        <p className="muted">No data yet.</p>
      </div>
    )
  }

  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const stepX = (width - padding * 2) / Math.max(data.length - 1, 1)

  const points = data.map((d, i) => {
    const x = padding + i * stepX
    const y = height - padding - ((d.value - min) / span) * (height - padding * 2)
    return { x, y, ...d }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`

  return (
    <div className="chart-wrap">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} onMouseLeave={() => setHover(null)}>
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
            <rect x={p.x - stepX / 2} y={0} width={stepX} height={height} fill="transparent" onMouseEnter={() => setHover(i)} />
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
          {points[points.length - 1].value}
        </text>
      </svg>

      <div className="chart-x-axis">
        {data.map((d) => (
          <span key={d.month}>{d.month}</span>
        ))}
      </div>

      {hover !== null && (
        <div className="chart-tooltip" style={{ left: `${(points[hover].x / width) * 100}%` }}>
          <strong>{points[hover].value} matters</strong>
          <span>{points[hover].month}</span>
        </div>
      )}
    </div>
  )
}

function ContractDistributionDonut({ data }: { data: OutcomeSlice[] }) {
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
          contracts
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
        {data.length === 0 && <p className="muted">No signed contracts yet.</p>}
      </div>
    </div>
  )
}

function TurnaroundBarChart({ data }: { data: BarPoint[] }) {
  const width = 300
  const height = 140
  const padding = 20
  const [hover, setHover] = useState<number | null>(null)

  const max = Math.max(1, Math.ceil(Math.max(...data.map((d) => d.value), 0)))
  const gridSteps = [0, max / 4, max / 2, (3 * max) / 4, max]
  const barSlot = (width - padding) / Math.max(data.length, 1)
  const barWidth = Math.min(barSlot - 14, 24)

  return (
    <div className="chart-wrap">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} onMouseLeave={() => setHover(null)}>
        {gridSteps.map((g) => {
          const y = height - padding - (g / max) * (height - padding * 2)
          return <line key={g} x1={padding} x2={width} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        })}
        {gridSteps.map((g) => {
          const y = height - padding - (g / max) * (height - padding * 2)
          return (
            <text key={g} x={padding - 6} y={y + 3} textAnchor="end" className="chart-axis-label">
              {g.toFixed(g < 1 ? 1 : 0)}
            </text>
          )
        })}

        {data.map((d, i) => {
          const barHeight = (d.value / max) * (height - padding * 2)
          const x = padding + i * barSlot + (barSlot - barWidth) / 2
          const y = height - padding - barHeight
          const isHover = hover === i
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)}>
              <rect x={x} y={padding} width={barWidth} height={height - padding * 2} fill="transparent" />
              <rect x={x} y={y} width={barWidth} height={barHeight} rx="4" fill="#22c55e" opacity={isHover ? 1 : 0.85} />
              {isHover && (
                <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" className="chart-bar-label">
                  {d.value.toFixed(1)}d
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="chart-x-axis bar-x-axis">
        {data.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
        {data.length === 0 && <span>No resolved requests yet</span>}
      </div>
    </div>
  )
}

interface ClientReportingProps {
  contact: ClientContact
  onLogout: () => void
}

function ClientReporting({ contact, onLogout }: ClientReportingProps) {
  const [activeMatters, setActiveMatters] = useState<number | null>(null)
  const [mattersTrend, setMattersTrend] = useState<TrendPoint[]>([])
  const [contractDistribution, setContractDistribution] = useState<OutcomeSlice[]>([])
  const [turnaroundByType, setTurnaroundByType] = useState<BarPoint[]>([])
  const [avgTurnaroundDays, setAvgTurnaroundDays] = useState<number | null>(null)
  const [requestsThisMonth, setRequestsThisMonth] = useState<number | null>(null)
  const [completionRate, setCompletionRate] = useState<number | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    listClientMatters(token)
      .then((matters) => {
        setActiveMatters(matters.filter((m) => m.status !== 'closed' && m.status !== 'declined').length)
        setMattersTrend(activeMattersTrend(matters))
      })
      .catch(() => setActiveMatters(null))

    listClientSignedContracts(token)
      .then((contracts) => {
        const counts = contracts.reduce(
          (acc, c) => ({ ...acc, [c.agreement_type]: (acc[c.agreement_type] ?? 0) + 1 }),
          {} as Record<ContractType, number>,
        )
        setContractDistribution(
          (Object.keys(counts) as ContractType[]).map((type) => ({
            label: contractTypeLabel[type],
            value: counts[type],
            color: contractTypeColor[type],
          })),
        )
      })
      .catch(() => setContractDistribution([]))

    listMySupportRequests(token)
      .then((requests) => {
        const now = new Date()
        setRequestsThisMonth(
          requests.filter((r) => {
            const created = new Date(r.created_at)
            return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth()
          }).length,
        )

        const resolved = requests.filter((r) => r.status === 'resolved')
        setCompletionRate(requests.length > 0 ? Math.round((resolved.length / requests.length) * 100) : null)
        setAvgTurnaroundDays(resolved.length > 0 ? avgDays(resolved) : null)
        setTurnaroundByType(turnaroundByRequestType(resolved))
      })
      .catch(() => {
        setRequestsThisMonth(null)
        setCompletionRate(null)
        setAvgTurnaroundDays(null)
        setTurnaroundByType([])
      })
  }, [])

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Data &amp; Reporting</h1>
        <ProfileMenu user={contact} onLogout={onLogout} />
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
            <span>Avg. turnaround</span>
          </div>
          <div className="stat-line">
            <span className="stat-big">{avgTurnaroundDays !== null ? `${avgTurnaroundDays.toFixed(1)} days` : '—'}</span>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span>Requests this month</span>
          </div>
          <div className="stat-line">
            <span className="stat-big">{requestsThisMonth ?? '—'}</span>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span>Completion rate</span>
          </div>
          <div className="stat-line">
            <span className="stat-big">{completionRate !== null ? `${completionRate}%` : '—'}</span>
          </div>
        </div>
      </section>

      <section className="dash-row reporting-charts">
        <div className="card reporting-chart-card">
          <div className="card-header">
            <span>Active Matters</span>
          </div>
          <span className="card-subtitle">last 6 months</span>
          <ActiveMattersLineChart data={mattersTrend} />
        </div>

        <div className="card reporting-chart-card">
          <div className="card-header">
            <span>Contract Distribution</span>
          </div>
          <span className="card-subtitle">by agreement type</span>
          <ContractDistributionDonut data={contractDistribution} />
        </div>

        <div className="card reporting-chart-card">
          <div className="card-header">
            <span>Turnaround Time</span>
          </div>
          <span className="card-subtitle">days, by request type (resolved requests)</span>
          <TurnaroundBarChart data={turnaroundByType} />
        </div>
      </section>
    </main>
  )
}

function avgDays(requests: SupportRequest[]): number {
  const totalDays = requests.reduce((sum, r) => sum + daysBetween(r.created_at, r.updated_at), 0)
  return totalDays / requests.length
}

function daysBetween(start: string, end: string): number {
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24))
}

function turnaroundByRequestType(resolved: SupportRequest[]): BarPoint[] {
  const byType = resolved.reduce(
    (acc, r) => {
      const bucket = acc[r.request_type] ?? { total: 0, count: 0 }
      bucket.total += daysBetween(r.created_at, r.updated_at)
      bucket.count += 1
      acc[r.request_type] = bucket
      return acc
    },
    {} as Record<SupportRequestType, { total: number; count: number }>,
  )

  return (Object.keys(byType) as SupportRequestType[]).map((type) => ({
    label: requestTypeLabel[type],
    value: byType[type].total / byType[type].count,
  }))
}

export default ClientReporting
