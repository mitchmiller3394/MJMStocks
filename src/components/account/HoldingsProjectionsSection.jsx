import { Badge, Card } from 'react-bootstrap'
import { Link } from 'react-router'
import HoldingProjectionCard from '../HoldingProjectionCard.jsx'

function HoldingsProjectionsSection({ holdings, holdingPrices, onViewPortfolio }) {
  return (
    <Card className="account-section-card border-0 p-3 p-sm-4 mb-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="account-section-title mb-0">Holdings & Projections</h2>
        <button
          type="button"
          className="btn btn-sm btn-outline-light"
          onClick={onViewPortfolio}
        >
          View Portfolio →
        </button>
      </div>

      {holdings.length === 0 ? (
        <div className="account-empty-state">
          <p className="account-empty-title">No positions yet</p>
          <p className="account-subtitle mb-0">
            Search for a stock on the <Link to="/">Home page</Link> and use the
            Buy panel to place your first order.
          </p>
        </div>
      ) : (
        <>
          <p className="account-subtitle mb-3">
            Select a time horizon and scenario to see how your holdings could grow.
            <Badge bg="warning" text="dark" className="ms-2" style={{ fontSize: '0.7rem' }}>
              Projections are not financial advice
            </Badge>
          </p>
          {holdings.map((holding) => (
            <HoldingProjectionCard
              key={holding.symbol}
              holding={holding}
              currentPrice={holdingPrices[holding.symbol]}
            />
          ))}
        </>
      )}
    </Card>
  )
}

export default HoldingsProjectionsSection
