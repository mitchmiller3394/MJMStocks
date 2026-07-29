import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, Container } from 'react-bootstrap'
import { useLocation, useNavigate } from 'react-router'

import MarketClock from '../components/MarketClock.jsx'
import StockChartCard from '../components/StockChartCard.jsx'
import StockSearchBar from '../components/StockSearchBar.jsx'
import { MOCK_STOCKS } from '../data/mockStocks.js'
import {
  buildPseudoIntradaySeries,
  getFinnhubWsUrl,
  getQuote,
  hasFinnhubToken,
  isRateLimitCoolingDown,
} from '../data/finnhubClient.js'

const stockBySymbol = Object.fromEntries(
  MOCK_STOCKS.map((stock) => [stock.symbol, stock]),
)

function HomePage() {
  const [selectedStock, setSelectedStock] = useState(null)
  const [chartState, setChartState] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [liveEnabled, setLiveEnabled] = useState(false)
  const [liveStatus, setLiveStatus] = useState('off')
  const lastRefreshAtRef = useRef(0)
  const wsRef = useRef(null)
  const locationSearchRef = useRef('')

  const location = useLocation()
  const navigate = useNavigate()

  const wsUrl = useMemo(() => getFinnhubWsUrl(), [])
  const hasToken = useMemo(() => hasFinnhubToken(), [])

  const refreshSelectedStock = useCallback(
    async ({ manual = false } = {}) => {
      if (!selectedStock?.symbol) {
        return
      }

      if (manual) {
        const tooSoon = Date.now() - lastRefreshAtRef.current < 10_000
        if (tooSoon || isRateLimitCoolingDown()) {
          return
        }
      }

      setIsRefreshing(true)

      try {
        const quote = await getQuote(selectedStock.symbol)
        const fallback = stockBySymbol[selectedStock.symbol] || stockBySymbol.AAPL
        const derived = buildPseudoIntradaySeries({
          labels: fallback?.labels,
          fallbackPoints: fallback?.points,
          quote,
        })

        setChartState({
          quote,
          labels: derived.labels,
          points: derived.points,
          source: derived.source,
          updatedAt: quote.updatedAt ?? Date.now(),
        })
        lastRefreshAtRef.current = Date.now()
      } catch {
        const fallback = stockBySymbol[selectedStock.symbol] || stockBySymbol.AAPL
        setChartState({
          quote: null,
          labels: fallback?.labels,
          points: fallback?.points,
          source: 'mock',
          updatedAt: Date.now(),
        })
      } finally {
        setIsRefreshing(false)
      }
    },
    [selectedStock],
  )

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const symbolParam = params.get('symbol')

    if (!symbolParam) {
      return
    }

    const match = stockBySymbol[symbolParam.toUpperCase()]
    if (match) {
      setSelectedStock({ symbol: match.symbol, name: match.name })
      return
    }

    setSelectedStock({ symbol: symbolParam.toUpperCase(), name: symbolParam.toUpperCase() })
  }, [location.search])

  useEffect(() => {
    if (!selectedStock?.symbol) {
      setChartState(null)
      return
    }

    refreshSelectedStock()
  }, [selectedStock, refreshSelectedStock])

  useEffect(() => {
    if (!selectedStock?.symbol) {
      return undefined
    }

    if (liveEnabled && liveStatus === 'live') {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return
      }

      refreshSelectedStock()
    }, 30_000)

    return () => window.clearInterval(intervalId)
  }, [selectedStock, liveEnabled, liveStatus, refreshSelectedStock])

  useEffect(() => {
    if (!liveEnabled || !selectedStock?.symbol || !wsUrl) {
      setLiveStatus('off')
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      return undefined
    }

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    setLiveStatus('connecting')

    ws.onopen = () => {
      setLiveStatus('live')
      ws.send(
        JSON.stringify({ type: 'subscribe', symbol: selectedStock.symbol.toUpperCase() }),
      )
    }

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type !== 'trade' || !Array.isArray(payload.data)) {
          return
        }

        const trade = payload.data.find(
          (item) => item?.s?.toUpperCase() === selectedStock.symbol.toUpperCase(),
        )

        if (!trade || typeof trade.p !== 'number') {
          return
        }

        setChartState((prev) => {
          if (!prev) {
            return prev
          }

          const previousClose = prev.quote?.previousClose
          const change =
            typeof previousClose === 'number' ? trade.p - previousClose : undefined
          const changePercent =
            typeof previousClose === 'number' && previousClose !== 0
              ? (change / previousClose) * 100
              : undefined

          const nextPoints = [...prev.points]
          nextPoints[nextPoints.length - 1] = Number(trade.p.toFixed(2))

          return {
            ...prev,
            points: nextPoints,
            quote: {
              ...prev.quote,
              symbol: selectedStock.symbol.toUpperCase(),
              currentPrice: trade.p,
              change,
              changePercent,
              marketTimestamp:
                typeof trade.t === 'number' ? trade.t : prev.quote?.marketTimestamp,
              updatedAt: Date.now(),
              stale: false,
            },
            updatedAt: Date.now(),
          }
        })
      } catch {
        // ignore malformed websocket payloads
      }
    }

    ws.onerror = () => {
      setLiveStatus('error')
    }

    ws.onclose = () => {
      setLiveStatus((prev) => (prev === 'off' ? prev : 'error'))
    }

    return () => {
      try {
        ws.send(
          JSON.stringify({ type: 'unsubscribe', symbol: selectedStock.symbol.toUpperCase() }),
        )
      } catch {
        // no-op if socket is already closed
      }

      ws.close()
      if (wsRef.current === ws) {
        wsRef.current = null
      }
    }
  }, [liveEnabled, selectedStock, wsUrl])

  function handleSelect(stock) {
    if (!stock?.symbol) {
      setSelectedStock(null)
      return
    }

    setSelectedStock(stock)

    const nextSearch = `?symbol=${encodeURIComponent(stock.symbol)}`
    if (locationSearchRef.current === nextSearch) {
      return
    }

    locationSearchRef.current = nextSearch
    navigate(`/${nextSearch}`, { replace: false })
  }

  const currentPrice = chartState?.quote?.currentPrice
  const quoteSubtitle = selectedStock
    ? `${selectedStock.symbol} • ${chartState?.source === 'quote-derived' ? 'Real quote + derived intraday shape' : 'Fallback data'}`
    : 'Select a stock to view'

  return (
    <main className="page-shell d-flex align-items-center py-4 py-md-5">
      <Container className="px-3 px-md-4">
        <Card className="glass-panel mx-auto border-0 p-3 p-sm-4 p-lg-5">
          <MarketClock />
          <StockSearchBar onSelect={handleSelect} />
          {selectedStock && (
            <StockChartCard
              title={selectedStock.name}
              subtitle={quoteSubtitle}
              symbol={selectedStock.symbol}
              labels={chartState?.labels ?? selectedStock.labels}
              points={chartState?.points ?? selectedStock.points}
              lastUpdatedAt={chartState?.updatedAt}
              isStale={Boolean(chartState?.quote?.stale)}
              onRefresh={() => refreshSelectedStock({ manual: true })}
              isRefreshing={isRefreshing}
              refreshDisabled={isRateLimitCoolingDown()}
              liveToggleSupported={Boolean(hasToken && wsUrl)}
              liveEnabled={liveEnabled}
              liveStatus={liveStatus}
              onToggleLive={() => setLiveEnabled((prev) => !prev)}
              priceOverride={typeof currentPrice === 'number' ? currentPrice : undefined}
              changeOverride={chartState?.quote?.change}
              changePercentOverride={chartState?.quote?.changePercent}
            />
          )}
        </Card>
      </Container>
    </main>
  )
}

export default HomePage
