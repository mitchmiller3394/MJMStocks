import { useMemo } from 'react'
import { Card } from 'react-bootstrap'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

const numberFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const defaultLabels = [
  '9:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '1:00',
  '1:30',
  '2:00',
  '2:30',
  '3:00',
]

const defaultPoints = [
  198.2, 199.6, 200.8, 201.4, 200.7, 202.3, 203.1, 202.6, 204.2, 205.8, 205.1,
  206.4,
]

const TIMEFRAME_OPTIONS = [
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: '5Y', label: '5Y' },
]

function StockChartCard({
  title = 'Simulated Stock Trend',
  subtitle = 'Preview chart (fake data)',
  symbol = 'QTECH',
  labels = defaultLabels,
  points = defaultPoints,
  timeframe = '1M',
  timeframeLabel = '1 Month',
  onTimeframeChange,
  lastUpdatedAt,
  isStale = false,
  onRefresh,
  isRefreshing = false,
  refreshDisabled = false,
  liveToggleSupported = false,
  liveEnabled = false,
  liveStatus = 'off',
  onToggleLive,
  priceOverride,
  changeOverride,
  changePercentOverride,
  // Projection props
  projectionConfig = null, // { points, labels, endValue, gain, gainPct, rate, horizon }
  costBasis = null,        // number — shown as horizontal reference line
  projectionEnabled = false,
  onToggleProjection,
  projectionMode = 'simple',
  onProjectionModeChange,
  projectionHorizon = '1Y',
  onProjectionHorizonChange,
}) {
  const allLabels = useMemo(() => {
    if (!projectionEnabled || !projectionConfig) return labels
    return [...labels, ...projectionConfig.labels.slice(1)]
  }, [labels, projectionEnabled, projectionConfig])

  const stockData = useMemo(
    () => {
      const datasets = [
        {
          label: `${symbol} • ${timeframeLabel}`,
          data: projectionEnabled && projectionConfig
            ? [...points, ...Array(projectionConfig.labels.length - 1).fill(null)]
            : points,
          fill: true,
          tension: 0.3,
          borderWidth: 2.5,
          borderColor: '#78a6ff',
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHitRadius: 14,
          pointHoverBackgroundColor: '#c9dcff',
          pointHoverBorderColor: '#78a6ff',
          backgroundColor: (ctx) => {
            const { chart } = ctx
            const { ctx: canvas, chartArea } = chart
            if (!chartArea) return 'rgba(120, 166, 255, 0.26)'
            const gradient = canvas.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
            gradient.addColorStop(0, 'rgba(120, 166, 255, 0.35)')
            gradient.addColorStop(1, 'rgba(120, 166, 255, 0.02)')
            return gradient
          },
          spanGaps: false,
        },
      ]

      if (projectionEnabled && projectionConfig) {
        // Projected line: starts from the last real point
        const projData = [
          ...Array(points.length - 1).fill(null),
          points[points.length - 1], // overlap one point for continuity
          ...projectionConfig.points.slice(1),
        ]
        datasets.push({
          label: `${symbol} Projection (${projectionHorizon})`,
          data: projData,
          fill: false,
          tension: 0.3,
          borderWidth: 2,
          borderColor: 'rgba(250, 204, 21, 0.85)',
          borderDash: [6, 4],
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: '#fbbf24',
          pointHoverBorderColor: '#fbbf24',
          spanGaps: false,
          backgroundColor: 'transparent',
        })
      }

      if (costBasis !== null && typeof costBasis === 'number') {
        const totalLength = projectionEnabled && projectionConfig
          ? points.length + projectionConfig.labels.length - 1
          : points.length
        datasets.push({
          label: 'Cost Basis',
          data: Array(totalLength).fill(costBasis),
          fill: false,
          tension: 0,
          borderWidth: 1.5,
          borderColor: 'rgba(148, 163, 184, 0.5)',
          borderDash: [3, 5],
          pointRadius: 0,
          pointHoverRadius: 0,
          backgroundColor: 'transparent',
        })
      }

      return { labels: allLabels, datasets }
    },
    [labels, points, symbol, allLabels, projectionEnabled, projectionConfig, projectionHorizon, costBasis],
  )

  const stockOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: projectionEnabled || costBasis !== null,
          labels: {
            color: '#94a3b8',
            font: { size: 11 },
            boxWidth: 14,
          },
        },
        tooltip: {
          mode: 'nearest',
          intersect: false,
          backgroundColor: '#0f172acc',
          borderColor: '#94a3b8',
          borderWidth: 1,
          displayColors: false,
          padding: 12,
          callbacks: {
            title: (items) => items[0]?.label ?? '',
            label: (context) => `Price: ${numberFormatter.format(context.parsed.y)}`,
          },
        },
      },
      interaction: {
        mode: 'nearest',
        intersect: false,
      },
      hover: {
        mode: 'nearest',
        intersect: false,
      },
      scales: {
        x: {
          grid: { color: 'rgba(148, 163, 184, 0.12)' },
          ticks: { color: '#94a3b8' },
        },
        y: {
          grid: { color: 'rgba(148, 163, 184, 0.12)' },
          ticks: { color: '#94a3b8', callback: (value) => `$${value}` },
        },
      },
      elements: {
        point: { radius: 0, hoverRadius: 6, hitRadius: 14 },
      },
    }),
    [points, symbol, timeframeLabel, labels, projectionEnabled, costBasis],
  )

  const fallbackLastPrice = points[points.length - 1]
  const openPrice = points[0]
  const lastPrice = typeof priceOverride === 'number' ? priceOverride : fallbackLastPrice
  const delta =
    typeof changeOverride === 'number' ? changeOverride : lastPrice - openPrice
  const deltaPct =
    typeof changePercentOverride === 'number'
      ? changePercentOverride
      : (delta / openPrice) * 100
  const trendClass = delta >= 0 ? 'text-success' : 'text-danger'

  const lastUpdatedLabel =
    typeof lastUpdatedAt === 'number'
      ? new Date(lastUpdatedAt).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
        })
      : null

  const liveStatusLabel =
    liveStatus === 'live'
      ? 'Live'
      : liveStatus === 'connecting'
        ? 'Connecting…'
        : liveStatus === 'error'
          ? 'Unavailable'
          : 'Off'

  return (
    <Card as="section" className="stock-card p-3 p-sm-4">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
        <div>
          <h2 className="stock-title mb-1">{title}</h2>
          <p className="stock-subtitle mb-0">{subtitle}</p>
          <p className="stock-subtitle mb-0 mt-1">
            {isStale ? 'Using cached quote' : 'Quote source: Finnhub'}
            {lastUpdatedLabel ? ` • Updated ${lastUpdatedLabel}` : ''}
          </p>
        </div>

        <div className="text-end">
          <div className="stock-price">{numberFormatter.format(lastPrice)}</div>
          <div className={`stock-delta ${trendClass}`}>
            {delta >= 0 ? '+' : ''}
            {delta.toFixed(2)} ({deltaPct.toFixed(2)}%)
          </div>
        </div>
      </div>

      {onTimeframeChange && (
        <div className="d-flex flex-wrap gap-2 mb-3">
          {TIMEFRAME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`btn btn-sm ${timeframe === option.value ? 'btn-primary' : 'btn-outline-light'}`}
              onClick={() => onTimeframeChange(option.value)}
              aria-pressed={timeframe === option.value}
              aria-label={`Set chart timeframe to ${option.label}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        {onRefresh && (
          <button
            type="button"
            className="btn btn-sm btn-outline-light"
            onClick={onRefresh}
            disabled={isRefreshing || refreshDisabled}
            aria-label="Refresh current quote"
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh quote'}
          </button>
        )}

        {liveToggleSupported && onToggleLive && (
          <button
            type="button"
            className={`btn btn-sm ${liveEnabled ? 'btn-success' : 'btn-outline-success'}`}
            onClick={onToggleLive}
            aria-pressed={liveEnabled}
            aria-label={liveEnabled ? 'Disable live quote updates' : 'Enable live quote updates'}
          >
            {liveEnabled ? 'Disable live' : 'Enable live'} ({liveStatusLabel})
          </button>
        )}

        {!liveToggleSupported && (
          <span className="stock-subtitle">Live websocket unavailable (missing API key).</span>
        )}

        {onToggleProjection && (
          <button
            type="button"
            className={`btn btn-sm proj-toggle-btn ${projectionEnabled ? 'btn-warning' : 'btn-outline-warning'}`}
            onClick={onToggleProjection}
            aria-pressed={projectionEnabled}
            aria-label={projectionEnabled ? 'Hide projection overlay' : 'Show projection overlay'}
          >
            {projectionEnabled ? '📈 Hide Projection' : '📈 Show Projection'}
          </button>
        )}
      </div>

      {projectionEnabled && projectionConfig && (
        <div className="proj-controls d-flex flex-wrap align-items-center gap-3 mb-3">
          <div className="d-flex align-items-center gap-2">
            <span className="account-subtitle me-1">Mode:</span>
            <button
              type="button"
              className={`btn btn-xs ${projectionMode === 'simple' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => onProjectionModeChange?.('simple')}
              aria-pressed={projectionMode === 'simple'}
              aria-label="Use simple projection mode"
            >
              Simple
            </button>
            <button
              type="button"
              className={`btn btn-xs ${projectionMode === 'complex' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => onProjectionModeChange?.('complex')}
              aria-pressed={projectionMode === 'complex'}
              aria-label="Use complex projection mode"
            >
              Complex
            </button>
          </div>
          <div className="d-flex align-items-center gap-1">
            <span className="account-subtitle me-1">Horizon:</span>
            {['1M', '3M', '6M', '1Y', '5Y'].map((h) => (
              <button
                key={h}
                type="button"
                className={`btn btn-xs ${projectionHorizon === h ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => onProjectionHorizonChange?.(h)}
                aria-pressed={projectionHorizon === h}
                aria-label={`Set projection horizon to ${h}`}
              >
                {h}
              </button>
            ))}
          </div>
          <div className="proj-summary">
            Rate: <strong>{projectionConfig.rate >= 0 ? '+' : ''}{(projectionConfig.rate * 100).toFixed(1)}%/yr</strong>
            &nbsp;→&nbsp;
            Est. <strong>{numberFormatter.format(projectionConfig.endValue)}</strong>
            &nbsp;in {projectionHorizon}&nbsp;
            <span className={projectionConfig.gain >= 0 ? 'text-success' : 'text-danger'}>
              ({projectionConfig.gain >= 0 ? '+' : ''}{numberFormatter.format(projectionConfig.gain)},&nbsp;
              {projectionConfig.gainPct >= 0 ? '+' : ''}{projectionConfig.gainPct.toFixed(1)}%)
            </span>
          </div>
        </div>
      )}

      <div className="chart-wrap">
        <Line
          data={stockData}
          options={stockOptions}
          role="img"
          aria-label={`${symbol} price chart for ${timeframeLabel}`}
        />
      </div>
    </Card>
  )
}

export default StockChartCard
