interface MiniChartPoint {
  label: string
  value: number
}

interface MiniChartProps {
  points: MiniChartPoint[]
  color: string
  formatValue?: (value: number) => string
  height?: number
}

/** Small responsive inline-SVG bar chart — no charting library, just scaled <rect>s. */
function MiniChart({ points, color, formatValue, height = 70 }: MiniChartProps) {
  if (points.length === 0) {
    return <p className="muted">No data in this window.</p>
  }

  const max = Math.max(...points.map((p) => p.value), 1)
  const barWidth = 100 / points.length
  const chartLabel = `Bar chart from ${points[0].label} to ${points[points.length - 1].label}`

  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="mini-chart" role="img" aria-label={chartLabel}>
      {points.map((p, i) => {
        const barHeight = max > 0 ? (p.value / max) * (height - 4) : 0
        return (
          <rect
            key={i}
            x={i * barWidth + barWidth * 0.15}
            y={height - barHeight}
            width={Math.max(barWidth * 0.7, 0.5)}
            height={barHeight}
            fill={color}
            rx={0.6}
          >
            <title>{`${p.label}: ${formatValue ? formatValue(p.value) : p.value}`}</title>
          </rect>
        )
      })}
    </svg>
  )
}

export default MiniChart
