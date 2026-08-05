# MJMStocks

Paper-trading web app built with React + Vite.

## What this app does

- Real quote/search integration (Finnhub)
- Historical chart ranges (free-tier compatible provider mapping)
- Favorites and Portfolio management
- Paper-trading account with fake money:
	- starting cash: $1,000
	- manual daily funding up to $2,000/day
	- buy/sell (including fractional shares)
	- holdings, transactions, and account value tracking
	- projection analytics for what-if investing scenarios

## Routes

- `/` — Home (search, charts, buy/sell)
- `/portfolio` — Watchlist + owned positions summary
- `/account` — Funding controls, account stats, holdings analytics
- `/transactions` — Full transaction history

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

