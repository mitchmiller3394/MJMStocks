import { Card } from 'react-bootstrap'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'


const numberFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

function SortableStockCard({ stockView, isManual, onToggleFavorite, onOpenStock }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stockView.symbol, disabled: !isManual })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const deltaClass =
    typeof stockView.changeValue === 'number'
      ? stockView.changeValue >= 0
        ? 'text-success'
        : 'text-danger'
      : 'text-muted'

  const changeLabel =
    typeof stockView.changeValue === 'number' &&
    typeof stockView.changePct === 'number'
      ? `${stockView.changeValue >= 0 ? '+' : ''}${stockView.changeValue.toFixed(2)} (${stockView.changePct.toFixed(2)}%)`
      : 'Data unavailable'

  const updatedLabel =
    typeof stockView.updatedAt === 'number'
      ? new Date(stockView.updatedAt).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
        })
      : null

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`portfolio-stock-item portfolio-stock-item-clickable border-0 p-3 p-sm-4${isDragging ? ' is-dragging' : ''}`}
      onClick={() => onOpenStock(stockView.symbol)}
    >
      <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
        <div className="d-flex align-items-center gap-3 min-w-0">
          <button
            type="button"
            className={`portfolio-drag-handle${isManual ? '' : ' is-disabled'}`}
            title={isManual ? 'Drag to reorder' : 'Switch to Manual sort to drag'}
            aria-label={`Reorder ${stockView.symbol}`}
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>

          <div className="min-w-0">
            <h2 className="portfolio-stock-symbol mb-1">{stockView.symbol}</h2>
            <p className="portfolio-stock-name mb-0">{stockView.name}</p>
          </div>
        </div>

        <div className="d-flex align-items-center gap-3 ms-sm-auto">
          <div className="text-end">
            <div className="portfolio-stock-price">
              {typeof stockView.lastPrice === 'number'
                ? numberFormatter.format(stockView.lastPrice)
                : '—'}
            </div>
            <div className={`portfolio-stock-change ${deltaClass}`}>{changeLabel}</div>
            {(stockView.stale || updatedLabel) && (
              <div className="stock-subtitle">
                {stockView.stale ? 'Cached quote' : 'Live quote'}
                {updatedLabel ? ` • ${updatedLabel}` : ''}
              </div>
            )}
          </div>

          <button
            type="button"
            className="portfolio-favorite-btn"
            aria-label={`Remove ${stockView.symbol} from favorites`}
            title="Remove from favorites"
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite(stockView.symbol)
            }}
          >
            ★
          </button>
        </div>
      </div>
    </Card>
  )
}

export default SortableStockCard;