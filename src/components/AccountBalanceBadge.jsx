import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  ACCOUNT_UPDATE_EVENT_NAME,
  getAccount,
  getTotalPortfolioValue,
} from '../data/accountStorage.js'
import { getQuote } from '../data/finnhubClient.js'

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function AccountBalanceBadge() {
  const [totals, setTotals] = useState(() => getTotalPortfolioValue())
  const [flashClass, setFlashClass] = useState('')
  const prevTotalRef = useRef(totals.total)
  const flashTimerRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  const updateTotals = useCallback((priceMap = {}) => {
    const next = getTotalPortfolioValue(priceMap)
    const prev = prevTotalRef.current
    const delta = next.total - prev

    if (Math.abs(delta) > 0.001) {
      const cls = delta > 0 ? 'balance-flash-up' : 'balance-flash-down'
      setFlashClass(cls)
      clearTimeout(flashTimerRef.current)
      flashTimerRef.current = setTimeout(() => setFlashClass(''), 1200)
    }

    prevTotalRef.current = next.total
    setTotals(next)
  }, [])

  const refreshHoldingPrices = useCallback(async () => {
    const account = getAccount()
    const symbols = account.holdings.map((holding) => holding.symbol)

    if (symbols.length === 0) {
      updateTotals({})
      return
    }

    const results = await Promise.all(
      symbols.map((symbol) =>
        getQuote(symbol)
          .then((quote) => ({ symbol, price: quote?.currentPrice }))
          .catch(() => ({ symbol, price: undefined })),
      ),
    )

    const priceMap = {}
    results.forEach(({ symbol, price }) => {
      if (typeof price === 'number' && Number.isFinite(price)) {
        priceMap[symbol] = price
      }
    })

    updateTotals(priceMap)
  }, [updateTotals])

  useEffect(() => {
    refreshHoldingPrices()
  }, [refreshHoldingPrices])

  useEffect(() => {
    const handleAccountUpdate = () => {
      refreshHoldingPrices()
    }

    window.addEventListener(ACCOUNT_UPDATE_EVENT_NAME, handleAccountUpdate)
    return () => {
      window.removeEventListener(ACCOUNT_UPDATE_EVENT_NAME, handleAccountUpdate)
      clearTimeout(flashTimerRef.current)
    }
  }, [refreshHoldingPrices])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshHoldingPrices()
      }
    }, 30_000)

    return () => window.clearInterval(intervalId)
  }, [refreshHoldingPrices])

  return (
    <button
      type="button"
      className={`account-balance-badge ${flashClass}${location.pathname === '/account' ? ' active' : ''}`}
      onClick={() => navigate('/account')}
    >
      <span className="account-balance-icon" aria-hidden="true">👤</span>
      <span className="account-balance-wrap">
        <span className="account-balance-row">
          <span className="account-balance-label">Cash</span>
          <span className="account-balance-value">{currencyFmt.format(totals.cash)}</span>
        </span>
        <span className="account-balance-row">
          <span className="account-balance-label">Total</span>
          <span className="account-balance-value">{currencyFmt.format(totals.total)}</span>
        </span>
      </span>
    </button>
  )
}

export default AccountBalanceBadge
