import { Card, Form, ProgressBar } from 'react-bootstrap'

const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function DailyFundingSection({
  fundAmount,
  setFundAmount,
  canFund,
  countdown,
  fundSuccess,
  fundError,
  totalFunded,
  onFund,
}) {
  return (
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
          onClick={onFund}
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

        {fundSuccess && <span className="text-success fw-semibold">✓ Funds added!</span>}
        {fundError && <span className="text-danger">{fundError}</span>}
      </div>

      <div className="mt-3">
        <ProgressBar
          now={Math.min(100, (totalFunded / 10000) * 100)}
          variant="info"
          className="account-fund-progress"
          label={`${currencyFmt.format(totalFunded)} funded`}
        />
        <div className="account-subtitle mt-1">
          Total funded: {currencyFmt.format(totalFunded)} (goal: $10,000)
        </div>
      </div>
    </Card>
  )
}

export default DailyFundingSection
