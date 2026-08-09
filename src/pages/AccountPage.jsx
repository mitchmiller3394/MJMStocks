import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Card, Col, Container, Form, ProgressBar, Row } from 'react-bootstrap'
import { Link, useNavigate } from 'react-router'
import {
  ACCOUNT_UPDATE_EVENT_NAME,
  canFundToday,
  fundAccount,
  getAccount,
  getMsUntilMidnight,
} from '../data/accountStorage.js'
import { getQuote } from '../data/finnhubClient.js'
import HoldingProjectionCard from '../components/HoldingProjectionCard.jsx'

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const pctFmt = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

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

  const gainLossClass = totals.gainLoss >= 0 ? 'text-success' : 'text-danger'
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

          {/* ─── Balance summary ─── */}
          <Row className="g-3 mb-4">
            <Col xs={12} sm={6} lg={3}>
              <Card className="account-stat-card border-0 p-3">
                <div className="account-stat-label">Cash Available</div>
                <div className="account-stat-value text-info">
                  {currencyFmt.format(account.cashBalance)}
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={6} lg={3}>
              <Card className="account-stat-card border-0 p-3">
                <div className="account-stat-label">Invested</div>
                <div className="account-stat-value">
                  {currencyFmt.format(totals.invested)}
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={6} lg={3}>
              <Card className="account-stat-card border-0 p-3">
                <div className="account-stat-label">Total Value</div>
                <div className="account-stat-value">
                  {currencyFmt.format(totals.total)}
                </div>
              </Card>
            </Col>
            <Col xs={12} sm={6} lg={3}>
              <Card className="account-stat-card border-0 p-3">
                <div className="account-stat-label">Total Gain / Loss</div>
                <div className={`account-stat-value ${gainLossClass}`}>
                  {currencyFmt.format(totals.gainLoss)}
                  {totals.totalFunded > 0 && (
                    <span className="account-stat-pct ms-1">
                      ({pctFmt((totals.gainLoss / totals.totalFunded) * 100)})
                    </span>
                  )}
                </div>
              </Card>
            </Col>
          </Row>

          {/* ─── Daily funding ─── */}
          <Card className="account-section-card border-0 p-3 p-sm-4 mb-4">
            <h2 className="account-section-title mb-1">Daily Funding</h2>
            <p className="account-subtitle mb-3">
              Add up to $2,000 to your account once per day. See how consistent contributions grow over time.
            </p>

            <div className="d-flex flex-wrap align-items-center gap-3 mb-2">
              <span className="account-subtitle">Amount: {currencyFmt.format(fundAmount)}</span>
            </div>

            <Form.Range
              min={1}
              max={2000}
              step={1}
              value={fundAmount}
              onChange={(e) => setFundAmount(Number(e.target.value))}
              disabled={!canFund}
              className="account-fund-slider mb-2"
            />
            <div className="d-flex justify-content-between account-subtitle mb-3">
              <span>$1</span><span>$2,000</span>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-3">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleFund}
                disabled={!canFund}
              >
                {canFund ? `Add ${currencyFmt.format(fundAmount)} to Account` : 'Already Funded Today'}
              </button>

              {!canFund && (
                <div className="account-countdown">
                  <span className="account-subtitle">Next funding in </span>
                  <span className="account-countdown-timer">{countdown}</span>
                </div>
              )}

              {fundSuccess && (
                <span className="text-success fw-semibold">✓ Funds added!</span>
              )}
              {fundError && (
                <span className="text-danger">{fundError}</span>
              )}
            </div>

            <div className="mt-3">
              <ProgressBar
                now={Math.min(100, (account.totalFunded / 10000) * 100)}
                variant="info"
                className="account-fund-progress"
                label={`${currencyFmt.format(account.totalFunded)} funded`}
              />
              <div className="account-subtitle mt-1">
                Total funded: {currencyFmt.format(account.totalFunded)} (goal: $10,000)
              </div>
            </div>
          </Card>

          {/* ─── Holdings & projections ─── */}
          <Card className="account-section-card border-0 p-3 p-sm-4 mb-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h2 className="account-section-title mb-0">Holdings & Projections</h2>
              <button
                type="button"
                className="btn btn-sm btn-outline-light"
                onClick={() => navigate('/portfolio')}
              >
                View Portfolio →
              </button>
            </div>

            {account.holdings.length === 0 ? (
              <div className="account-empty-state">
                <p className="account-empty-title">No positions yet</p>
                <p className="account-subtitle mb-0">
                  Search for a stock on the <Link to="/">Home page</Link> and use the
                  Buy panel to place your first order.
                </p>
              </div>
            ) : (
              <>
                <p className="account-subtitle mb-3">
                  Select a time horizon and scenario to see how your holdings could grow.
                  <Badge bg="warning" text="dark" className="ms-2" style={{ fontSize: '0.7rem' }}>
                    Projections are not financial advice
                  </Badge>
                </p>
                {account.holdings.map((h) => (
                  <HoldingProjectionCard
                    key={h.symbol}
                    holding={h}
                    currentPrice={holdingPrices[h.symbol]}
                  />
                ))}
              </>
            )}
          </Card>

          {/* ─── Recent transactions ─── */}
          <Card className="account-section-card border-0 p-3 p-sm-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h2 className="account-section-title mb-0">Recent Activity</h2>
              <button
                type="button"
                className="btn btn-sm btn-outline-light"
                onClick={() => navigate('/transactions')}
              >
                Full history →
              </button>
            </div>

            {recentTxns.length === 0 ? (
              <p className="account-subtitle mb-0">No transactions yet.</p>
            ) : (
              <div className="account-txn-list">
                {recentTxns.map((tx) => (
                  <div key={tx.id} className="account-txn-row d-flex align-items-center gap-3">
                    <Badge
                      bg={tx.type === 'fund' ? 'info' : tx.type === 'buy' ? 'success' : 'warning'}
                      text={tx.type === 'sell' ? 'dark' : undefined}
                      className="account-txn-badge text-uppercase"
                    >
                      {tx.type}
                    </Badge>
                    <div className="flex-grow-1 min-w-0">
                      <div className="account-txn-desc">
                        {tx.type === 'fund' && `Deposited ${currencyFmt.format(tx.amount)}`}
                        {tx.type === 'buy' && `Bought ${tx.shares % 1 === 0 ? tx.shares : tx.shares.toFixed(4)} × ${tx.symbol} @ ${currencyFmt.format(tx.price)}`}
                        {tx.type === 'sell' && `Sold ${tx.shares % 1 === 0 ? tx.shares : tx.shares.toFixed(4)} × ${tx.symbol} @ ${currencyFmt.format(tx.price)}`}
                      </div>
                      <div className="account-subtitle">
                        {new Date(tx.date).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className={`account-txn-amount ${tx.type === 'sell' ? 'text-success' : tx.type === 'buy' ? 'text-danger' : 'text-info'}`}>
                      {tx.type === 'sell' ? '+' : tx.type === 'buy' ? '-' : '+'}{currencyFmt.format(tx.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Card>
      </Container>
    </main>
  )
}

export default AccountPage
