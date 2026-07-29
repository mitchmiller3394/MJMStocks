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
}) {
  const stockData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: `${symbol} • ${timeframeLabel}`,
          data: points,
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

            if (!chartArea) {
              return 'rgba(120, 166, 255, 0.26)'
            }

            const gradient = canvas.createLinearGradient(
              0,
              chartArea.top,
              0,
              chartArea.bottom,
            )

            gradient.addColorStop(0, 'rgba(120, 166, 255, 0.35)')
            gradient.addColorStop(1, 'rgba(120, 166, 255, 0.02)')

            return gradient
          },
        },
      ],
    }),
    [labels, points, symbol],
  )

  const stockOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
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
          grid: {
            color: 'rgba(148, 163, 184, 0.12)',
          },
          ticks: {
            color: '#94a3b8',
          },
        },
        y: {
          grid: {
            color: 'rgba(148, 163, 184, 0.12)',
          },
          ticks: {
            color: '#94a3b8',
            callback: (value) => `$${value}`,
          },
        },
      },
      elements: {
        point: {
          radius: 0,
          hoverRadius: 6,
          hitRadius: 14,
        },
      },
    }),
    [points, symbol, timeframeLabel, labels],
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
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh quote'}
          </button>
        )}

        {liveToggleSupported && onToggleLive && (
          <button
            type="button"
            className={`btn btn-sm ${liveEnabled ? 'btn-success' : 'btn-outline-success'}`}
            onClick={onToggleLive}
          >
            {liveEnabled ? 'Disable live' : 'Enable live'} ({liveStatusLabel})
          </button>
        )}

        {!liveToggleSupported && (
          <span className="stock-subtitle">Live websocket unavailable (missing API key).</span>
        )}
      </div>

      <div className="chart-wrap">
        <Line data={stockData} options={stockOptions} />
      </div>
    </Card>
  )
}

export default StockChartCard
