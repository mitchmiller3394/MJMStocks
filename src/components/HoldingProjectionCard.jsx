import { useMemo, useState } from 'react'
import { Badge, Card, Form } from 'react-bootstrap'
import { buildProjection, estimateHoldingAnnualRate } from '../data/accountStorage.js'

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const pctFmt = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

const HORIZON_OPTIONS = [
  { value: '1M', label: '1 Month' },
  { value: '3M', label: '3 Months' },
  { value: '6M', label: '6 Months' },
  { value: '1Y', label: '1 Year' },
  { value: '5Y', label: '5 Years' },
]

const SCENARIO_RATES = {
  conservative: 0.05,
  base: null,
  optimistic: 0.2,
}

function HoldingProjectionCard({ holding, currentPrice }) {
  const [horizon, setHorizon] = useState('1Y')
  const [scenario, setScenario] = useState('base')
  const [customRate, setCustomRate] = useState('')

  const resolvedCurrentPrice =
    typeof currentPrice === 'number' ? currentPrice : holding.avgCost

  const currentValue = resolvedCurrentPrice * holding.shares
  const costBasis = holding.avgCost * holding.shares
  const unrealizedGain = currentValue - costBasis
  const unrealizedPct = costBasis > 0 ? (unrealizedGain / costBasis) * 100 : 0

  const baseRate = useMemo(
    () => estimateHoldingAnnualRate(holding, resolvedCurrentPrice),
    [holding, resolvedCurrentPrice],
  )

  let projRate
  if (scenario === 'custom') {
    const parsed = Number.parseFloat(customRate)
    projRate = Number.isFinite(parsed) ? parsed / 100 : baseRate
  } else if (scenario === 'base') {
    projRate = baseRate
  } else {
    projRate = SCENARIO_RATES[scenario]
  }

  const proj = buildProjection(resolvedCurrentPrice, projRate, horizon)
  const projectedHoldingValue = proj.endValue * holding.shares
  const projectedGain = projectedHoldingValue - costBasis
  const projectedGainPct = costBasis > 0 ? (projectedGain / costBasis) * 100 : 0

  const gainClass = unrealizedGain >= 0 ? 'text-success' : 'text-danger'
  const projClass = projectedGain >= 0 ? 'text-success' : 'text-danger'

  return (
    <Card className="account-holding-card border-0 p-3 p-sm-4 mb-3">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
        <div>
          <h3 className="account-holding-symbol mb-0">{holding.symbol}</h3>
          <p className="account-subtitle mb-0">
            {holding.shares % 1 === 0 ? holding.shares : holding.shares.toFixed(4)} shares
            &nbsp;·&nbsp;Avg cost {currencyFmt.format(holding.avgCost)}
          </p>
        </div>
        <div className="text-end">
          <div className="account-holding-value">{currencyFmt.format(currentValue)}</div>
          <div className={`account-holding-change ${gainClass}`}>
            {currencyFmt.format(unrealizedGain)} ({pctFmt(unrealizedPct)})
          </div>
          <div className="account-subtitle">
            Current {currencyFmt.format(resolvedCurrentPrice)}/share
          </div>
        </div>
      </div>

      <div className="account-proj-controls d-flex flex-wrap gap-2 mb-3">
        <div className="d-flex align-items-center gap-1">
          <span className="account-subtitle me-1">Horizon:</span>
          {HORIZON_OPTIONS.map((h) => (
            <button
              key={h.value}
              type="button"
              className={`btn btn-xs ${horizon === h.value ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setHorizon(h.value)}
            >
              {h.value}
            </button>
          ))}
        </div>
        <div className="d-flex align-items-center gap-1">
          <span className="account-subtitle me-1">Scenario:</span>
          {['conservative', 'base', 'optimistic', 'custom'].map((s) => (
            <button
              key={s}
              type="button"
              className={`btn btn-xs ${scenario === s ? 'btn-primary' : 'btn-outline-secondary'} text-capitalize`}
              onClick={() => setScenario(s)}
            >
              {s === 'base' ? 'Actual' : s}
            </button>
          ))}
        </div>
        {scenario === 'custom' && (
          <div className="d-flex align-items-center gap-2">
            <Form.Control
              type="number"
              size="sm"
              className="account-custom-rate-input"
              placeholder="Rate %"
              value={customRate}
              onChange={(e) => setCustomRate(e.target.value)}
              step="0.5"
            />
            <span className="account-subtitle">% annual</span>
          </div>
        )}
      </div>

      <div className="account-proj-summary d-flex flex-wrap gap-4 align-items-center">
        <div>
          <div className="account-subtitle mb-0">Assumed rate</div>
          <div className="account-proj-rate">
            {projRate >= 0 ? '+' : ''}
            {(projRate * 100).toFixed(1)}% / yr
          </div>
        </div>
        <div>
          <div className="account-subtitle mb-0">Projected value in {horizon}</div>
          <div className={`account-proj-value ${projClass}`}>
            {currencyFmt.format(projectedHoldingValue)}
          </div>
        </div>
        <div>
          <div className="account-subtitle mb-0">Projected gain vs cost</div>
          <div className={`account-proj-value ${projClass}`}>
            {currencyFmt.format(projectedGain)} ({pctFmt(projectedGainPct)})
          </div>
        </div>
        {scenario === 'base' ? (
          <Badge
            bg="info"
            className="align-self-center"
            style={{ fontSize: '0.7rem', opacity: 0.85 }}
          >
            Based on avg cost → live price
          </Badge>
        ) : (
          <Badge
            bg="secondary"
            className="align-self-center"
            style={{ fontSize: '0.7rem', opacity: 0.85 }}
          >
            Projection — not financial advice
          </Badge>
        )}
      </div>
    </Card>
  )
}

export default HoldingProjectionCard
