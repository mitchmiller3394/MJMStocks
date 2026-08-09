import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Container } from 'react-bootstrap'
import { useNavigate } from 'react-router'
import {
  ACCOUNT_UPDATE_EVENT_NAME,
  canFundToday,
  fundAccount,
  getAccount,
  getMsUntilMidnight,
} from '../data/accountStorage.js'
import { getQuote } from '../data/finnhubClient.js'
import BalanceSummarySection from '../components/account/BalanceSummarySection.jsx'
import DailyFundingSection from '../components/account/DailyFundingSection.jsx'
import HoldingsProjectionsSection from '../components/account/HoldingsProjectionsSection.jsx'
import RecentActivitySection from '../components/account/RecentActivitySection.jsx'

// ─── Funding countdown timer ──────────────────────────────────────────────────
function useCountdown() {
  const [remaining, setRemaining] = useState(() => getMsUntilMidnight())

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining(getMsUntilMidnight())
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const h = Math.floor(remaining / 3_600_000)
  const m = Math.floor((remaining % 3_600_000) / 60_000)
  const s = Math.floor((remaining % 60_000) / 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

// ─── Main page ────────────────────────────────────────────────────────────────
function AccountPage() {
  const navigate = useNavigate()
  const [account, setAccount] = useState(() => getAccount())
  const [holdingPrices, setHoldingPrices] = useState({})
  const [fundAmount, setFundAmount] = useState(500)
  const [fundError, setFundError] = useState(null)
  const [fundSuccess, setFundSuccess] = useState(false)
  const [canFund, setCanFund] = useState(() => canFundToday())
  const countdown = useCountdown()

  const totals = useMemo(() => {
    const invested = account.holdings.reduce((sum, holding) => {
      const price =
        typeof holdingPrices[holding.symbol] === 'number'
          ? holdingPrices[holding.symbol]
          : holding.avgCost
      return sum + price * holding.shares
    }, 0)

    const total = account.cashBalance + invested
    const gainLoss = total - account.totalFunded

    return {
      invested,
      total,
      gainLoss,
      totalFunded: account.totalFunded,
    }
  }, [account, holdingPrices])

  const refreshAccount = useCallback(() => {
    const fresh = getAccount()
    setAccount(fresh)
    setCanFund(canFundToday())
  }, [])

  const refreshHoldingPrices = useCallback(async () => {
    const symbols = account.holdings.map((holding) => holding.symbol)
    if (symbols.length === 0) {
      setHoldingPrices({})
      return
    }

    const results = await Promise.all(
      symbols.map((symbol) =>
        getQuote(symbol)
          .then((quote) => ({ symbol, price: quote?.currentPrice }))
          .catch(() => ({ symbol, price: undefined })),
      ),
    )

    setHoldingPrices((prev) => {
      const next = { ...prev }
      results.forEach(({ symbol, price }) => {
        if (typeof price === 'number' && Number.isFinite(price)) {
          next[symbol] = price
        }
      })
      return next
    })
  }, [account.holdings])

  useEffect(() => {
    window.addEventListener(ACCOUNT_UPDATE_EVENT_NAME, refreshAccount)
    return () => window.removeEventListener(ACCOUNT_UPDATE_EVENT_NAME, refreshAccount)
  }, [refreshAccount])

  useEffect(() => {
    refreshHoldingPrices()
  }, [refreshHoldingPrices])

  useEffect(() => {
    if (account.holdings.length === 0) return undefined

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      refreshHoldingPrices()
    }, 30_000)

    return () => window.clearInterval(intervalId)
  }, [account.holdings.length, refreshHoldingPrices])

  function handleFund() {
    setFundError(null)
    setFundSuccess(false)
    try {
      fundAccount(fundAmount)
      setFundSuccess(true)
      setTimeout(() => setFundSuccess(false), 3000)
    } catch (err) {
      setFundError(err.message === 'already-funded-today'
        ? 'You have already funded your account today.'
        : 'Invalid amount. Please enter between $1 and $2,000.')
    }
  }

  const recentTxns = account.transactions.slice(0, 5)

  return (
    <main className="page-shell py-4 py-md-5">
      <Container className="px-3 px-md-4">
        <Card className="glass-panel mx-auto border-0 p-3 p-sm-4 p-lg-5">
          <p className="eyebrow mb-2">Account</p>
          <h1 className="account-page-title mb-1">Paper Trading Account</h1>
          <p className="account-subtitle mb-4">
            Practice investing with simulated money. All trades are virtual — no real money involved.
          </p>

          <BalanceSummarySection cashBalance={account.cashBalance} totals={totals} />

          <DailyFundingSection
            fundAmount={fundAmount}
            setFundAmount={setFundAmount}
            canFund={canFund}
            countdown={countdown}
            fundSuccess={fundSuccess}
            fundError={fundError}
            totalFunded={account.totalFunded}
            onFund={handleFund}
          />

          <HoldingsProjectionsSection
            holdings={account.holdings}
            holdingPrices={holdingPrices}
            onViewPortfolio={() => navigate('/portfolio')}
          />

          <RecentActivitySection
            transactions={recentTxns}
            onViewTransactions={() => navigate('/transactions')}
          />
        </Card>
      </Container>
    </main>
  )
}

export default AccountPage
