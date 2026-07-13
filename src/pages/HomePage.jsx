import { useState } from 'react'
import { Card, Container } from 'react-bootstrap'

import MarketClock from '../components/MarketClock.jsx'
import StockChartCard from '../components/StockChartCard.jsx'
import StockSearchBar from '../components/StockSearchBar.jsx'

function HomePage() {
  const [selectedStock, setSelectedStock] = useState(null)

  return (
    <main className="page-shell d-flex align-items-center py-4 py-md-5">
      <Container className="px-3 px-md-4">
        <Card className="glass-panel mx-auto border-0 p-3 p-sm-4 p-lg-5">
          <MarketClock />
          <StockSearchBar onSelect={setSelectedStock} />
          {selectedStock && (
            <StockChartCard
              title={selectedStock.name}
              subtitle={selectedStock.symbol}
              symbol={selectedStock.symbol}
              labels={selectedStock.labels}
              points={selectedStock.points}
            />
          )}
        </Card>
      </Container>
    </main>
  )
}

export default HomePage
