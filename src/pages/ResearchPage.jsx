import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Card, Col, Container, ProgressBar, Row } from 'react-bootstrap'
import { Link, useLocation } from 'react-router'
import {
  getCompanyNews,
  getCompanyProfile,
  getEodHistoricalData,
  getResearchSnapshot,
} from '../data/finnhubClient.js'
import { getFavoriteSymbols, setFavoriteSymbols } from '../data/portfolioStorage.js'

const SNAPSHOT_STORAGE_KEY = 'mjmstocks.researchSnapshot.v1'
const REFRESH_COOLDOWN_MS = 60 * 60 * 1000
const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const compactNumFmt = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

const LEADERBOARDS = [
  { key: 'price', title: 'Highest Price', field: 'currentPrice', higherIsBetter: true, format: (n) => currencyFmt.format(n) },
  { key: 'pct', title: 'Largest % Gain', field: 'changePercent', higherIsBetter: true, format: (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` },
  { key: 'dollar', title: 'Largest $ Gain', field: 'change', higherIsBetter: true, format: (n) => `${n >= 0 ? '+' : ''}${currencyFmt.format(n)}` },
  { key: 'hot', title: 'Hot Stocks', field: 'hotScore', higherIsBetter: true, format: (n) => n.toFixed(2) },
  { key: 'cool', title: 'Cool Stocks', field: 'coolScore', higherIsBetter: true, format: (n) => n.toFixed(2) },
  { key: 'steady', title: 'Steadiest Stocks', field: 'steadyScore', higherIsBetter: true, format: (n) => n.toFixed(2) },
  { key: 'popular', title: 'Trending / Popular', field: 'popularScore', higherIsBetter: true, format: (n) => n.toFixed(2) },
  { key: 'range', title: 'Largest Intraday Range', field: 'intradayRangePct', higherIsBetter: true, format: (n) => `${n.toFixed(2)}%` },
]

function parseSnapshotStorage() {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.rows) || typeof parsed.updatedAt !== 'number') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function pctChange(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return undefined
  return ((b - a) / a) * 100
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) return undefined
  return values.reduce((sum, n) => sum + n, 0) / values.length
}

function buildMetrics(rows) {
  const absMovePcts = rows
    .map((row) => {
      const pct = row?.quote?.changePercent
      return Number.isFinite(pct) ? Math.abs(pct) : 0
    })

  const moveMin = absMovePcts.length ? Math.min(...absMovePcts) : 0
  const moveMax = absMovePcts.length ? Math.max(...absMovePcts) : 0
  const moveSpan = Math.max(1, moveMax - moveMin)

  return rows.map((row) => {
    const q = row.quote
    const currentPrice = q.currentPrice
    const changePercent = Number.isFinite(q.changePercent) ? q.changePercent : 0
    const change = Number.isFinite(q.change) ? q.change : 0
    const open = Number.isFinite(q.open) ? q.open : currentPrice
    const high = Number.isFinite(q.high) ? q.high : currentPrice
    const low = Number.isFinite(q.low) ? q.low : currentPrice

    const intradayRangePct =
      Number.isFinite(open) && open > 0
        ? ((high - low) / open) * 100
        : 0

    const absMovePct = Math.abs(changePercent)
    const movePct = (absMovePct - moveMin) / moveSpan
    const volatilityProxy = absMovePct * 0.65 + intradayRangePct * 0.35
    const hotScore = changePercent * 0.7 + intradayRangePct * 0.3
    const coolScore = (-changePercent) * 0.7 + intradayRangePct * 0.3
    const steadyScore = 100 / (1 + volatilityProxy)
    const popularScore = absMovePct * 0.6 + intradayRangePct * 0.3 + movePct * 10 * 0.1

    return {
      ...row,
      currentPrice,
      change,
      changePercent,
      intradayRangePct,
      hotScore,
      coolScore,
      steadyScore,
      popularScore,
    }
  })
}

function ResearchPage() {
  const location = useLocation()
  const refreshIdRef = useRef(0)
  const detailCacheRef = useRef(new Map())
  const [rows, setRows] = useState(() => {
    const cached = parseSnapshotStorage()
    return cached?.rows ?? []
  })
  const [updatedAt, setUpdatedAt] = useState(() => parseSnapshotStorage()?.updatedAt ?? 0)
  const [universeSize, setUniverseSize] = useState(() => parseSnapshotStorage()?.universeSize ?? 0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [progress, setProgress] = useState({ completed: 0, total: 0, symbol: '' })
  const [refreshError, setRefreshError] = useState(null)
  const [showBottom, setShowBottom] = useState(false)
  const [nowMs, setNowMs] = useState(Date.now())
  const [favorites, setFavorites] = useState(() => getFavoriteSymbols())

  const querySymbol = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('symbol')?.toUpperCase() ?? ''
  }, [location.search])

  const metricRows = useMemo(() => buildMetrics(rows), [rows])
  const rowMap = useMemo(
    () => Object.fromEntries(metricRows.map((row) => [row.symbol, row])),
    [metricRows],
  )

  const [selectedSymbol, setSelectedSymbol] = useState('')

  useEffect(() => {
    if (querySymbol && rowMap[querySymbol]) {
      setSelectedSymbol(querySymbol)
      return
    }
    if (!selectedSymbol && metricRows.length > 0) {
      setSelectedSymbol(metricRows[0].symbol)
    }
  }, [querySymbol, rowMap, metricRows, selectedSymbol])

  useEffect(() => {
    setFavoriteSymbols(favorites)
  }, [favorites])

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const cooldownRemainingMs = Math.max(0, REFRESH_COOLDOWN_MS - (nowMs - updatedAt))
  const canRefresh = cooldownRemainingMs === 0

  const refreshSnapshot = async () => {
    if (!canRefresh || isRefreshing) return

    const refreshId = ++refreshIdRef.current
    setIsRefreshing(true)
    setRefreshError(null)
    setProgress({ completed: 0, total: 0, symbol: '' })

    try {
      const snapshot = await getResearchSnapshot({
        limit: 500,
        batchSize: 5,
        delayMs: 1100,
        quoteCacheTtlMs: 60 * 60 * 1000,
        onBatch: ({ snapshot: partialSnapshot, completed, total, symbol }) => {
          if (refreshId !== refreshIdRef.current) return

          setRows(partialSnapshot.rows)
          setUpdatedAt(partialSnapshot.updatedAt)
          setUniverseSize(partialSnapshot.universeSize)
          setProgress({ completed, total, symbol })
          window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(partialSnapshot))
        },
        onProgress: ({ completed, total, symbol }) => {
          if (refreshId !== refreshIdRef.current) return
          setProgress({ completed, total, symbol })
        },
      })

      if (refreshId !== refreshIdRef.current) return

      setRows(snapshot.rows)
      setUpdatedAt(snapshot.updatedAt)
      setUniverseSize(snapshot.universeSize)
      window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot))
    } catch (error) {
      if (refreshId !== refreshIdRef.current) return
      setRefreshError(error?.message || 'Failed to refresh research snapshot.')
    } finally {
      if (refreshId === refreshIdRef.current) {
        setIsRefreshing(false)
      }
    }
  }

  const selectedRow = selectedSymbol ? rowMap[selectedSymbol] : null

  const [detailLoading, setDetailLoading] = useState(false)
  const [profile, setProfile] = useState(null)
  const [news, setNews] = useState([])
  const [researchStats, setResearchStats] = useState(null)

  useEffect(() => {
    if (!selectedSymbol) return

    const cachedDetail = detailCacheRef.current.get(selectedSymbol)
    if (cachedDetail) {
      setProfile(cachedDetail.profile)
      setNews(cachedDetail.news)
      setResearchStats(cachedDetail.researchStats)
    }

    let cancelled = false

    const loadDetails = async () => {
      setDetailLoading(true)

      try {
        const [profileResult, newsResult, oneWeek, oneMonth, threeMonth] = await Promise.all([
          getCompanyProfile(selectedSymbol).catch(() => null),
          getCompanyNews(selectedSymbol, { daysBack: 21, limit: 6 }).catch(() => []),
          getEodHistoricalData(selectedSymbol, '1W').catch(() => null),
          getEodHistoricalData(selectedSymbol, '1M').catch(() => null),
          getEodHistoricalData(selectedSymbol, '3M').catch(() => null),
        ])

        if (cancelled) return

        setProfile(profileResult)
        setNews(newsResult)

        const weekPoints = oneWeek?.data?.points
        const monthPoints = oneMonth?.data?.points
        const quarterPoints = threeMonth?.data?.points

        const weekReturn = Array.isArray(weekPoints) && weekPoints.length > 1
          ? pctChange(weekPoints[0], weekPoints[weekPoints.length - 1])
          : undefined
        const monthReturn = Array.isArray(monthPoints) && monthPoints.length > 1
          ? pctChange(monthPoints[0], monthPoints[monthPoints.length - 1])
          : undefined
        const quarterReturn = Array.isArray(quarterPoints) && quarterPoints.length > 1
          ? pctChange(quarterPoints[0], quarterPoints[quarterPoints.length - 1])
          : undefined

        const rollingSeries = quarterPoints && quarterPoints.length > 3
          ? quarterPoints.slice(1).map((point, index) => pctChange(quarterPoints[index], point)).filter(Number.isFinite)
          : []

        const realizedVol = average(rollingSeries.map((n) => Math.abs(n)))

        const researchStatsResult = { weekReturn, monthReturn, quarterReturn, realizedVol }
        const detailPayload = {
          profile: profileResult,
          news: newsResult,
          researchStats: researchStatsResult,
        }

        detailCacheRef.current.set(selectedSymbol, detailPayload)

        setResearchStats(researchStatsResult)
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }

    loadDetails()

    return () => {
      cancelled = true
    }
  }, [selectedSymbol])

  function toggleFavorite(symbol) {
    setFavorites((prev) => {
      if (prev.includes(symbol)) {
        return prev.filter((item) => item !== symbol)
      }
      return [...prev, symbol]
    })
  }

  const leaderboards = useMemo(() => {
    return LEADERBOARDS.map((board) => {
      const sorted = [...metricRows]
      const defaultDesc = board.higherIsBetter
      const desc = showBottom ? !defaultDesc : defaultDesc

      sorted.sort((a, b) => {
        const av = a[board.field]
        const bv = b[board.field]

        const aNum = Number.isFinite(av) ? av : Number.NEGATIVE_INFINITY
        const bNum = Number.isFinite(bv) ? bv : Number.NEGATIVE_INFINITY

        return desc ? bNum - aNum : aNum - bNum
      })

      return {
        ...board,
        rows: sorted.slice(0, 25),
      }
    })
  }, [metricRows, showBottom])

  const refreshedLabel = updatedAt
    ? new Date(updatedAt).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null

  const cooldownLabel = `${Math.floor(cooldownRemainingMs / 60_000)}:${String(Math.floor((cooldownRemainingMs % 60_000) / 1000)).padStart(2, '0')}`

  return (
    <main className="page-shell py-4 py-md-5">
      <Container className="px-3 px-md-4">
        <Card className="glass-panel mx-auto border-0 p-3 p-sm-4 p-lg-5">
          <p className="eyebrow mb-2">Research</p>
          <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-3">
            <div>
              <h1 className="account-page-title mb-1">Market Research Dashboard</h1>
              <p className="account-subtitle mb-0">
                Top 25 leaderboards from real API data across a 500-symbol US universe snapshot.
              </p>
            </div>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <button
                type="button"
                className={`btn btn-sm ${showBottom ? 'btn-warning' : 'btn-outline-warning'}`}
                onClick={() => setShowBottom((prev) => !prev)}
                aria-pressed={showBottom}
                aria-label={showBottom ? 'Switch to top 25 leaderboard results' : 'Switch to bottom 25 leaderboard results'}
              >
                {showBottom ? 'Showing Bottom 25' : 'Showing Top 25'}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-light"
                disabled={!canRefresh || isRefreshing}
                onClick={refreshSnapshot}
                aria-label="Refresh market research snapshot"
              >
                {isRefreshing ? 'Refreshing…' : 'Refresh Snapshot'}
              </button>
            </div>
          </div>

          <div className="research-meta mb-4" aria-live="polite">
            {refreshedLabel && <span>Last snapshot: {refreshedLabel}</span>}
            <span className="mx-2">•</span>
            <span>Universe: {universeSize || 0} symbols</span>
            <span className="mx-2">•</span>
            <span>
              Cooldown: {canRefresh ? 'ready' : cooldownLabel}
            </span>
            {isRefreshing && progress.total > 0 && (
              <Badge bg="info" className="ms-2">
                {progress.completed}/{progress.total} ({progress.symbol})
              </Badge>
            )}
          </div>

          {isRefreshing && progress.total > 0 && (
            <div className="mb-4">
              <ProgressBar
                now={(progress.completed / progress.total) * 100}
                label={`${progress.completed}/${progress.total}`}
                className="research-progress-bar"
                animated
                striped
                aria-label="Research snapshot loading progress"
              />
              <div className="research-progress-label mt-2">
                Loading research snapshot{progress.symbol ? ` • latest: ${progress.symbol}` : ''}
              </div>
            </div>
          )}

          {rows.length === 0 && !isRefreshing && (
            <p className="stock-subtitle mb-3">
              No research snapshot loaded yet. Use <strong>Refresh Snapshot</strong> to populate the leaderboard.
            </p>
          )}

          {refreshError && (
            <p className="text-danger mb-3" role="alert">{refreshError}</p>
          )}

          <Row className="g-3 mb-4">
            {leaderboards.map((board) => (
              <Col key={board.key} xs={12} md={6} xl={4}>
                <Card className="research-board-card border-0 p-3 h-100">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <h2 className="research-board-title mb-0">{board.title}</h2>
                    <span className="stock-subtitle">{showBottom ? 'Bottom' : 'Top'} 25</span>
                  </div>
                  <div className="research-board-list" aria-label={`${board.title} leaderboard`}>
                    {board.rows.map((row, index) => {
                      const isActive = selectedSymbol === row.symbol
                      const isFav = favorites.includes(row.symbol)

                      return (
                        <div
                          key={`${board.key}:${row.symbol}`}
                          className={`research-row ${isActive ? 'is-active' : ''}`}
                        >
                          <span className="research-rank">{index + 1}</span>
                          <button
                            type="button"
                            className="research-row-select"
                            onClick={() => setSelectedSymbol(row.symbol)}
                            aria-pressed={isActive}
                            aria-label={`Select ${row.symbol} ${row.name}. ${board.title}: ${board.format(row[board.field])}`}
                          >
                            <span className="research-symbol-wrap">
                              <span className="research-symbol">{row.symbol}</span>
                              <span className="research-name">{row.name}</span>
                            </span>
                            <span className="research-value">{board.format(row[board.field])}</span>
                          </button>
                          <button
                            type="button"
                            className="research-fav-btn"
                            title={isFav ? 'Remove favorite' : 'Add favorite'}
                            aria-label={isFav ? `Remove ${row.symbol} from favorites` : `Add ${row.symbol} to favorites`}
                            aria-pressed={isFav}
                            onClick={() => toggleFavorite(row.symbol)}
                          >
                            <span className="research-fav" aria-hidden="true">{isFav ? '★' : '☆'}</span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          <Card className="research-detail-card border-0 p-3 p-sm-4" aria-busy={detailLoading}>
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
              <h2 className="account-section-title mb-0">Stock Research Detail</h2>
              {selectedRow && (
                <div className="d-flex align-items-center gap-2">
                  <Link
                    className="btn btn-sm btn-outline-light"
                    to={`/?symbol=${encodeURIComponent(selectedRow.symbol)}`}
                    aria-label={`Open ${selectedRow.symbol} chart on home page`}
                  >
                    Open Chart
                  </Link>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-warning"
                    onClick={() => toggleFavorite(selectedRow.symbol)}
                    aria-pressed={favorites.includes(selectedRow.symbol)}
                    aria-label={favorites.includes(selectedRow.symbol) ? `Remove ${selectedRow.symbol} from favorites` : `Add ${selectedRow.symbol} to favorites`}
                  >
                    {favorites.includes(selectedRow.symbol) ? 'Unfavorite' : 'Favorite'} {selectedRow.symbol}
                  </button>
                </div>
              )}
            </div>

            {!selectedRow ? (
              <p className="account-subtitle mb-0">Select a stock from a leaderboard.</p>
            ) : (
              <>
                <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
                  <h3 className="account-holding-symbol mb-0">{selectedRow.symbol}</h3>
                  <span className="account-subtitle">{selectedRow.name}</span>
                  <Badge bg={selectedRow.quote.stale ? 'warning' : 'success'} text={selectedRow.quote.stale ? 'dark' : undefined}>
                    {selectedRow.quote.stale ? 'Cached' : 'Fresh'} quote
                  </Badge>
                </div>

                <Row className="g-3 mb-3">
                  <Col xs={6} md={3}><div className="research-kpi"><span>Price</span><strong>{currencyFmt.format(selectedRow.currentPrice)}</strong></div></Col>
                  <Col xs={6} md={3}><div className="research-kpi"><span>Change</span><strong>{selectedRow.change >= 0 ? '+' : ''}{currencyFmt.format(selectedRow.change)}</strong></div></Col>
                  <Col xs={6} md={3}><div className="research-kpi"><span>Change %</span><strong>{selectedRow.changePercent >= 0 ? '+' : ''}{selectedRow.changePercent.toFixed(2)}%</strong></div></Col>
                  <Col xs={6} md={3}><div className="research-kpi"><span>Day Range %</span><strong>{Number.isFinite(selectedRow.intradayRangePct) ? `${selectedRow.intradayRangePct.toFixed(2)}%` : 'N/A'}</strong></div></Col>
                </Row>

                {detailLoading ? (
                  <p className="account-subtitle mb-0">Loading details…</p>
                ) : (
                  <>
                    {(profile || researchStats) && (
                      <Row className="g-3 mb-3">
                        <Col xs={12} lg={6}>
                          <Card className="research-subcard border-0 p-3 h-100">
                            <h4 className="research-subtitle mb-2">Company</h4>
                            <p className="research-company-name mb-1">{profile?.name ?? selectedRow.name}</p>
                            <p className="stock-subtitle mb-1">Industry: {profile?.finnhubIndustry || 'N/A'}</p>
                            <p className="stock-subtitle mb-1">Exchange: {profile?.exchange || 'N/A'}</p>
                            <p className="stock-subtitle mb-1">IPO: {profile?.ipo || 'N/A'}</p>
                            {profile?.marketCapitalization && (
                              <p className="stock-subtitle mb-0">Market Cap: {compactNumFmt.format(profile.marketCapitalization)}M</p>
                            )}
                          </Card>
                        </Col>
                        <Col xs={12} lg={6}>
                          <Card className="research-subcard border-0 p-3 h-100">
                            <h4 className="research-subtitle mb-2">Performance Snapshot</h4>
                            <p className="stock-subtitle mb-1">1W: {Number.isFinite(researchStats?.weekReturn) ? `${researchStats.weekReturn >= 0 ? '+' : ''}${researchStats.weekReturn.toFixed(2)}%` : 'N/A'}</p>
                            <p className="stock-subtitle mb-1">1M: {Number.isFinite(researchStats?.monthReturn) ? `${researchStats.monthReturn >= 0 ? '+' : ''}${researchStats.monthReturn.toFixed(2)}%` : 'N/A'}</p>
                            <p className="stock-subtitle mb-1">3M: {Number.isFinite(researchStats?.quarterReturn) ? `${researchStats.quarterReturn >= 0 ? '+' : ''}${researchStats.quarterReturn.toFixed(2)}%` : 'N/A'}</p>
                            <p className="stock-subtitle mb-0">Avg abs weekly move: {Number.isFinite(researchStats?.realizedVol) ? `${researchStats.realizedVol.toFixed(2)}%` : 'N/A'}</p>
                          </Card>
                        </Col>
                      </Row>
                    )}

                    <Card className="research-subcard border-0 p-3">
                      <h4 className="research-subtitle mb-2">Recent News</h4>
                      {news.length === 0 ? (
                        <p className="stock-subtitle mb-0">No recent news available from source.</p>
                      ) : (
                        <ul className="research-news mb-0">
                          {news.map((item) => (
                            <li key={item.id || item.url}>
                              {item.url ? (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label={`${item.headline || 'Untitled headline'} (opens in a new tab)`}
                                >
                                  {item.headline || 'Untitled headline'}
                                </a>
                              ) : (
                                <span>{item.headline || 'Untitled headline'}</span>
                              )}
                              <div className="stock-subtitle">
                                {item.source || 'Unknown source'}
                                {item.datetime ? ` • ${new Date(item.datetime).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  </>
                )}
              </>
            )}
          </Card>
        </Card>
      </Container>
    </main>
  )
}

export default ResearchPage
