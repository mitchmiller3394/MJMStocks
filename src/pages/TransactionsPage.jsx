import { useCallback, useEffect, useState } from 'react'
import { Badge, Card, Container, Form } from 'react-bootstrap'
import {
  ACCOUNT_UPDATE_EVENT_NAME,
  getAccount,
} from '../data/accountStorage.js'

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const TX_TYPES = [
  { value: 'all', label: 'All' },
  { value: 'fund', label: 'Funding' },
  { value: 'buy', label: 'Buys' },
  { value: 'sell', label: 'Sells' },
]

function TransactionsPage() {
  const [transactions, setTransactions] = useState(() => getAccount().transactions)
  const [filterType, setFilterType] = useState('all')
  const [filterSymbol, setFilterSymbol] = useState('')

  const refresh = useCallback(() => {
    setTransactions(getAccount().transactions)
  }, [])

  useEffect(() => {
    window.addEventListener(ACCOUNT_UPDATE_EVENT_NAME, refresh)
    return () => window.removeEventListener(ACCOUNT_UPDATE_EVENT_NAME, refresh)
  }, [refresh])

  const filtered = transactions.filter((tx) => {
    if (filterType !== 'all' && tx.type !== filterType) return false
    if (filterSymbol.trim() && tx.symbol !== filterSymbol.toUpperCase().trim()) return false
    return true
  })

  const symbols = [...new Set(transactions.filter((t) => t.symbol).map((t) => t.symbol))].sort()

  return (
    <main className="page-shell py-4 py-md-5">
      <Container className="px-3 px-md-4">
        <Card className="glass-panel mx-auto border-0 p-3 p-sm-4 p-lg-5">
          <p className="eyebrow mb-2">Account</p>
          <h1 className="account-page-title mb-1">Transaction History</h1>
          <p className="account-subtitle mb-4">
            Complete record of all funding deposits, buys, and sells.
          </p>

          {/* Filters */}
          <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
            <div className="d-flex align-items-center gap-2">
              <span className="account-subtitle">Type:</span>
              {TX_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`btn btn-sm ${filterType === t.value ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setFilterType(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {symbols.length > 0 && (
              <Form.Select
                size="sm"
                value={filterSymbol}
                onChange={(e) => setFilterSymbol(e.target.value)}
                className="account-txn-filter-select"
                style={{ maxWidth: 160 }}
              >
                <option value="">All symbols</option>
                {symbols.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Form.Select>
            )}

            <span className="account-subtitle ms-auto">
              {filtered.length} of {transactions.length} transactions
            </span>
          </div>

          {filtered.length === 0 ? (
            <Card className="portfolio-empty-card border-0 p-3 p-sm-4">
              <p className="portfolio-empty-title mb-1">No transactions found</p>
              <p className="portfolio-empty-copy mb-0">
                {transactions.length === 0
                  ? 'Fund your account or place a trade to get started.'
                  : 'Try clearing the filters above.'}
              </p>
            </Card>
          ) : (
            <div className="account-txn-list account-txn-list-full">
              {filtered.map((tx) => {
                const isBuy = tx.type === 'buy'
                const isSell = tx.type === 'sell'
                const isFund = tx.type === 'fund'

                return (
                  <div key={tx.id} className="account-txn-row d-flex align-items-center gap-3">
                    <Badge
                      bg={isFund ? 'info' : isBuy ? 'success' : 'warning'}
                      text={isSell ? 'dark' : undefined}
                      className="account-txn-badge text-uppercase"
                    >
                      {tx.type}
                    </Badge>

                    <div className="flex-grow-1 min-w-0">
                      <div className="account-txn-desc">
                        {isFund && `Deposited ${currencyFmt.format(tx.amount)}`}
                        {isBuy && `Bought ${tx.shares % 1 === 0 ? tx.shares : tx.shares.toFixed(4)} share${tx.shares !== 1 ? 's' : ''} of ${tx.symbol} @ ${currencyFmt.format(tx.price)}`}
                        {isSell && `Sold ${tx.shares % 1 === 0 ? tx.shares : tx.shares.toFixed(4)} share${tx.shares !== 1 ? 's' : ''} of ${tx.symbol} @ ${currencyFmt.format(tx.price)}`}
                      </div>
                      <div className="account-subtitle">
                        {new Date(tx.date).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>

                    <div className="text-end">
                      <div className={`account-txn-amount ${isSell || isFund ? 'text-success' : 'text-danger'}`}>
                        {isSell || isFund ? '+' : '-'}{currencyFmt.format(tx.amount)}
                      </div>
                      {isSell && typeof tx.gainLoss === 'number' && (
                        <div className={`account-subtitle ${tx.gainLoss >= 0 ? 'text-success' : 'text-danger'}`}>
                          {tx.gainLoss >= 0 ? '▲' : '▼'} {currencyFmt.format(Math.abs(tx.gainLoss))} gain/loss
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </Container>
    </main>
  )
}

export default TransactionsPage
