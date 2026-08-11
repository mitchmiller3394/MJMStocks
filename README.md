# MJMStocks

Paper-trading web app built with React + Vite.

## What this app does

- Real quote/search integration (Finnhub)
- Historical chart ranges (free-tier compatible provider mapping)
- Favorites and Portfolio management with drag-and-drop ordering
- Paper-trading account with fake money:
  - Starting cash: $1,000
  - Manual daily funding up to $2,000/day
  - Buy/sell (including fractional shares)
  - Holdings, lots, transactions, and live account value tracking
  - Live unrealized gain/loss based on current API prices (not avg cost)
  - Projection analytics with time-aware stabilization and what-if scenarios
- Stock chart projections:
  - Simple mode: trend + realistic volatility noise
  - Complex mode: trend + cyclical peaks/valleys + momentum phase detection
- Market Research dashboard:
  - S&P 500 leaderboards: Highest Price, Largest % Gain/Loss, Hot/Cool Stocks, Steadiest, Trending, Largest Intraday Range %
  - Top-5 / Bottom-5 toggle on each board
  - Inline detail panel with quote KPIs, company profile, 1W/1M/3M performance, and recent news
  - Favorites toggle integrated with Portfolio watchlist

## ⚠️ Research Page — Rate Limit Notice

The Research page fetches live quote data for ~502 S&P 500 symbols from the **Finnhub free tier**, which is rate-limited to ~60 requests/minute.

- **Initial full snapshot takes approximately 9–10 minutes** to load all symbols.
- The UI shows a progress bar and live status line during loading; boards populate progressively as data arrives.
- Once loaded, the snapshot is cached in `localStorage` for **10 minutes**. Subsequent visits within that window load instantly.
- A **10-minute cooldown** on the manual refresh button prevents accidental rate-limit exhaustion.
- The S&P 500 symbol list is **hardcoded** (as of August 2026) in `src/data/sp500Symbols.js` and does not update dynamically.
- **Volume data is not available** from the Finnhub free-tier quote API and is not shown in the app. The "Largest Intraday Range %" leaderboard uses `(high − low) / open` instead, which is available.

## Routes

- `/` — Home (search, charts, buy/sell, chart projections)
- `/portfolio` — Watchlist + owned positions with live gain/loss
- `/account` — Funding controls, account stats, holdings analytics + projections
- `/transactions` — Full transaction history
- `/research` — S&P 500 Market Research leaderboards + inline stock detail

## Component Architecture

```
src/
  pages/
    HomePage.jsx
    PortfolioPage.jsx
    AccountPage.jsx
    TransactionsPage.jsx
    ResearchPage.jsx
  components/
    account/
      BalanceSummarySection.jsx
      DailyFundingSection.jsx
      HoldingsProjectionsSection.jsx
      RecentActivitySection.jsx
    portfolio/
      FavoritesSection.jsx
      OwnedPositionsSection.jsx
    AccountBalanceBadge.jsx
    AppLayout.jsx
    BuySellPanel.jsx
    HoldingProjectionCard.jsx
    MarketClock.jsx
    SiteHeader.jsx
    SortableStockCard.jsx
    StockChartCard.jsx
    StockSearchBar.jsx
  data/
    accountStorage.js   — account state, projection math, analytics
    finnhubClient.js    — API client, caching, rate limiting, research helpers
    portfolioStorage.js — favorites, manual order persistence
    sp500Symbols.js     — hardcoded S&P 500 constituent list (~502 symbols, Aug 2026)
    mockStocks.js       — fallback stock data
  styles/
    ResearchPage.css
```

## Local development

Install dependencies:

`npm install`

Run dev server:

`npm run dev`

Build production bundle:

`npm run build`

## Deployment output

Build output is configured to `docs/` for static hosting workflows.

## API key note

This is a frontend-only app. Any runtime key in client code should be treated as public.


## What this app does

- Real quote/search integration (Finnhub)
- Historical chart ranges (free-tier compatible provider mapping)
- Favorites and Portfolio management with drag-and-drop ordering
- Paper-trading account with fake money:
  - Starting cash: $1,000
  - Manual daily funding up to $2,000/day
  - Buy/sell (including fractional shares)
  - Holdings, lots, transactions, and live account value tracking
  - Live unrealized gain/loss based on current API prices (not avg cost)
  - Projection analytics with time-aware stabilization and what-if scenarios
- Stock chart projections:
  - Simple mode: trend + realistic volatility noise
  - Complex mode: trend + cyclical peaks/valleys + momentum phase detection

## Routes

- `/` — Home (search, charts, buy/sell, chart projections)
- `/portfolio` — Watchlist + owned positions with live gain/loss
- `/account` — Funding controls, account stats, holdings analytics + projections
- `/transactions` — Full transaction history

## Component Architecture

```
src/
  pages/
    HomePage.jsx
    PortfolioPage.jsx
    AccountPage.jsx
    TransactionsPage.jsx
  components/
    account/
      BalanceSummarySection.jsx
      DailyFundingSection.jsx
      HoldingsProjectionsSection.jsx
      RecentActivitySection.jsx
    portfolio/
      FavoritesSection.jsx
      OwnedPositionsSection.jsx
    AccountBalanceBadge.jsx
    AppLayout.jsx
    BuySellPanel.jsx
    HoldingProjectionCard.jsx
    MarketClock.jsx
    SiteHeader.jsx
    SortableStockCard.jsx
    StockChartCard.jsx
    StockSearchBar.jsx
  data/
    accountStorage.js   — account state, projection math, analytics
    finnhubClient.js    — API client, caching, rate limiting
    portfolioStorage.js — favorites, manual order persistence
    mockStocks.js       — fallback stock data
```

## Local development

Install dependencies:

`npm install`

Run dev server:

`npm run dev`

Build production bundle:

`npm run build`

## Deployment output

Build output is configured to `docs/` for static hosting workflows.

## API key note

This is a frontend-only app. Any runtime key in client code should be treated as public.


