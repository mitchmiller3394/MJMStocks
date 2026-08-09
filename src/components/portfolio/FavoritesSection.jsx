import { Card, Form } from 'react-bootstrap'
import {
  DndContext,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import SortableStockCard from '../SortableStockCard.jsx'

function FavoritesSection({
  favoritesExpanded,
  favoriteSymbols,
  isRefreshingQuotes,
  onToggleExpanded,
  onManualRefresh,
  favoritesLastUpdated,
  sortMode,
  onSortModeChange,
  sortOptions,
  sensors,
  sortedSymbols,
  onDragEnd,
  viewBySymbol,
  onToggleFavorite,
  onOpenStock,
  isRateLimitCoolingDown,
}) {
  return (
    <section className="mb-4 mb-lg-5">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <button
          type="button"
          className="portfolio-collapse-btn"
          aria-expanded={favoritesExpanded}
          aria-controls="favorites-content"
          onClick={onToggleExpanded}
        >
          <span className="portfolio-section-title mb-0">Favorited Stocks</span>
          <span className="portfolio-collapse-meta">
            {favoriteSymbols.length} saved
          </span>
          <span
            className={`portfolio-collapse-chevron${favoritesExpanded ? ' is-open' : ''}`}
            aria-hidden="true"
          >
            ▾
          </span>
        </button>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-light"
            onClick={onManualRefresh}
            disabled={isRefreshingQuotes || isRateLimitCoolingDown}
          >
            {isRefreshingQuotes ? 'Refreshing…' : 'Refresh visible'}
          </button>
        </div>
      </div>

      {favoritesLastUpdated && (
        <p className="stock-subtitle mb-2">Last updated {favoritesLastUpdated}</p>
      )}

      {favoritesExpanded && (
        <div id="favorites-content">
          <Form.Group controlId="portfolio-sort" className="portfolio-sort-wrap mb-3">
            <Form.Label className="portfolio-sort-label mb-1">Sort</Form.Label>
            <Form.Select
              value={sortMode}
              onChange={(event) => onSortModeChange(event.target.value)}
              className="portfolio-sort-select"
            >
              {sortOptions.map((option) => (
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
              onDragEnd={onDragEnd}
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
                        onToggleFavorite={onToggleFavorite}
                        onOpenStock={onOpenStock}
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
  )
}

export default FavoritesSection
