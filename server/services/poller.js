import db, { stmtAll, stmtRun } from '../db.js'
import { getQuotes, getDividendHistory, getExchangeRates } from './stockService.js'

const POLL_INTERVAL = 5 * 60 * 1000
const MAX_SSE_CLIENTS = 20
const sseClients = new Set()
let latestRates = { USD: 1 }

export function addSSEClient(res) {
  if (sseClients.size >= MAX_SSE_CLIENTS) {
    res.status(503).end()
    return
  }
  sseClients.add(res)
  res.on('close', () => sseClients.delete(res))
}

function broadcast(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`
  for (const client of sseClients) {
    client.write(payload)
  }
}

function getUniqueTickers() {
  const rows = stmtAll('SELECT DISTINCT ticker FROM transactions')
  return rows.map((r) => r.ticker)
}

async function poll() {
  const tickers = getUniqueTickers()
  const hasCash = stmtAll('SELECT 1 FROM cash_positions LIMIT 1').length > 0
  if (!tickers.length && !hasCash) return

  const quotes = tickers.length ? await getQuotes(tickers) : []
  if (tickers.length) {
    console.log(`Polling quotes for: ${tickers.join(', ')}`)
  }
  for (const q of quotes) {
    stmtRun(
      `INSERT INTO quotes (ticker, name, currency, price, previous_close, change, change_percent, market_cap, dividend_rate, dividend_yield, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(ticker) DO UPDATE SET
         name = ?, currency = ?, price = ?, previous_close = ?, change = ?, change_percent = ?,
         market_cap = ?, dividend_rate = ?, dividend_yield = ?, updated_at = datetime('now')`,
      [
        q.ticker, q.name, q.currency, q.price, q.previous_close, q.change, q.change_percent,
        q.market_cap, q.dividend_rate, q.dividend_yield,
        q.name, q.currency, q.price, q.previous_close, q.change, q.change_percent,
        q.market_cap, q.dividend_rate, q.dividend_yield,
      ]
    )
  }

  for (const ticker of tickers) {
    const divs = await getDividendHistory(ticker)
    for (const d of divs) {
      try {
        stmtRun(
          'INSERT OR IGNORE INTO dividends (ticker, amount, ex_date) VALUES (?, ?, ?)',
          [d.ticker, d.amount, d.ex_date]
        )
      } catch {
        // ignore duplicate
      }
    }
  }

  const quoteCurrencies = quotes.map((q) => q.currency)
  const cashCurrencies = stmtAll('SELECT DISTINCT currency FROM cash_positions').map((r) => r.currency)
  const allCurrencies = [...new Set([...quoteCurrencies, ...cashCurrencies])]
  if (allCurrencies.length) {
    latestRates = await getExchangeRates(allCurrencies)
  }

  if (quotes.length) {
    broadcast({ type: 'quotes', data: quotes, rates: latestRates })
  }
}

export function getRates() {
  return latestRates
}

async function quickRefresh() {
  const tickers = getUniqueTickers()
  if (!tickers.length) return

  const quotes = await getQuotes(tickers)
  for (const q of quotes) {
    stmtRun(
      `INSERT INTO quotes (ticker, name, currency, price, previous_close, change, change_percent, market_cap, dividend_rate, dividend_yield, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(ticker) DO UPDATE SET
         name = ?, currency = ?, price = ?, previous_close = ?, change = ?, change_percent = ?,
         market_cap = ?, dividend_rate = ?, dividend_yield = ?, updated_at = datetime('now')`,
      [
        q.ticker, q.name, q.currency, q.price, q.previous_close, q.change, q.change_percent,
        q.market_cap, q.dividend_rate, q.dividend_yield,
        q.name, q.currency, q.price, q.previous_close, q.change, q.change_percent,
        q.market_cap, q.dividend_rate, q.dividend_yield,
      ]
    )
  }

  if (quotes.length) {
    broadcast({ type: 'quotes', data: quotes, rates: latestRates })
  }
}

export function triggerQuickRefresh() {
  quickRefresh().catch((err) => console.error('Quick refresh failed:', err.message))
}

export function triggerPoll() {
  poll().catch((err) => console.error('Manual poll failed:', err.message))
}

function syncPortfolioToWatchlist() {
  const tickers = getUniqueTickers()
  for (const ticker of tickers) {
    try {
      stmtRun('INSERT OR IGNORE INTO watchlist (ticker) VALUES (?)', [ticker])
    } catch {}
  }
}

export function startPoller() {
  syncPortfolioToWatchlist()
  poll().catch((err) => console.error('Initial poll failed:', err.message))
  setInterval(() => {
    poll().catch((err) => console.error('Poll failed:', err.message))
  }, POLL_INTERVAL)
}
