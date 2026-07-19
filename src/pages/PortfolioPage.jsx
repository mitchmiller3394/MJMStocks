import { useEffect, useMemo, useState } from 'react'
import { Card, Container, Form } from 'react-bootstrap'
import { useNavigate } from 'react-router'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

import { MOCK_STOCKS } from '../data/mockStocks.js'
import {
  getFavoriteManualOrder,
  getFavoriteSymbols,
  getOwnedPositions,
  setFavoriteManualOrder,
  setFavoriteSymbols,
} from '../data/portfolioStorage.js'
import SortableStockCard from '../components/SortableStockCard.jsx'
import MarketClock from '../components/MarketClock.jsx'
import StockSearchBar from '../components/StockSearchBar.jsx'

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
  const [ownedPositions] = useState(() => getOwnedPositions())

  useEffect(() => {
    setFavoriteSymbols(favoriteSymbols)
  }, [favoriteSymbols])

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

        return {
          symbol,
          name: stock?.name ?? 'Unknown company',
          ...metrics,
        }
      }),
    [favoriteSymbols],
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
  return (
    <main className="page-shell py-4 py-md-5">
      <Container className="px-3 px-md-4">
        <Card className="glass-panel mx-auto border-0 p-3 p-sm-4 p-lg-5">
          <MarketClock />
          <StockSearchBar onSelect={handleSearchSelect} onFavoritesChange={handleFavoritesChange} />
          <p className="eyebrow mb-2">Portfolio</p>

          <section className="mb-4 mb-lg-5">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
              <button
                type="button"
                className="portfolio-collapse-btn"
                aria-expanded={favoritesExpanded}
                aria-controls="favorites-content"
                onClick={() => setFavoritesExpanded((prev) => !prev)}
              >
                <span className="portfolio-section-title mb-0">Favorited Stocks</span>
                <span className="portfolio-collapse-meta">
                  {favoriteSymbols.length} saved
                </span>
                <span
                  className={`portfolio-collapse-chevron${
                    favoritesExpanded ? ' is-open' : ''
                  }`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>
            </div>

            {favoritesExpanded && (
              <div id="favorites-content">
                <Form.Group controlId="portfolio-sort" className="portfolio-sort-wrap mb-3">
                  <Form.Label className="portfolio-sort-label mb-1">Sort</Form.Label>
                  <Form.Select
                    value={sortMode}
                    onChange={(event) => setSortMode(event.target.value)}
                    className="portfolio-sort-select"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                {favoriteSymbols.length === 0 ? (
                  <Card className="portfolio-empty-card border-0 p-3 p-sm-4">
                    <p className="portfolio-empty-title mb-1">No favorites yet</p>
                    <p className="portfolio-empty-copy mb-0">
                      Favorite symbols from Home to build your watchlist.
                    </p>
                  </Card>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={sortedSymbols}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="portfolio-list d-flex flex-column gap-3">
                        {sortedSymbols.map((symbol) => {
                          const stockView = viewBySymbol[symbol]
                          if (!stockView) return null

                          return (
                            <SortableStockCard
                              key={symbol}
                              stockView={stockView}
                              isManual={sortMode === 'manual'}
                              onToggleFavorite={toggleFavorite}
                              onOpenStock={openStockChart}
                            />
                          )
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            )}
          </section>

          <section>
            <h2 className="portfolio-section-title mb-3">Owned Positions</h2>

            {ownedPositions.length === 0 ? (
              <Card className="portfolio-empty-card border-0 p-3 p-sm-4">
                <p className="portfolio-empty-title mb-1">You currently hold no positions</p>
                <p className="portfolio-empty-copy mb-0">
                  Your owned stocks will appear here as soon as you place your first buy order.
                </p>
              </Card>
            ) : null}
          </section>
        </Card>
      </Container>
    </main>
  )
}

export default PortfolioPage
