import { Card, Col, Row } from 'react-bootstrap'

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const pctFmt = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

function BalanceSummarySection({ cashBalance, totals }) {
  const gainLossClass = totals.gainLoss >= 0 ? 'text-success' : 'text-danger'

  return (
    <Row className="g-3 mb-4">
      <Col xs={12} sm={6} lg={3}>
        <Card className="account-stat-card border-0 p-3">
          <div className="account-stat-label">Cash Available</div>
          <div className="account-stat-value text-info">{currencyFmt.format(cashBalance)}</div>
        </Card>
      </Col>
      <Col xs={12} sm={6} lg={3}>
        <Card className="account-stat-card border-0 p-3">
          <div className="account-stat-label">Invested</div>
          <div className="account-stat-value">{currencyFmt.format(totals.invested)}</div>
        </Card>
      </Col>
      <Col xs={12} sm={6} lg={3}>
        <Card className="account-stat-card border-0 p-3">
          <div className="account-stat-label">Total Value</div>
          <div className="account-stat-value">{currencyFmt.format(totals.total)}</div>
        </Card>
      </Col>
      <Col xs={12} sm={6} lg={3}>
        <Card className="account-stat-card border-0 p-3">
          <div className="account-stat-label">Total Gain / Loss</div>
          <div className={`account-stat-value ${gainLossClass}`}>
            {currencyFmt.format(totals.gainLoss)}
            {totals.totalFunded > 0 && (
              <span className="account-stat-pct ms-1">({pctFmt((totals.gainLoss / totals.totalFunded) * 100)})</span>
            )}
          </div>
        </Card>
      </Col>
    </Row>
  )
}

export default BalanceSummarySection
