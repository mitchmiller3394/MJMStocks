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


