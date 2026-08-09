import { Card } from 'react-bootstrap'

function OwnedPositionsSection({ ownedPositions, ownedQuotes, stockBySymbol, onOpenStock }) {
  return (
    <section>
      <h2 className="portfolio-section-title mb-3">Owned Positions</h2>

      {ownedPositions.length === 0 ? (
        <Card className="portfolio-empty-card border-0 p-3 p-sm-4">
          <p className="portfolio-empty-title mb-1">You currently hold no positions</p>
          <p className="portfolio-empty-copy mb-0">
            Your owned stocks will appear here as soon as you place your first buy order.
          </p>
        </Card>
      ) : (
        <div className="portfolio-list d-flex flex-column gap-3">
          {ownedPositions.map((pos) => {
            const stock = stockBySymbol[pos.symbol]
            const currentPrice = ownedQuotes[pos.symbol]
            const currentValue = typeof currentPrice === 'number'
              ? currentPrice * pos.shares
              : pos.avgCost * pos.shares
            const unrealizedGain = currentValue - pos.avgCost * pos.shares
            const unrealizedPct = pos.avgCost > 0
              ? ((currentValue - pos.avgCost * pos.shares) / (pos.avgCost * pos.shares)) * 100
              : 0
            const gainClass = unrealizedGain >= 0 ? 'text-success' : 'text-danger'
            const sharesLabel = pos.shares % 1 === 0 ? pos.shares : pos.shares.toFixed(4)

            return (
              <Card
                key={pos.symbol}
                className="portfolio-stock-item portfolio-stock-item-clickable border-0 p-3 p-sm-4"
                onClick={() => onOpenStock(pos.symbol)}
              >
                <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <h2 className="portfolio-stock-symbol mb-1">{pos.symbol}</h2>
                    <p className="portfolio-stock-name mb-0">
                      {stock?.name ?? pos.symbol} · {sharesLabel} shares
                    </p>
                    <p className="stock-subtitle mb-0">
                      Avg cost ${pos.avgCost.toFixed(2)}/share
                    </p>
                  </div>
                  <div className="d-flex align-items-center gap-3 ms-sm-auto">
                    <div className="text-end">
                      <div className="portfolio-stock-price">
                        ${currentValue.toFixed(2)}
                      </div>
                      <div className={`portfolio-stock-change ${gainClass}`}>
                        {unrealizedGain >= 0 ? '+' : ''}
                        {unrealizedGain.toFixed(2)} ({unrealizedPct.toFixed(2)}%)
                      </div>
                      {typeof currentPrice === 'number' && (
                        <div className="stock-subtitle">${currentPrice.toFixed(2)}/share</div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-warning"
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpenStock(pos.symbol)
                      }}
                      title={`Sell ${pos.symbol}`}
                    >
                      Sell
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default OwnedPositionsSection
