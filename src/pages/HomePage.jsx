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
  getEodHistoricalData,
  hasFinnhubToken,
  isRateLimitCoolingDown,
} from '../data/finnhubClient.js'

const stockBySymbol = Object.fromEntries(
  MOCK_STOCKS.map((stock) => [stock.symbol, stock]),
)

const timeframeLabelMap = {
  '1D': '1 Day',
  '1W': '1 Week',
  '1M': '1 Month',
  '3M': '3 Months',
  '6M': '6 Months',
  '1Y': '1 Year',
  '5Y': '5 Years',
}

function HomePage() {
  const [selectedStock, setSelectedStock] = useState(null)
  const [chartState, setChartState] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [liveEnabled, setLiveEnabled] = useState(false)
  const [liveStatus, setLiveStatus] = useState('off')
  const [timeframe, setTimeframe] = useState('1M')
  const lastRefreshAtRef = useRef(0)
  const wsRef = useRef(null)
  const locationSearchRef = useRef('')

  const location = useLocation()
  const navigate = useNavigate()

  const wsUrl = useMemo(() => getFinnhubWsUrl(), [])
  const hasToken = useMemo(() => hasFinnhubToken(), [])

  const refreshSelectedStock = useCallback(
    async ({ manual = false, timeframe: requestedTimeframe = timeframe } = {}) => {
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

        let eodData = null
        try {
          const eodResult = await getEodHistoricalData(selectedStock.symbol, requestedTimeframe)
          eodData = eodResult.data
        } catch {
          // EOD fetch failed, will fall back to derived
        }

        const fallback = stockBySymbol[selectedStock.symbol] || stockBySymbol.AAPL

        let chartData
        if (eodData && Array.isArray(eodData.points) && eodData.points.length > 0) {
          chartData = {
            quote,
            labels: eodData.labels,
            points: eodData.points,
            source: requestedTimeframe === '1D' ? 'intraday' : 'eod',
            timeframe: requestedTimeframe,
            updatedAt: quote.updatedAt ?? Date.now(),
          }
        } else {
          const derived = buildPseudoIntradaySeries({
            labels: fallback?.labels,
            fallbackPoints: fallback?.points,
            quote,
          })

          chartData = {
            quote,
            labels: derived.labels,
            points: derived.points,
            source: derived.source,
            timeframe: requestedTimeframe,
            updatedAt: quote.updatedAt ?? Date.now(),
          }
        }

        setChartState(chartData)
        lastRefreshAtRef.current = Date.now()
      } catch {
        const fallback = stockBySymbol[selectedStock.symbol] || stockBySymbol.AAPL
        setChartState({
          quote: null,
          labels: fallback?.labels,
          points: fallback?.points,
          source: 'mock',
          timeframe: requestedTimeframe,
          updatedAt: Date.now(),
        })
      } finally {
        setIsRefreshing(false)
      }
    },
    [selectedStock, timeframe],
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

    refreshSelectedStock({ timeframe })
  }, [selectedStock, timeframe, refreshSelectedStock])

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

      refreshSelectedStock({ timeframe })
    }, 30_000)

    return () => window.clearInterval(intervalId)
  }, [selectedStock, liveEnabled, liveStatus, refreshSelectedStock, timeframe])

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
    ? `${selectedStock.symbol} • ${
        chartState?.source === 'intraday'
          ? 'Real 5-minute intraday prices'
          : chartState?.source === 'eod'
            ? 'Real daily close prices'
          : chartState?.source === 'quote-derived'
            ? 'Real quote + derived intraday shape'
            : 'Fallback data'
      } • ${timeframeLabelMap[timeframe] ?? timeframe}`
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
              timeframe={timeframe}
              timeframeLabel={timeframeLabelMap[timeframe] ?? timeframe}
              onTimeframeChange={setTimeframe}
              lastUpdatedAt={chartState?.updatedAt}
              isStale={Boolean(chartState?.quote?.stale)}
              onRefresh={() => refreshSelectedStock({ manual: true, timeframe })}
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
