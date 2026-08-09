import { useEffect, useMemo, useState } from 'react'
import { Card, Container } from 'react-bootstrap'
import { useNavigate } from 'react-router'
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'

import { MOCK_STOCKS } from '../data/mockStocks.js'
import {
  getFavoriteManualOrder,
  getFavoriteSymbols,
  setFavoriteManualOrder,
  setFavoriteSymbols,
} from '../data/portfolioStorage.js'
import {
  ACCOUNT_UPDATE_EVENT_NAME,
  getAllHoldings,
} from '../data/accountStorage.js'
import MarketClock from '../components/MarketClock.jsx'
import StockSearchBar from '../components/StockSearchBar.jsx'
import { getQuote, isRateLimitCoolingDown } from '../data/finnhubClient.js'
import FavoritesSection from '../components/portfolio/FavoritesSection.jsx'
import OwnedPositionsSection from '../components/portfolio/OwnedPositionsSection.jsx'

const SORT_OPTIONS = [
  { value: 'manual', label: 'Manual (drag to reorder)' },
  { value: 'symbol-asc', label: 'Symbol (A → Z)' },
  { value: 'symbol-desc', label: 'Symbol (Z → A)' },
  { value: 'name-asc', label: 'Name (A → Z)' },
  { value: 'name-desc', label: 'Name (Z → A)' },
  { value: 'price-desc', label: 'Price (High → Low)' },
  { value: 'price-asc', label: 'Price (Low → High)' },
  { value: 'change-desc', label: 'Change % (High → Low)' },
  { value: 'change-asc', label: 'Change % (Low → High)' },
]

const stockBySymbol = Object.fromEntries(
  MOCK_STOCKS.map((stock) => [stock.symbol, stock]),
)

function compareMaybeNumber(a, b, direction = 'asc') {
  const aHas = typeof a === 'number'
  const bHas = typeof b === 'number'

  if (!aHas && !bHas) return 0
  if (!aHas) return 1
  if (!bHas) return -1

  return direction === 'asc' ? a - b : b - a
}

function getStockMetrics(stock) {
  const points = stock?.points ?? []
  const open = points[0]
  const last = points[points.length - 1]

  if (typeof open !== 'number' || typeof last !== 'number') {
    return {
      lastPrice: undefined,
      changeValue: undefined,
      changePct: undefined,
    }
  }

  const changeValue = last - open

  return {
    lastPrice: last,
    changeValue,
    changePct: open === 0 ? undefined : (changeValue / open) * 100,
  }
}

function PortfolioPage() {
  const navigate = useNavigate()
  const [favoriteSymbols, setFavoriteSymbolsState] = useState(() =>
    getFavoriteSymbols(),
  )
  const [manualOrder, setManualOrder] = useState(() => getFavoriteManualOrder())
  const [sortMode, setSortMode] = useState('manual')
  const [favoritesExpanded, setFavoritesExpanded] = useState(true)
  const [ownedPositions, setOwnedPositions] = useState(() => getAllHoldings())
  const [ownedQuotes, setOwnedQuotes] = useState({})
  const [quotesBySymbol, setQuotesBySymbol] = useState({})
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState(false)
  const [lastQuotesRefreshAt, setLastQuotesRefreshAt] = useState(0)
  const ownedSymbolsKey = useMemo(
    () => ownedPositions.map((pos) => pos.symbol).sort().join('|'),
    [ownedPositions],
  )

  useEffect(() => {
    setFavoriteSymbols(favoriteSymbols)
  }, [favoriteSymbols])

  useEffect(() => {
    const refresh = () => setOwnedPositions(getAllHoldings())
    window.addEventListener(ACCOUNT_UPDATE_EVENT_NAME, refresh)
    return () => window.removeEventListener(ACCOUNT_UPDATE_EVENT_NAME, refresh)
  }, [])

  useEffect(() => {
    const symbols = ownedPositions.map((pos) => pos.symbol)
    if (symbols.length === 0) {
      setOwnedQuotes({})
      return undefined
    }

    let canceled = false

    const refreshOwnedQuotes = async () => {
      const quoteResults = await Promise.all(
        symbols.map((symbol) =>
          getQuote(symbol)
            .then((quote) => ({ symbol, price: quote?.currentPrice }))
            .catch(() => ({ symbol, price: undefined })),
        ),
      )

      if (canceled) return

      setOwnedQuotes((prev) => {
        const next = { ...prev }
        quoteResults.forEach(({ symbol, price }) => {
          if (typeof price === 'number' && Number.isFinite(price)) {
            next[symbol] = price
          }
        })
        return next
      })
    }

    refreshOwnedQuotes()

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      refreshOwnedQuotes()
    }, 30_000)

    return () => {
      canceled = true
      window.clearInterval(intervalId)
    }
  }, [ownedSymbolsKey])
  const manualSymbols = useMemo(() => {
    const filteredManual = manualOrder.filter((symbol) =>
      favoriteSymbols.includes(symbol),
    )

    const missingSymbols = favoriteSymbols.filter(
      (symbol) => !filteredManual.includes(symbol),
    )

    return [...filteredManual, ...missingSymbols]
  }, [favoriteSymbols, manualOrder])

  useEffect(() => {
    setFavoriteManualOrder(manualSymbols)
  }, [manualSymbols])

  const favoriteStockViews = useMemo(
    () =>
      favoriteSymbols.map((symbol) => {
        const stock = stockBySymbol[symbol]
        const metrics = getStockMetrics(stock)
        const quote = quotesBySymbol[symbol]

        return {
          symbol,
          name: stock?.name ?? symbol,
          lastPrice:
            typeof quote?.currentPrice === 'number' ? quote.currentPrice : metrics.lastPrice,
          changeValue:
            typeof quote?.change === 'number' ? quote.change : metrics.changeValue,
          changePct:
            typeof quote?.changePercent === 'number'
              ? quote.changePercent
              : metrics.changePct,
          stale: Boolean(quote?.stale),
          updatedAt: quote?.updatedAt,
        }
      }),
    [favoriteSymbols, quotesBySymbol],
  )

  const sortedSymbols = useMemo(() => {
    if (sortMode === 'manual') {
      return manualSymbols
    }

    const entries = [...favoriteStockViews]

    entries.sort((a, b) => {
      switch (sortMode) {
        case 'symbol-asc':
          return a.symbol.localeCompare(b.symbol)
        case 'symbol-desc':
          return b.symbol.localeCompare(a.symbol)
        case 'name-asc':
          return a.name.localeCompare(b.name)
        case 'name-desc':
          return b.name.localeCompare(a.name)
        case 'price-asc':
          return compareMaybeNumber(a.lastPrice, b.lastPrice, 'asc')
        case 'price-desc':
          return compareMaybeNumber(a.lastPrice, b.lastPrice, 'desc')
        case 'change-asc':
          return compareMaybeNumber(a.changePct, b.changePct, 'asc')
        case 'change-desc':
          return compareMaybeNumber(a.changePct, b.changePct, 'desc')
        default:
          return 0
      }
    })

    return entries.map((entry) => entry.symbol)
  }, [favoriteStockViews, manualSymbols, sortMode])

  const viewBySymbol = useMemo(
    () => Object.fromEntries(favoriteStockViews.map((entry) => [entry.symbol, entry])),
    [favoriteStockViews],
  )

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd(event) {
    if (sortMode !== 'manual') {
      return
    }

    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = manualSymbols.indexOf(active.id)
    const newIndex = manualSymbols.indexOf(over.id)

    if (oldIndex < 0 || newIndex < 0) {
      return
    }

    setManualOrder(arrayMove(manualSymbols, oldIndex, newIndex))
  }

  function toggleFavorite(symbol) {
    setFavoriteSymbolsState((prev) => prev.filter((entry) => entry !== symbol))
  }

  async function refreshQuotes({ manual = false } = {}) {
    if (!favoritesExpanded || sortedSymbols.length === 0) {
      return
    }

    if (manual) {
      const tooSoon = Date.now() - lastQuotesRefreshAt < 10_000
      if (tooSoon || isRateLimitCoolingDown()) {
        return
      }
    }

    setIsRefreshingQuotes(true)

    try {
      const symbolsToRefresh = sortedSymbols
      const quoteResults = await Promise.all(
        symbolsToRefresh.map((symbol) =>
          getQuote(symbol)
            .then((quote) => ({ symbol, quote }))
            .catch(() => ({ symbol, quote: null })),
        ),
      )

      setQuotesBySymbol((prev) => {
        const next = { ...prev }

        quoteResults.forEach(({ symbol, quote }) => {
          if (quote) {
            next[symbol] = quote
          }
        })

        return next
      })

      setLastQuotesRefreshAt(Date.now())
    } finally {
      setIsRefreshingQuotes(false)
    }
  }

  function openStockChart(symbol) {
    navigate(`/?symbol=${encodeURIComponent(symbol)}`)
  }

  function handleSearchSelect(stock) {
    if (stock?.symbol) {
      openStockChart(stock.symbol)
    }
  }
  function handleFavoritesChange(updatedFavorites) {
    setFavoriteSymbolsState(updatedFavorites)
  }

  useEffect(() => {
    if (!favoritesExpanded || sortedSymbols.length === 0) {
      return
    }

    refreshQuotes()
  }, [favoritesExpanded, sortedSymbols.join('|')])

  useEffect(() => {
    if (!favoritesExpanded || sortedSymbols.length === 0) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return
      }

      refreshQuotes()
    }, 30_000)

    return () => window.clearInterval(intervalId)
  }, [favoritesExpanded, sortedSymbols.join('|')])

  const favoritesLastUpdated =
    lastQuotesRefreshAt > 0
      ? new Date(lastQuotesRefreshAt).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
        })
      : null

  return (
    <main className="page-shell py-4 py-md-5">
      <Container className="px-3 px-md-4">
        <Card className="glass-panel mx-auto border-0 p-3 p-sm-4 p-lg-5">
          <MarketClock />
          <StockSearchBar onSelect={handleSearchSelect} onFavoritesChange={handleFavoritesChange} />
          <p className="eyebrow mb-2">Portfolio</p>

          <FavoritesSection
            favoritesExpanded={favoritesExpanded}
            favoriteSymbols={favoriteSymbols}
            isRefreshingQuotes={isRefreshingQuotes}
            onToggleExpanded={() => setFavoritesExpanded((prev) => !prev)}
            onManualRefresh={() => refreshQuotes({ manual: true })}
            favoritesLastUpdated={favoritesLastUpdated}
            sortMode={sortMode}
            onSortModeChange={setSortMode}
            sortOptions={SORT_OPTIONS}
            sensors={sensors}
            sortedSymbols={sortedSymbols}
            onDragEnd={handleDragEnd}
            viewBySymbol={viewBySymbol}
            onToggleFavorite={toggleFavorite}
            onOpenStock={openStockChart}
            isRateLimitCoolingDown={isRateLimitCoolingDown()}
          />

          <OwnedPositionsSection
            ownedPositions={ownedPositions}
            ownedQuotes={ownedQuotes}
            stockBySymbol={stockBySymbol}
            onOpenStock={openStockChart}
          />
        </Card>
      </Container>
    </main>
  )
}

export default PortfolioPage
