import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  ACCOUNT_UPDATE_EVENT_NAME,
  getTotalPortfolioValue,
} from '../data/accountStorage.js'

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function AccountBalanceBadge() {
  const [totals, setTotals] = useState(() => getTotalPortfolioValue())
  const [flashClass, setFlashClass] = useState('')
  const prevTotalRef = useRef(totals.total)
  const flashTimerRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  const refresh = useCallback(() => {
    const next = getTotalPortfolioValue()
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

  useEffect(() => {
    window.addEventListener(ACCOUNT_UPDATE_EVENT_NAME, refresh)
    return () => {
      window.removeEventListener(ACCOUNT_UPDATE_EVENT_NAME, refresh)
      clearTimeout(flashTimerRef.current)
    }
  }, [refresh])

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
