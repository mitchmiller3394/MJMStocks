const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'
const FINNHUB_TOKEN = import.meta.env.VITE_FINNHUB_API_KEY?.trim() ?? 'd8h2skhr01qhjpmqc330d8h2skhr01qhjpmqc33g'

const CACHE_STORAGE_KEY = 'mjmstocks.finnhubCache.v1'
const REQUEST_SPACING_MS = 350
const MAX_RETRIES = 2
const RETRY_BASE_MS = 1200

const memoryCache = new Map()

let cacheLoaded = false
let queue = Promise.resolve()
let pendingRequests = 0
let lastRequestAt = 0
let cooldownUntil = 0

function now() {
  return Date.now()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function loadPersistentCache() {
  if (cacheLoaded) {
    return
  }

  cacheLoaded = true

  try {
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY)
    if (!raw) {
      return
    }

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return
    }

    Object.entries(parsed).forEach(([key, value]) => {
      if (
        value &&
        typeof value === 'object' &&
        typeof value.expiresAt === 'number' &&
        typeof value.updatedAt === 'number'
      ) {
        memoryCache.set(key, value)
      }
    })
  } catch {
    // ignore invalid cache payloads
  }
}

function persistCache() {
  try {
    const payload = Object.fromEntries(memoryCache.entries())
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore storage errors (quota/private mode)
  }
}

function getCacheEntry(key, { allowStale = false } = {}) {
  loadPersistentCache()

  const entry = memoryCache.get(key)
  if (!entry) {
    return null
  }

  if (!allowStale && now() > entry.expiresAt) {
    return null
  }

  return entry
}

function setCacheEntry(key, data, ttlMs) {
  loadPersistentCache()

  const entry = {
    data,
    updatedAt: now(),
    expiresAt: now() + ttlMs,
  }

  memoryCache.set(key, entry)
  persistCache()

  return entry
}

function withQueue(task) {
  pendingRequests += 1

  const run = async () => {
    try {
      const waitMs = Math.max(0, lastRequestAt + REQUEST_SPACING_MS - now())
      if (waitMs > 0) {
        await sleep(waitMs)
      }

      if (cooldownUntil > now()) {
        await sleep(cooldownUntil - now())
      }

      lastRequestAt = now()
      return await task()
    } finally {
      pendingRequests = Math.max(0, pendingRequests - 1)
    }
  }

  const next = queue.then(run, run)
  queue = next.catch(() => {})
  return next
}

async function fetchJson(path, params) {
  if (!FINNHUB_TOKEN) {
    throw new Error('missing-finnhub-token')
  }

  const url = new URL(`${FINNHUB_BASE_URL}${path}`)

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })

  url.searchParams.set('token', FINNHUB_TOKEN)

  let attempt = 0

  while (attempt <= MAX_RETRIES) {
    const response = await fetch(url)

    if (response.status === 429) {
      const retryAfterHeader = Number.parseInt(
        response.headers.get('Retry-After') ?? '',
        10,
      )
      const retryDelay = Number.isFinite(retryAfterHeader)
        ? retryAfterHeader * 1000
        : RETRY_BASE_MS * 2 ** attempt + Math.round(Math.random() * 300)

      cooldownUntil = now() + retryDelay

      if (attempt >= MAX_RETRIES) {
        throw new Error('rate-limited')
      }

      attempt += 1
      await sleep(retryDelay)
      continue
    }

    if (!response.ok) {
      throw new Error(`http-${response.status}`)
    }

    return response.json()
  }

  throw new Error('request-failed')
}

async function fetchWithCache(path, params, { cacheKey, ttlMs }) {
  const fresh = getCacheEntry(cacheKey)
  if (fresh) {
    return {
      data: fresh.data,
      fromCache: true,
      stale: false,
      updatedAt: fresh.updatedAt,
    }
  }

  try {
    const data = await withQueue(() => fetchJson(path, params))
    const stored = setCacheEntry(cacheKey, data, ttlMs)

    return {
      data,
      fromCache: false,
      stale: false,
      updatedAt: stored.updatedAt,
    }
  } catch (error) {
    const staleEntry = getCacheEntry(cacheKey, { allowStale: true })
    if (staleEntry) {
      return {
        data: staleEntry.data,
        fromCache: true,
        stale: true,
        updatedAt: staleEntry.updatedAt,
        error,
      }
    }

    throw error
  }
}

function normalizeSymbolResult(result) {
  const symbol = result.displaySymbol || result.symbol
  return {
    symbol,
    name: result.description || symbol,
    type: result.type,
  }
}

export function hasFinnhubToken() {
  return Boolean(FINNHUB_TOKEN)
}

export function getFinnhubWsUrl() {
  if (!FINNHUB_TOKEN) {
    return null
  }

  return `wss://ws.finnhub.io?token=${encodeURIComponent(FINNHUB_TOKEN)}`
}

export function isRateLimitCoolingDown() {
  return cooldownUntil > now() || pendingRequests >= 8
}

export async function searchUsSymbols(query) {
  const normalized = query.trim()
  if (!normalized) {
    return []
  }

  const cacheKey = `search:US:${normalized.toLowerCase()}`
  const response = await fetchWithCache('/search', { q: normalized, exchange: 'US' }, {
    cacheKey,
    ttlMs: 24 * 60 * 60 * 1000,
  })

  const results = Array.isArray(response.data?.result)
    ? response.data.result
    : []

  return results
    .map(normalizeSymbolResult)
    .filter((item) => /^[A-Z.]{1,10}$/.test(item.symbol))
}

export async function getQuote(symbol) {
  const normalized = symbol.toUpperCase()
  const cacheKey = `quote:${normalized}`

  const response = await fetchWithCache('/quote', { symbol: normalized }, {
    cacheKey,
    ttlMs: 30 * 1000,
  })

  const quote = response.data || {}

  return {
    symbol: normalized,
    currentPrice:
      typeof quote.c === 'number' && Number.isFinite(quote.c) ? quote.c : undefined,
    change:
      typeof quote.d === 'number' && Number.isFinite(quote.d) ? quote.d : undefined,
    changePercent:
      typeof quote.dp === 'number' && Number.isFinite(quote.dp)
        ? quote.dp
        : undefined,
    open:
      typeof quote.o === 'number' && Number.isFinite(quote.o) ? quote.o : undefined,
    high:
      typeof quote.h === 'number' && Number.isFinite(quote.h) ? quote.h : undefined,
    low:
      typeof quote.l === 'number' && Number.isFinite(quote.l) ? quote.l : undefined,
    previousClose:
      typeof quote.pc === 'number' && Number.isFinite(quote.pc) ? quote.pc : undefined,
    marketTimestamp:
      typeof quote.t === 'number' && Number.isFinite(quote.t)
        ? quote.t * 1000
        : undefined,
    updatedAt: response.updatedAt,
    stale: response.stale,
  }
}

export function buildPseudoIntradaySeries({ labels, fallbackPoints, quote }) {
  const safeLabels = Array.isArray(labels) && labels.length > 1
    ? labels
    : ['9:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '1:00', '1:30', '2:00', '2:30', '3:00']

  const basePoints = Array.isArray(fallbackPoints) && fallbackPoints.length > 1
    ? fallbackPoints
    : [100, 100.4, 100.9, 100.6, 101.2, 101.7, 101.4, 101.9, 102.2, 101.8, 102.5, 102.9]

  const current = quote?.currentPrice
  const previousClose = quote?.previousClose
  const open = quote?.open

  if (
    typeof current !== 'number' ||
    !Number.isFinite(current) ||
    (typeof previousClose !== 'number' && typeof open !== 'number')
  ) {
    return {
      labels: safeLabels,
      points: basePoints,
      source: 'mock',
    }
  }

  const start =
    typeof previousClose === 'number' && Number.isFinite(previousClose)
      ? previousClose
      : open
  const end = current

  const min = Math.min(...basePoints)
  const max = Math.max(...basePoints)
  const span = Math.max(0.0001, max - min)

  const amplitude = Math.max(Math.abs(end - start) * 0.25, start * 0.002)
  const generated = basePoints.map((point, index) => {
    const progress = index / (basePoints.length - 1)
    const baseline = start + (end - start) * progress
    const normalized = (point - min) / span
    const wiggle = (normalized - 0.5) * 2

    return Number((baseline + wiggle * amplitude).toFixed(2))
  })

  generated[0] = Number(start.toFixed(2))
  generated[generated.length - 1] = Number(end.toFixed(2))

  return {
    labels: safeLabels,
    points: generated,
    source: 'quote-derived',
  }
}