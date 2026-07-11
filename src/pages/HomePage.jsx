import { Card, Container } from 'react-bootstrap'

import MarketClock from '../components/MarketClock.jsx'
import StockChartCard from '../components/StockChartCard.jsx'

function HomePage() {
  return (
    <main className="page-shell d-flex align-items-center py-4 py-md-5">
      <Container className="px-3 px-md-4">
        <Card className="glass-panel mx-auto border-0 p-3 p-sm-4 p-lg-5">
          <MarketClock />
          <StockChartCard />
        </Card>
      </Container>
    </main>
  )
}

export default HomePage
