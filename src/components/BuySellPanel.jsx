import { useEffect, useState } from 'react'
import { Card } from 'react-bootstrap'
import {
  ACCOUNT_UPDATE_EVENT_NAME,
  buyStock,
  getAccount,
  getHolding,
  sellStock,
} from '../data/accountStorage.js'

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const shareFmt = (n) => (n % 1 === 0 ? String(n) : n.toFixed(4))

function BuySellPanel({ symbol, currentPrice }) {
  const [mode, setMode] = useState('buy')   // 'buy' | 'sell'
  const [inputMode, setInputMode] = useState('dollars') // 'dollars' | 'shares'
  const [rawValue, setRawValue] = useState('')
  const [status, setStatus] = useState(null)  // { type: 'success'|'error', message }
  const [account, setAccount] = useState(() => getAccount())
  const [holding, setHolding] = useState(() => getHolding(symbol))

  useEffect(() => {
    const refresh = () => {
      setAccount(getAccount())
      setHolding(getHolding(symbol))
    }
    window.addEventListener(ACCOUNT_UPDATE_EVENT_NAME, refresh)
    return () => window.removeEventListener(ACCOUNT_UPDATE_EVENT_NAME, refresh)
  }, [symbol])

  // Switch to sell if no cash but has shares
  useEffect(() => {
    if (!holding && mode === 'sell') setMode('buy')
  }, [holding, mode])

  const price = typeof currentPrice === 'number' && currentPrice > 0 ? currentPrice : null
  const value = parseFloat(rawValue) || 0

  let estimatedShares = 0
  let estimatedCost = 0

  if (price) {
    if (inputMode === 'dollars') {
      estimatedShares = value / price
      estimatedCost = value
    } else {
      estimatedShares = value
      estimatedCost = value * price
    }
  }

  const cashBalance = account.cashBalance
  const heldShares = holding?.shares ?? 0

  const buyPreviewOk = mode === 'buy' && estimatedCost > 0 && estimatedCost <= cashBalance && price
  const sellPreviewOk = mode === 'sell' && estimatedShares > 0 && estimatedShares <= heldShares && price

  function clearStatus() {
    setStatus(null)
  }

  function handleSubmit() {
    setStatus(null)
    if (!price) {
      setStatus({ type: 'error', message: 'Price not available. Try refreshing the quote.' })
      return
    }
    if (estimatedShares <= 0) {
      setStatus({ type: 'error', message: 'Enter an amount greater than zero.' })
      return
    }

    try {
      if (mode === 'buy') {
        buyStock(symbol, estimatedShares, price)
        setStatus({ type: 'success', message: `Bought ${shareFmt(estimatedShares)} share${estimatedShares !== 1 ? 's' : ''} of ${symbol} for ${currencyFmt.format(estimatedCost)}.` })
      } else {
        sellStock(symbol, estimatedShares, price)
        setStatus({ type: 'success', message: `Sold ${shareFmt(estimatedShares)} share${estimatedShares !== 1 ? 's' : ''} of ${symbol} for ${currencyFmt.format(estimatedCost)}.` })
      }
      setRawValue('')
    } catch (err) {
      const messages = {
        'insufficient-funds': `Not enough cash. You have ${currencyFmt.format(cashBalance)} available.`,
        'insufficient-shares': `You only have ${shareFmt(heldShares)} shares to sell.`,
        'not-holding': 'You do not own any shares of this stock.',
        'invalid-shares': 'Invalid share amount.',
        'invalid-price': 'Invalid price.',
      }
      setStatus({ type: 'error', message: messages[err.message] ?? 'Something went wrong.' })
    }
  }

  if (!price) {
    return null
  }

  return (
    <Card className="buy-sell-panel border-0 p-3 p-sm-4 mt-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="buy-sell-title mb-0">Trade {symbol}</h3>
        <div className="d-flex gap-2">
          <button
            type="button"
            className={`btn btn-sm ${mode === 'buy' ? 'btn-success' : 'btn-outline-secondary'}`}
            onClick={() => { setMode('buy'); clearStatus() }}
          >
            Buy
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'sell' ? 'btn-warning' : 'btn-outline-secondary'}`}
            disabled={!holding}
            onClick={() => { setMode('sell'); clearStatus() }}
            title={!holding ? 'You do not own any shares' : undefined}
          >
            Sell
          </button>
        </div>
      </div>

      {/* Context info */}
      <div className="d-flex flex-wrap gap-4 mb-3">
        <div>
          <div className="buy-sell-label">Current price</div>
          <div className="buy-sell-info">{currencyFmt.format(price)}</div>
        </div>
        <div>
          <div className="buy-sell-label">Cash available</div>
          <div className="buy-sell-info">{currencyFmt.format(cashBalance)}</div>
        </div>
        {holding && (
          <div>
            <div className="buy-sell-label">Shares owned</div>
            <div className="buy-sell-info">{shareFmt(heldShares)} shares</div>
          </div>
        )}
        {holding && (
          <div>
            <div className="buy-sell-label">Avg cost</div>
            <div className="buy-sell-info">{currencyFmt.format(holding.avgCost)}</div>
          </div>
        )}
      </div>

      {/* Input mode toggle */}
      <div className="d-flex align-items-center gap-2 mb-2">
        <span className="buy-sell-label">Enter by:</span>
        <button
          type="button"
          className={`btn btn-xs ${inputMode === 'dollars' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => { setInputMode('dollars'); setRawValue('') }}
        >
          Dollars ($)
        </button>
        <button
          type="button"
          className={`btn btn-xs ${inputMode === 'shares' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => { setInputMode('shares'); setRawValue('') }}
        >
          Shares
        </button>
      </div>

      {/* Amount input */}
      <div className="d-flex align-items-center gap-2 mb-3">
        <div className="buy-sell-input-wrap">
          <span className="buy-sell-input-prefix">
            {inputMode === 'dollars' ? '$' : '#'}
          </span>
          <input
            type="number"
            className="buy-sell-input"
            placeholder={inputMode === 'dollars' ? '0.00' : '0'}
            value={rawValue}
            min="0"
            step={inputMode === 'dollars' ? '1' : '0.0001'}
            onChange={(e) => { setRawValue(e.target.value); clearStatus() }}
          />
        </div>

        {/* Quick-fill buttons */}
        {mode === 'buy' && inputMode === 'dollars' && cashBalance > 0 && (
          <div className="d-flex gap-1">
            {[0.25, 0.5, 1].map((pct) => (
              <button
                key={pct}
                type="button"
                className="btn btn-xs btn-outline-secondary"
                onClick={() => setRawValue(String(Math.floor(cashBalance * pct * 100) / 100))}
              >
                {pct === 1 ? 'All' : `${pct * 100}%`}
              </button>
            ))}
          </div>
        )}
        {mode === 'sell' && inputMode === 'shares' && heldShares > 0 && (
          <div className="d-flex gap-1">
            {[0.25, 0.5, 1].map((pct) => (
              <button
                key={pct}
                type="button"
                className="btn btn-xs btn-outline-secondary"
                onClick={() => setRawValue(String(Math.floor(heldShares * pct * 10000) / 10000))}
              >
                {pct === 1 ? 'All' : `${pct * 100}%`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Preview */}
      {(estimatedShares > 0 || estimatedCost > 0) && price && (
        <div className="buy-sell-preview mb-3">
          <span>
            ≈ {shareFmt(estimatedShares)} shares
            &nbsp;×&nbsp;{currencyFmt.format(price)}
            &nbsp;= <strong>{currencyFmt.format(estimatedCost)}</strong>
          </span>
          {mode === 'buy' && estimatedCost > cashBalance && (
            <span className="text-danger ms-2">Exceeds available cash</span>
          )}
          {mode === 'sell' && estimatedShares > heldShares && (
            <span className="text-danger ms-2">Exceeds held shares</span>
          )}
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        className={`btn ${mode === 'buy' ? 'btn-success' : 'btn-warning'}`}
        onClick={handleSubmit}
        disabled={mode === 'buy' ? !buyPreviewOk : !sellPreviewOk}
      >
        {mode === 'buy'
          ? `Buy ${symbol}${estimatedCost > 0 ? ` for ${currencyFmt.format(estimatedCost)}` : ''}`
          : `Sell ${estimatedShares > 0 ? shareFmt(estimatedShares) + ' shares' : symbol}`}
      </button>

      {/* Status message */}
      {status && (
        <div className={`buy-sell-status mt-3 ${status.type === 'success' ? 'text-success' : 'text-danger'}`}>
          {status.type === 'success' ? '✓ ' : '✗ '}
          {status.message}
        </div>
      )}
    </Card>
  )
}

export default BuySellPanel
