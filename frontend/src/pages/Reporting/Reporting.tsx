import { useState } from 'react'
import './Reporting.css'

const revenueTrend = [
  { month: 'Jan', value: 620 },
  { month: 'Feb', value: 680 },
  { month: 'Mar', value: 750 },
  { month: 'Apr', value: 810 },
  { month: 'May', value: 890 },
  { month: 'Jun', value: 960 },
]

const caseOutcomes = [
  { label: 'Won', value: 45, color: '#3987e5' },
  { label: 'Settled', value: 30, color: '#199e70' },
  { label: 'Ongoing', value: 15, color: '#c98500' },
  { label: 'Dismissed', value: 10, color: '#008300' },
]

const billableHours = [
  { label: 'A. Dlamini', value: 62 },
  { label: 'T. van Wyk', value: 54 },
  { label: 'S. Mokoena', value: 47 },
  { label: 'R. Naidoo', value: 39 },
  { label: 'L. Botha', value: 28 },
]

const statTiles = [
  { label: 'Total revenue', value: 'R4.71M', delta: '+8% vs last period', up: true },
  { label: 'Active matters', value: '23', delta: '+3 vs last period', up: true },
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

function CaseOutcomesDonut() {
  const size = 148
  const stroke = 22
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const total = caseOutcomes.reduce((s, d) => s + d.value, 0)
  const [hover, setHover] = useState<number | null>(null)

  let cumulative = 0
  const segments = caseOutcomes.map((d) => {
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
        {caseOutcomes.map((d, i) => (
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

function BillableHoursBar() {
  const width = 300
  const height = 140
  const padding = 20
  const [hover, setHover] = useState<number | null>(null)

  const max = 80
  const gridSteps = [0, 20, 40, 60, 80]
  const barSlot = (width - padding) / billableHours.length
  const barWidth = Math.min(barSlot - 14, 24)

  return (
    <div className="chart-wrap">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} onMouseLeave={() => setHover(null)}>
        {gridSteps.map((g) => {
          const y = height - padding - (g / max) * (height - padding * 2)
          return (
            <line
              key={g}
              x1={padding}
              x2={width}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
          )
        })}
        {gridSteps.map((g) => {
          const y = height - padding - (g / max) * (height - padding * 2)
          return (
            <text key={g} x={padding - 6} y={y + 3} textAnchor="end" className="chart-axis-label">
              {g}
            </text>
          )
        })}

        {billableHours.map((d, i) => {
          const barHeight = (d.value / max) * (height - padding * 2)
          const x = padding + i * barSlot + (barSlot - barWidth) / 2
          const y = height - padding - barHeight
          const isHover = hover === i
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)}>
              <rect x={x} y={padding} width={barWidth} height={height - padding * 2} fill="transparent" />
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="4"
                fill="#22c55e"
                opacity={isHover ? 1 : 0.85}
              />
              {isHover && (
                <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" className="chart-bar-label">
                  {d.value}h
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="chart-x-axis bar-x-axis">
        {billableHours.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}

function Reporting() {
  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Reporting</h1>
      </header>

      <section className="dash-row reporting-stats">
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
            <span>Revenue Trend</span>
          </div>
          <span className="card-subtitle">last 6 months</span>
          <RevenueLineChart />
        </div>

        <div className="card reporting-chart-card">
          <div className="card-header">
            <span>Case Outcomes</span>
          </div>
          <span className="card-subtitle">closed &amp; ongoing matters</span>
          <CaseOutcomesDonut />
        </div>

        <div className="card reporting-chart-card">
          <div className="card-header">
            <span>Billable Hours</span>
          </div>
          <span className="card-subtitle">by attorney, this week</span>
          <BillableHoursBar />
        </div>
      </section>
    </main>
  )
}

export default Reporting
