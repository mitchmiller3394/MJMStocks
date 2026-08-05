const ACCOUNT_KEY = 'mjmstocks.account'
const ACCOUNT_UPDATE_EVENT = 'mjmstocks:accountupdate'

const INITIAL_STATE = {
  cashBalance: 1000,
  totalFunded: 1000,
  holdings: [],           // [{ symbol, shares, avgCost, lots: [{shares, price, date}] }]
  transactions: [],       // [{ id, type, symbol?, shares?, price?, amount, gainLoss?, date, note? }]
  lastFundingDate: null,  // 'YYYY-MM-DD'
  initialized: true,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function readAccount() {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY)
    if (!raw) return { ...INITIAL_STATE }
    const parsed = JSON.parse(raw)
    if (!parsed?.initialized) return { ...INITIAL_STATE }
    return {
      ...INITIAL_STATE,
      ...parsed,
      holdings: Array.isArray(parsed.holdings) ? parsed.holdings : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    }
  } catch {
    return { ...INITIAL_STATE }
  }
}

function writeAccount(state) {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(state))
  window.dispatchEvent(new Event(ACCOUNT_UPDATE_EVENT))
}

export function getTodayString() {
  return new Date().toISOString().slice(0, 10)
}

// Returns ms until midnight (next day when funding resets)
export function getMsUntilMidnight() {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return tomorrow - now
}

// ─── Read ────────────────────────────────────────────────────────────────────

export function getAccount() {
  return readAccount()
}

export function getHolding(symbol) {
  const account = readAccount()
  return account.holdings.find((h) => h.symbol === symbol.toUpperCase()) ?? null
}

export function getAllHoldings() {
  return readAccount().holdings
}

export function canFundToday() {
  const account = readAccount()
  return account.lastFundingDate !== getTodayString()
}

export function getCashBalance() {
  return readAccount().cashBalance
}

export function getTotalPortfolioValue(priceMap = {}) {
  const account = readAccount()
  const investedValue = account.holdings.reduce((sum, h) => {
    const price = priceMap[h.symbol]
    return sum + (typeof price === 'number' ? price : h.avgCost) * h.shares
  }, 0)
  return {
    cash: account.cashBalance,
    invested: investedValue,
    total: account.cashBalance + investedValue,
    totalFunded: account.totalFunded,
    gainLoss: account.cashBalance + investedValue - account.totalFunded,
  }
}

// ─── Write ───────────────────────────────────────────────────────────────────

export function fundAccount(amount) {
  const parsedAmount = Number(amount)
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 2000) {
    throw new Error('invalid-amount')
  }
  const account = readAccount()
  if (account.lastFundingDate === getTodayString()) {
    throw new Error('already-funded-today')
  }

  const tx = {
    id: `tx_${Date.now()}`,
    type: 'fund',
    amount: parsedAmount,
    date: new Date().toISOString(),
    note: 'Daily funding deposit',
  }

  const next = {
    ...account,
    cashBalance: account.cashBalance + parsedAmount,
    totalFunded: account.totalFunded + parsedAmount,
    lastFundingDate: getTodayString(),
    transactions: [tx, ...account.transactions],
  }

  writeAccount(next)
  return next
}

export function buyStock(symbol, shares, price) {
  const sym = symbol.toUpperCase()
  const parsedShares = Number(shares)
  const parsedPrice = Number(price)

  if (!Number.isFinite(parsedShares) || parsedShares <= 0) throw new Error('invalid-shares')
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) throw new Error('invalid-price')

  const account = readAccount()
  const cost = parsedShares * parsedPrice

  if (cost > account.cashBalance + 0.001) throw new Error('insufficient-funds')

  const tx = {
    id: `tx_${Date.now()}`,
    type: 'buy',
    symbol: sym,
    shares: parsedShares,
    price: parsedPrice,
    amount: cost,
    date: new Date().toISOString(),
  }

  const existingIdx = account.holdings.findIndex((h) => h.symbol === sym)
  let holdings = [...account.holdings]

  if (existingIdx >= 0) {
    const existing = holdings[existingIdx]
    const totalShares = existing.shares + parsedShares
    const totalCost = existing.avgCost * existing.shares + cost
    holdings[existingIdx] = {
      ...existing,
      shares: totalShares,
      avgCost: totalCost / totalShares,
      lots: [...(existing.lots ?? []), { shares: parsedShares, price: parsedPrice, date: tx.date }],
    }
  } else {
    holdings.push({
      symbol: sym,
      shares: parsedShares,
      avgCost: parsedPrice,
      lots: [{ shares: parsedShares, price: parsedPrice, date: tx.date }],
    })
  }

  const next = {
    ...account,
    cashBalance: account.cashBalance - cost,
    holdings,
    transactions: [tx, ...account.transactions],
  }

  writeAccount(next)
  return next
}

export function sellStock(symbol, shares, price) {
  const sym = symbol.toUpperCase()
  const parsedShares = Number(shares)
  const parsedPrice = Number(price)

  if (!Number.isFinite(parsedShares) || parsedShares <= 0) throw new Error('invalid-shares')
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) throw new Error('invalid-price')

  const account = readAccount()
  const holdingIdx = account.holdings.findIndex((h) => h.symbol === sym)

  if (holdingIdx < 0) throw new Error('not-holding')

  const holding = account.holdings[holdingIdx]
  if (parsedShares > holding.shares + 0.000001) throw new Error('insufficient-shares')

  const proceeds = parsedShares * parsedPrice
  const gainLoss = proceeds - holding.avgCost * parsedShares

  const tx = {
    id: `tx_${Date.now()}`,
    type: 'sell',
    symbol: sym,
    shares: parsedShares,
    price: parsedPrice,
    amount: proceeds,
    gainLoss,
    date: new Date().toISOString(),
  }

  let holdings = [...account.holdings]
  const remaining = holding.shares - parsedShares

  if (remaining < 0.000001) {
    holdings.splice(holdingIdx, 1)
  } else {
    holdings[holdingIdx] = { ...holding, shares: remaining }
  }

  const next = {
    ...account,
    cashBalance: account.cashBalance + proceeds,
    holdings,
    transactions: [tx, ...account.transactions],
  }

  writeAccount(next)
  return next
}

// ─── Projection math ─────────────────────────────────────────────────────────

/**
 * Compute an annualized rate from a price series (using first/last prices).
 * Returns decimal (e.g. 0.12 for 12% annualized).
 */
export function estimateAnnualRate(points) {
  if (!Array.isArray(points) || points.length < 2) return 0.07 // default 7%
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return 0.07
  const periods = points.length - 1
  // Convert period return to annualized assuming ~252 trading days
  const periodReturn = (last - first) / first
  const annualized = Math.pow(1 + periodReturn, 252 / periods) - 1
  // Cap between -95% and +500% to prevent nonsense projections
  return Math.min(5, Math.max(-0.95, annualized))
}

/**
 * Generate projection data points from a starting price, rate, and horizon.
 * @param {number} startPrice
 * @param {number} annualRate  - decimal (e.g. 0.10 for 10%)
 * @param {string} horizon     - '1M' | '3M' | '6M' | '1Y' | '5Y'
 * @returns {{ points: number[], labels: string[], endValue: number, gain: number, gainPct: number }}
 */
export function buildProjection(startPrice, annualRate, horizon) {
  const today = new Date()

  const horizonDays = {
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    '5Y': 1825,
  }[horizon] ?? 365

  // Number of data points to generate (keep chart readable)
  const numPoints = horizon === '5Y' ? 60 : horizon === '1Y' ? 52 : horizon === '6M' ? 26 : horizon === '3M' ? 13 : 4

  const dailyRate = Math.pow(1 + annualRate, 1 / 252) - 1
  const stepDays = horizonDays / numPoints

  const points = []
  const labels = []

  for (let i = 0; i <= numPoints; i++) {
    const daysFromNow = i * stepDays
    const price = startPrice * Math.pow(1 + dailyRate, (daysFromNow / 1) * (252 / 365))
    points.push(Number(price.toFixed(2)))

    const date = new Date(today)
    date.setDate(today.getDate() + daysFromNow)
    labels.push(
      date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: horizon === '1Y' || horizon === '5Y' ? 'numeric' : undefined,
      }),
    )
  }

  const endValue = points[points.length - 1]
  const gain = endValue - startPrice
  const gainPct = (gain / startPrice) * 100

  return { points, labels, endValue, gain, gainPct }
}

// ─── Event subscription ──────────────────────────────────────────────────────

export const ACCOUNT_UPDATE_EVENT_NAME = ACCOUNT_UPDATE_EVENT
