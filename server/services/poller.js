import db, { stmtAll, stmtRun, stmtRunBatch, stmtGet, save } from '../db.js'
import { getQuotes, getDividendHistory, getExchangeRates } from './stockService.js'
import { checkMilestones } from './milestones.js'

const MARKET_POLL_INTERVAL = 5 * 60 * 1000
const AFTER_HOURS_POLL_INTERVAL = 30 * 60 * 1000
const HEAVY_POLL_INTERVAL = 6 * 60 * 60 * 1000
let lastHeavyPoll = 0

function isMarketHours() {
  const now = new Date()
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const hour = et.getHours()
  const min = et.getMinutes()
  const day = et.getDay()
  if (day === 0 || day === 6) return false
  const time = hour * 60 + min
  return time >= 540 && time <= 960
}
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

function cleanupDRIP() {
  const count = stmtAll("SELECT COUNT(*) as c FROM transactions WHERE source = 'drip'")[0]?.c || 0
  if (count > 0) {
    stmtRun("DELETE FROM transactions WHERE source = 'drip'")
    console.log(`Cleaned up ${count} DRIP transaction(s)`)
  }
  try {
    stmtRun("DELETE FROM settings WHERE key IN ('drip_enabled', 'fractional_shares')")
  } catch {}
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

  const needHeavyPoll = Date.now() - lastHeavyPoll > HEAVY_POLL_INTERVAL

  if (needHeavyPoll) {
    console.log('Running heavy poll (dividends, rates, snapshot)...')
    for (let i = 0; i < tickers.length; i++) {
      if (i > 0 && i % 3 === 0) await new Promise((r) => setTimeout(r, 2000))
      const ticker = tickers[i]
      const divs = await getDividendHistory(ticker)
      for (const d of divs) {
        try {
          stmtRun(
            'INSERT OR IGNORE INTO dividends (ticker, amount, ex_date) VALUES (?, ?, ?)',
            [d.ticker, d.amount, d.ex_date]
          )
        } catch {}
      }
    }

    const quoteCurrencies = quotes.map((q) => q.currency)
    const cashCurrencies = stmtAll('SELECT DISTINCT currency FROM cash_positions').map((r) => r.currency)
    const allCurrencies = [...new Set([...quoteCurrencies, ...cashCurrencies])]
    if (allCurrencies.length) {
      latestRates = await getExchangeRates(allCurrencies)
    }

    takeSnapshot()
    lastHeavyPoll = Date.now()
  }

  if (quotes.length) {
    broadcast({ type: 'quotes', data: quotes, rates: latestRates })
  }
}

function takeSnapshot() {
  const today = new Date().toISOString().split('T')[0]

  const txns = stmtAll('SELECT ticker, type, shares, price_per_share FROM transactions')
  const holdingsMap = {}
  for (const t of txns) {
    if (!holdingsMap[t.ticker]) holdingsMap[t.ticker] = { shares: 0, cost: 0 }
    if (t.type === 'buy') {
      holdingsMap[t.ticker].cost += t.shares * t.price_per_share
      holdingsMap[t.ticker].shares += t.shares
    } else {
      const avg = holdingsMap[t.ticker].shares > 0 ? holdingsMap[t.ticker].cost / holdingsMap[t.ticker].shares : 0
      holdingsMap[t.ticker].shares -= t.shares
      holdingsMap[t.ticker].cost = holdingsMap[t.ticker].shares * avg
    }
  }

  let totalValue = 0
  let totalCost = 0
  let positions = 0
  for (const [ticker, h] of Object.entries(holdingsMap)) {
    if (h.shares <= 0) continue
    const quote = stmtGet('SELECT price FROM quotes WHERE ticker = ?', [ticker])
    totalValue += h.shares * (quote?.price || (h.shares > 0 ? h.cost / h.shares : 0))
    totalCost += h.cost
    positions++
  }

  const cashRows = stmtAll('SELECT * FROM cash_positions')
  for (const c of cashRows) {
    if ((c.type || 'cash') === 'cash') {
      totalValue += c.amount
      totalCost += c.amount
    }
  }

  let annualDividends = 0
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const cutoff = oneYearAgo.toISOString().split('T')[0]
  for (const [ticker, h] of Object.entries(holdingsMap)) {
    if (h.shares <= 0) continue
    const divs = stmtAll('SELECT amount FROM dividends WHERE ticker = ? AND ex_date >= ?', [ticker, cutoff])
    annualDividends += h.shares * divs.reduce((s, d) => s + d.amount, 0)
  }
  for (const c of cashRows) {
    if ((c.type || 'cash') === 'income') {
      const freq = c.frequency || 'yearly'
      annualDividends += freq === 'weekly' ? c.amount * 52 : freq === 'monthly' ? c.amount * 12 : c.amount
    } else if ((c.type || 'cash') === 'cash') {
      annualDividends += c.amount * ((c.interest_rate || 0) / 100)
    }
  }

  const snapshot = {
    total_value: Math.round(totalValue * 100) / 100,
    total_cost: Math.round(totalCost * 100) / 100,
    total_gain: Math.round((totalValue - totalCost) * 100) / 100,
    annual_dividends: Math.round(annualDividends * 100) / 100,
    positions,
  }

  const existing = stmtGet('SELECT 1 FROM portfolio_snapshots WHERE date = ?', [today])
  if (!existing) {
    stmtRun(
      "INSERT INTO portfolio_snapshots (date, total_value, total_cost, total_gain, annual_dividends, positions) VALUES (?, ?, ?, ?, ?, ?)",
      [today, snapshot.total_value, snapshot.total_cost, snapshot.total_gain, snapshot.annual_dividends, snapshot.positions]
    )
  } else {
    stmtRun(
      "UPDATE portfolio_snapshots SET total_value = ?, total_cost = ?, total_gain = ?, annual_dividends = ?, positions = ?, updated_at = datetime('now') WHERE date = ?",
      [snapshot.total_value, snapshot.total_cost, snapshot.total_gain, snapshot.annual_dividends, snapshot.positions, today]
    )
  }

  checkMilestones(snapshot)
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

function scheduleNext() {
  if (!isMarketHours()) {
    console.log('After hours — polling paused. Use manual refresh.')
    setTimeout(scheduleNext, 5 * 60 * 1000)
    return
  }
  setTimeout(() => {
    poll()
      .catch((err) => console.error('Poll failed:', err.message))
      .finally(scheduleNext)
  }, MARKET_POLL_INTERVAL)
}

export function startPoller() {
  cleanupDRIP()
  syncPortfolioToWatchlist()
  console.log(`Market hours: ${isMarketHours() ? 'YES (5min auto-polling)' : 'NO (manual refresh only)'}`)
  poll().catch((err) => console.error('Initial poll failed:', err.message))
  scheduleNext()
}
