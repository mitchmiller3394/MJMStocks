import { useEffect, useState } from 'react'
import { Card, Container } from 'react-bootstrap'
import { useLocation } from 'react-router'

import MarketClock from '../components/MarketClock.jsx'
import StockChartCard from '../components/StockChartCard.jsx'
import StockSearchBar from '../components/StockSearchBar.jsx'
import { MOCK_STOCKS } from '../data/mockStocks.js'

const stockBySymbol = Object.fromEntries(
  MOCK_STOCKS.map((stock) => [stock.symbol, stock]),
)

function HomePage() {
  const [selectedStock, setSelectedStock] = useState(null)
  const location = useLocation()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const symbolParam = params.get('symbol')

    if (!symbolParam) {
      return
    }

    const match = stockBySymbol[symbolParam.toUpperCase()]
    setSelectedStock(match ?? null)
  }, [location.search])

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
