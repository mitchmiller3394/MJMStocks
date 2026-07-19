import { useState, useRef, useEffect } from 'react'
import { MOCK_STOCKS } from '../data/mockStocks.js'
import {
  getFavoriteSymbols,
  getRecentSymbols,
  setFavoriteSymbols,
  setRecentSymbols,
} from '../data/portfolioStorage.js'

const stocksBySymbol = Object.fromEntries(MOCK_STOCKS.map((stock) => [stock.symbol, stock]))

function StockSearchBar({ onSelect, onFavoritesChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [recentSymbols, setRecentSymbolsState] = useState(() => getRecentSymbols())
  const [favoriteSymbols, setFavoriteSymbolsState] = useState(() => getFavoriteSymbols())
  const containerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setRecentSymbols(recentSymbols)
  }, [recentSymbols])

  useEffect(() => {
    setFavoriteSymbols(favoriteSymbols)
    if (onFavoritesChange) {
      onFavoritesChange(favoriteSymbols)
    }
  }, [favoriteSymbols, onFavoritesChange])

  const trimmed = query.trim()

  const filtered =
    trimmed.length === 0
      ? []
      : MOCK_STOCKS.filter(
          (s) =>
            s.symbol.toLowerCase().includes(trimmed.toLowerCase()) ||
            s.name.toLowerCase().includes(trimmed.toLowerCase()),
        )

  const recentStocks = recentSymbols
    .map((symbol) => stocksBySymbol[symbol])
    .filter(Boolean)

  const hasExactMatch = MOCK_STOCKS.some(
    (s) => s.symbol.toLowerCase() === trimmed.toLowerCase(),
  )
  const showApiHint = trimmed.length > 0 && !hasExactMatch

  function isFavorite(symbol) {
    return favoriteSymbols.includes(symbol)
  }

  function toggleFavorite(symbol) {
    setFavoriteSymbolsState((prev) => {
      if (prev.includes(symbol)) {
        return prev.filter((entry) => entry !== symbol)
      }

      return [symbol, ...prev]
    })
  }

  function renderStockRow(stock) {
    return (
      <li
        key={stock.symbol}
        className="stock-search-item"
        role="option"
        onMouseDown={() => handleSelect(stock)}
      >
        <div className="stock-search-item-main">
          <span className="stock-search-symbol">{stock.symbol}</span>
          <span className="stock-search-name">{stock.name}</span>
        </div>
        <button
          type="button"
          className={`stock-search-fav-btn ${
            isFavorite(stock.symbol) ? 'is-favorite' : ''
          }`}
          aria-label={`${
            isFavorite(stock.symbol) ? 'Remove from favorites' : 'Add to favorites'
          } ${stock.symbol}`}
          title={isFavorite(stock.symbol) ? 'Remove favorite' : 'Add favorite'}
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            toggleFavorite(stock.symbol)
          }}
        >
          {isFavorite(stock.symbol) ? '★' : '☆'}
        </button>
      </li>
    )
  }

  function handleSelect(stock) {
    onSelect(stock)
    setQuery(stock.symbol)
    setOpen(false)
    setRecentSymbolsState((prev) => {
      const withoutDuplicate = prev.filter((symbol) => symbol !== stock.symbol)
      return [stock.symbol, ...withoutDuplicate].slice(0, 3)
    })
  }

  function handleInputChange(e) {
    setQuery(e.target.value)
    setOpen(true)
  }

  function handleClear() {
    setQuery('')
    setOpen(true)
  }

  function handleInputKeyDown(e) {
    if (e.key !== 'Enter') {
      return
    }

    e.preventDefault()

    const normalized = trimmed.toLowerCase()
    const exactMatch = MOCK_STOCKS.find(
      (stock) => stock.symbol.toLowerCase() === normalized,
    )

    if (exactMatch) {
      handleSelect(exactMatch)
      return
    }

    onSelect(null)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="stock-search-wrap mb-4 mb-lg-5">
      <div className="stock-search-input-wrap">
        <span className="stock-search-icon" aria-hidden="true">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          type="text"
          className="stock-search-input"
          placeholder="Search by symbol or name…"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onFocus={() => setOpen(true)}
          autoComplete="off"
          spellCheck={false}
          aria-label="Search for a stock"
          aria-haspopup="listbox"
          aria-expanded={open}
        />
        {query && (
          <button
            className="stock-search-clear"
            onClick={handleClear}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <ul className="stock-search-dropdown" role="listbox">
          {trimmed.length === 0 && recentStocks.length > 0 && (
            <li className="stock-search-section-label" aria-hidden="true">
              Recent
            </li>
          )}

          {trimmed.length === 0 && recentStocks.map((stock) => renderStockRow(stock))}

          {trimmed.length === 0 && (
            <li className="stock-search-hint" role="option" aria-disabled="true">
              Start typing to search stocks by symbol or name.
            </li>
          )}

          {trimmed.length > 0 && filtered.map((stock) => renderStockRow(stock))}

          {showApiHint && (
            <li
              className="stock-search-item stock-search-api-hint"
              role="option"
              aria-disabled="true"
            >
              <span className="stock-search-symbol stock-search-api-symbol">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {trimmed.toUpperCase()}
              </span>
              <span className="stock-search-name">Live API search — coming soon</span>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

export default StockSearchBar
