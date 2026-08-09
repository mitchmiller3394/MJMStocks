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
export function estimateAnnualRate(points, options = {}) {
  if (!Array.isArray(points) || points.length < 2) return 0.07 // default 7%

  const first = points[0]
  const last = points[points.length - 1]
  if (
    !Number.isFinite(first)
    || !Number.isFinite(last)
    || first <= 0
    || last <= 0
  ) return 0.07

  const {
    periodDays,
    timestamps,
    baselineRate = 0.08,
    stabilizationDays = 252,
    stabilize = false,
  } = options

  const periods = Math.max(1, points.length - 1)
  const periodReturn = (last - first) / first

  let annualized
  if (Number.isFinite(periodDays) && periodDays > 0) {
    annualized = Math.pow(1 + periodReturn, 365 / periodDays) - 1
  } else if (Array.isArray(timestamps) && timestamps.length >= 2) {
    const start = new Date(timestamps[0]).getTime()
    const end = new Date(timestamps[timestamps.length - 1]).getTime()
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      const days = Math.max(1, (end - start) / 86_400_000)
      annualized = Math.pow(1 + periodReturn, 365 / days) - 1
    } else {
      annualized = Math.pow(1 + periodReturn, 252 / periods) - 1
    }
  } else {
    // Backward-compatible behavior: assume one trading day per period.
    annualized = Math.pow(1 + periodReturn, 252 / periods) - 1
  }

  if (stabilize && Number.isFinite(stabilizationDays) && stabilizationDays > 0) {
    const effectiveDays =
      Number.isFinite(periodDays) && periodDays > 0
        ? periodDays
        : periods * (365 / 252)

    const sampleWeight = Math.min(1, Math.max(0, effectiveDays / stabilizationDays))
    annualized = baselineRate + (annualized - baselineRate) * sampleWeight
  }

  // Cap between -95% and +500% to prevent nonsense projections
  return Math.min(5, Math.max(-0.95, annualized))
}

/** * Estimate annualized rate from a chart's price series, considering volatility and trend direction.
 * Uses multiple segments to capture mid-term momentum while stabilizing against noise.
 * @param {number[]} points - array of price data points
 * @param {object} options - { timeframeLabel, baselineRate, stabilizationFactor, volatilityDamping }
 * @returns {number} - annualized rate (decimal)
 */
export function estimateChartAnnualRate(points, options = {}) {
  if (!Array.isArray(points) || points.length < 2) return 0.07

  const validPoints = points.filter((p) => Number.isFinite(p) && p > 0)
  if (validPoints.length < 2) return 0.07

  const {
    timeframeLabel = '1M',
    baselineRate = 0.08,
    stabilizationFactor = 0.5, // how much to blend with baseline [0-1]
    volatilityDamping = 0.3, // how much to dampen strong swings [0-1]
  } = options

  const first = validPoints[0]
  const last = validPoints[validPoints.length - 1]
  const fullPeriodReturn = (last - first) / first

  // Map timeframe label to approximate trading days
  const timeframeDays = {
    '1D': 1,
    '1W': 5,
    '1M': 21,
    '3M': 63,
    '6M': 126,
    '1Y': 252,
    '5Y': 1260,
  }[timeframeLabel] || 21

  // Compute segment returns to detect mid-term momentum
  const segmentCount = Math.min(3, Math.floor(validPoints.length / 5))
  const segmentSize = Math.floor(validPoints.length / Math.max(1, segmentCount))
  let cumulativeSegmentReturn = 0

  if (segmentSize > 0) {
    for (let i = 0; i < segmentCount; i++) {
      const startIdx = i * segmentSize
      const endIdx = Math.min(startIdx + segmentSize, validPoints.length - 1)
      if (endIdx > startIdx) {
        const segStart = validPoints[startIdx]
        const segEnd = validPoints[endIdx]
        const segReturn = (segEnd - segStart) / segStart
        cumulativeSegmentReturn += segReturn
      }
    }
    cumulativeSegmentReturn /= Math.max(1, segmentCount)
  } else {
    cumulativeSegmentReturn = fullPeriodReturn
  }

  // Blend full-period trend with segment trend to get more realistic mid-term direction
  const blendedReturn = 0.6 * fullPeriodReturn + 0.4 * cumulativeSegmentReturn

  // Dampen extreme swings to prevent overconfident projections
  const dampedReturn = blendedReturn * (1 - volatilityDamping * Math.abs(blendedReturn))

  // Annualize: assume the observed return period is timeframeDays trading days
  const periods = Math.max(1, validPoints.length - 1)
  const annualized = Math.pow(1 + dampedReturn, 365 / timeframeDays) - 1

  // Stabilize: blend observed annualized rate with baseline to avoid overreacting
  const sampleWeight = Math.min(1, timeframeDays / 252)
  const stabilized =
    baselineRate +
    (annualized - baselineRate) * sampleWeight * stabilizationFactor

  // Cap between -95% and +500% to prevent nonsense projections
  return Math.min(5, Math.max(-0.95, stabilized))
}

/** * Estimate annualized performance for a holding using lot timing and current price.
 * This avoids overreacting when only a few days of ownership are available.
 */
export function estimateHoldingAnnualRate(holding, currentPrice, asOf = new Date()) {
  if (!holding || !Number.isFinite(currentPrice) || currentPrice <= 0) return 0.07

  const sharesHeld = Number.isFinite(holding.shares) ? holding.shares : 0
  const lots = Array.isArray(holding.lots) ? holding.lots : []
  const asOfMs = new Date(asOf).getTime()

  if (!Number.isFinite(asOfMs)) return estimateAnnualRate([holding.avgCost, currentPrice])

  const validLots = lots
    .map((lot) => ({
      shares: Number(lot?.shares),
      price: Number(lot?.price),
      dateMs: new Date(lot?.date).getTime(),
    }))
    .filter((lot) => (
      Number.isFinite(lot.shares)
      && lot.shares > 0
      && Number.isFinite(lot.price)
      && lot.price > 0
      && Number.isFinite(lot.dateMs)
      && lot.dateMs <= asOfMs
    ))

  if (validLots.length === 0 || sharesHeld <= 0) {
    return estimateAnnualRate([holding.avgCost, currentPrice], {
      stabilize: true,
      stabilizationDays: 252,
      baselineRate: 0.08,
    })
  }

  // Approximate currently-held shares by taking newest lots first.
  let remaining = sharesHeld
  const effectiveLots = []
  for (let i = validLots.length - 1; i >= 0 && remaining > 0; i -= 1) {
    const lot = validLots[i]
    const takeShares = Math.min(remaining, lot.shares)
    if (takeShares > 0) {
      effectiveLots.push({ ...lot, shares: takeShares })
      remaining -= takeShares
    }
  }

  if (effectiveLots.length === 0) {
    return estimateAnnualRate([holding.avgCost, currentPrice], {
      stabilize: true,
      stabilizationDays: 252,
      baselineRate: 0.08,
    })
  }

  const totalEffectiveShares = effectiveLots.reduce((sum, lot) => sum + lot.shares, 0)
  const weightedEntryPrice =
    effectiveLots.reduce((sum, lot) => sum + lot.price * lot.shares, 0)
    / totalEffectiveShares
  const weightedEntryMs =
    effectiveLots.reduce((sum, lot) => sum + lot.dateMs * lot.shares, 0)
    / totalEffectiveShares

  const daysHeld = Math.max(1, (asOfMs - weightedEntryMs) / 86_400_000)

  return estimateAnnualRate([weightedEntryPrice, currentPrice], {
    periodDays: daysHeld,
    stabilize: true,
    stabilizationDays: 252,
    baselineRate: 0.08,
  })
}

/**
 * Analyze historical data to extract volatility, cycle patterns, and momentum.
 * @param {number[]} points - historical price data
 * @returns {{ volatility: number, cyclePeriod: number, recentMomentum: number }}
 */
export function analyzeChartMetrics(points) {
  if (!Array.isArray(points) || points.length < 3) {
    return { volatility: 0.02, cyclePeriod: 5, recentMomentum: 0 }
  }

  // Calculate standard deviation (volatility)
  const mean = points.reduce((sum, p) => sum + p, 0) / points.length
  const variance = points.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / points.length
  const volatility = Math.sqrt(variance) / mean // as % of price

  // Detect cycle period by finding repeating peak-to-peak or valley-to-valley distance
  let cyclePeriod = Math.max(3, Math.floor(points.length / 4))
  if (points.length >= 10) {
    const peaks = []
    for (let i = 1; i < points.length - 1; i++) {
      if (points[i] > points[i - 1] && points[i] > points[i + 1]) {
        peaks.push(i)
      }
    }
    if (peaks.length >= 2) {
      const distances = []
      for (let i = 1; i < peaks.length; i++) {
        distances.push(peaks[i] - peaks[i - 1])
      }
      const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length
      cyclePeriod = Math.max(3, Math.round(avgDistance))
    }
  }

  // Detect recent momentum (expansion vs contraction in last 1/3 of data)
  const recentStartIdx = Math.max(0, Math.floor(points.length * 0.67))
  let recentMomentum = 0
  if (recentStartIdx < points.length - 1) {
    const recentSegment = points.slice(recentStartIdx)
    const segmentReturn = (recentSegment[recentSegment.length - 1] - recentSegment[0]) / recentSegment[0]
    // Positive momentum = up trend, negative = down trend
    recentMomentum = segmentReturn
  }

  return {
    volatility: Math.max(0.01, Math.min(0.15, volatility)),
    cyclePeriod,
    recentMomentum,
  }
}

/**
 * Generate projection data points from a starting price, rate, and horizon.
 * @param {number} startPrice
 * @param {number} annualRate  - decimal (e.g. 0.10 for 10%)
 * @param {string} horizon     - '1M' | '3M' | '6M' | '1Y' | '5Y'
 * @param {object} options     - { mode: 'simple'|'complex', metrics: {volatility, cyclePeriod, recentMomentum} }
 * @returns {{ points: number[], labels: string[], endValue: number, gain: number, gainPct: number }}
 */
export function buildProjection(startPrice, annualRate, horizon, options = {}) {
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

  const { mode = 'simple', metrics = {} } = options
  const { volatility = 0.02, cyclePeriod = 5, recentMomentum = 0 } = metrics

  const dailyRate = Math.pow(1 + annualRate, 1 / 252) - 1
  const stepDays = horizonDays / numPoints

  const points = []
  const labels = []

  for (let i = 0; i <= numPoints; i++) {
    const daysFromNow = i * stepDays
    let price = startPrice * Math.pow(1 + dailyRate, (daysFromNow / 1) * (252 / 365))

    if (mode === 'complex' && i > 0) {
      // Add cyclical pattern: sine wave based on cycle period
      const cyclePhase = ((i % cyclePeriod) / cyclePeriod) * Math.PI * 2
      const cycleAmplitude = price * volatility * 0.5 // 50% of volatility magnitude
      const cyclicOffset = Math.sin(cyclePhase) * cycleAmplitude

      // Add expansion/contraction momentum phase shift
      const phaseShiftDays = recentMomentum > 0 ? (cyclePeriod * 0.25) : (cyclePeriod * 0.75)
      const momentumPhase = (((i + phaseShiftDays) % cyclePeriod) / cyclePeriod) * Math.PI * 2
      const momentumOffset = Math.sin(momentumPhase) * cycleAmplitude * 0.4

      // Add random noise based on historical volatility
      const randomNoise = (Math.random() - 0.5) * 2 * price * volatility * 0.3

      price += cyclicOffset + momentumOffset + randomNoise
      price = Math.max(startPrice * 0.5, price) // prevent unrealistic crashes
    } else if (mode === 'simple' && i > 0) {
      // Simple mode: just add realistic volatility noise
      const randomNoise = (Math.random() - 0.5) * 2 * price * volatility * 0.5
      price += randomNoise
      price = Math.max(startPrice * 0.5, price)
    }

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
