import { useEffect, useState } from 'react'
import './ClientReporting.css'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'
import { listClientMatters } from '../../api/clientMatters'

const activeMattersTrend = [
  { month: 'Feb', value: 24 },
  { month: 'Mar', value: 28 },
  { month: 'Apr', value: 31 },
  { month: 'May', value: 35 },
  { month: 'Jun', value: 38 },
  { month: 'Jul', value: 42 },
]

const contractDistribution = [
  { label: 'NDA', value: 38, color: '#3987e5' },
  { label: 'Consultancy', value: 27, color: '#199e70' },
  { label: 'Supplier', value: 22, color: '#c98500' },
  { label: 'Other', value: 13, color: '#008300' },
]

const turnaroundByType = [
  { label: 'NDA', value: 3 },
  { label: 'Consultancy', value: 5 },
  { label: 'Supplier', value: 7 },
  { label: 'General', value: 4 },
  { label: 'Lease', value: 6 },
]

const statTiles = [
  { label: 'Avg. turnaround', value: '4.8 days', delta: '-1.2 days vs last period', up: true },
  { label: 'Requests this month', value: '19', delta: '+4 vs last period', up: true },
  { label: 'Completion rate', value: '91%', delta: '+3pts vs last period', up: true },
]

function ActiveMattersLineChart() {
  const width = 300
  const height = 130
  const padding = 8
  const [hover, setHover] = useState<number | null>(null)

  const values = activeMattersTrend.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const stepX = (width - padding * 2) / (activeMattersTrend.length - 1)

  const points = activeMattersTrend.map((d, i) => {
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
        {activeMattersTrend.map((d) => (
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

function ContractDistributionDonut() {
  const size = 148
  const stroke = 22
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const total = contractDistribution.reduce((s, d) => s + d.value, 0)
  const [hover, setHover] = useState<number | null>(null)

  let cumulative = 0
  const segments = contractDistribution.map((d) => {
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
          contracts
        </text>
      </svg>

      <div className="donut-legend">
        {contractDistribution.map((d, i) => (
          <div key={d.label} className={`donut-legend-row${hover === i ? ' active' : ''}`}>
            <span className="status-dot" style={{ background: d.color }} />
            <span className="donut-legend-label">{d.label}</span>
            <span className="donut-legend-value">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TurnaroundBarChart() {
  const width = 300
  const height = 140
  const padding = 20
  const [hover, setHover] = useState<number | null>(null)

  const max = 8
  const gridSteps = [0, 2, 4, 6, 8]
  const barSlot = (width - padding) / turnaroundByType.length
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
              {g}
            </text>
          )
        })}

        {turnaroundByType.map((d, i) => {
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
                  {d.value}d
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="chart-x-axis bar-x-axis">
        {turnaroundByType.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
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

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    listClientMatters(token)
      .then((matters) => setActiveMatters(matters.filter((m) => m.status !== 'closed' && m.status !== 'declined').length))
      .catch(() => setActiveMatters(null))
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
        {statTiles.map((t) => (
          <div key={t.label} className="card">
            <div className="card-header">
              <span>{t.label}</span>
            </div>
            <div className="stat-line">
              <span className="stat-big">{t.value}</span>
            </div>
            <span className={`stat-delta${t.up ? ' up' : ' down'}`}>{t.delta}</span>
          </div>
        ))}
      </section>

      <section className="dash-row reporting-charts">
        <div className="card reporting-chart-card">
          <div className="card-header">
            <span>Active Matters</span>
          </div>
          <span className="card-subtitle">last 6 months</span>
          <ActiveMattersLineChart />
        </div>

        <div className="card reporting-chart-card">
          <div className="card-header">
            <span>Contract Distribution</span>
          </div>
          <span className="card-subtitle">by agreement type</span>
          <ContractDistributionDonut />
        </div>

        <div className="card reporting-chart-card">
          <div className="card-header">
            <span>Turnaround Time</span>
          </div>
          <span className="card-subtitle">days, by request type</span>
          <TurnaroundBarChart />
        </div>
      </section>
    </main>
  )
}

export default ClientReporting
