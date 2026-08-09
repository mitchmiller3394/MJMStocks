import { Badge, Card } from 'react-bootstrap'

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function RecentActivitySection({ transactions, onViewTransactions }) {
  return (
    <Card className="account-section-card border-0 p-3 p-sm-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="account-section-title mb-0">Recent Activity</h2>
        <button
          type="button"
          className="btn btn-sm btn-outline-light"
          onClick={onViewTransactions}
        >
          Full history →
        </button>
      </div>

      {transactions.length === 0 ? (
        <p className="account-subtitle mb-0">No transactions yet.</p>
      ) : (
        <div className="account-txn-list">
          {transactions.map((tx) => (
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
                {tx.type === 'sell' ? '+' : tx.type === 'buy' ? '-' : '+'}
                {currencyFmt.format(tx.amount)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default RecentActivitySection
