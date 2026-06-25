import { Router } from 'express'
import { stmtAll, stmtGet, stmtRun } from '../db.js'
import { getQuotes, getPeriodChanges, getChartData } from '../services/stockService.js'

const router = Router()
const TICKER_RE = /^[A-Z0-9.\-]{1,20}$/
const MAX_WATCHLIST = 200

let cachedQuotes = {}
let cachedPeriodChanges = {}
let lastFetch = 0

async function fetchWatchlistQuotes() {
  const rows = stmtAll('SELECT ticker FROM watchlist')
  if (!rows.length) return {}

  const tickers = rows.map((r) => r.ticker)
  const quotes = await getQuotes(tickers)
  const map = {}
  for (const q of quotes) {
    map[q.ticker] = q
  }
  cachedQuotes = map
  lastFetch = Date.now()

  for (const ticker of tickers) {
    try {
      cachedPeriodChanges[ticker] = await getPeriodChanges(ticker)
    } catch {
      cachedPeriodChanges[ticker] = {}
    }
  }

  return map
}

router.get('/', (req, res) => {
  const rows = stmtAll('SELECT * FROM watchlist ORDER BY id')
  const result = rows.map((r) => ({
    ...r,
    quote: cachedQuotes[r.ticker] || null,
    periodChanges: cachedPeriodChanges[r.ticker] || null,
  }))
  res.json({ items: result, lastFetch })
})

router.get('/chart/:ticker', async (req, res) => {
  const ticker = req.params.ticker.trim().toUpperCase()
  if (!TICKER_RE.test(ticker)) {
    return res.status(400).json({ error: 'Invalid ticker' })
  }
  const range = ['1m', '3m', '6m', '1y'].includes(req.query.range)
    ? req.query.range
    : '1y'

  try {
    const data = await getChartData(ticker, range)
    res.json({ ticker, range, data })
  } catch (err) {
    console.error(`Chart fetch failed for ${ticker}:`, err.message)
    res.status(500).json({ error: 'Failed to fetch chart data' })
  }
})

router.post('/refresh', async (req, res) => {
  try {
    await fetchWatchlistQuotes()
    res.json({ success: true, lastFetch })
  } catch (err) {
    console.error('Watchlist refresh failed:', err.message)
    res.status(500).json({ error: 'Failed to refresh watchlist' })
  }
})

router.post('/', (req, res) => {
  const { ticker } = req.body
  if (!ticker || typeof ticker !== 'string') {
    return res.status(400).json({ error: 'Ticker is required' })
  }
  const sanitized = ticker.trim().toUpperCase()
  if (!TICKER_RE.test(sanitized)) {
    return res.status(400).json({ error: 'Invalid ticker format' })
  }

  const count = stmtAll('SELECT COUNT(*) as c FROM watchlist')[0]?.c || 0
  if (count >= MAX_WATCHLIST) {
    return res.status(400).json({ error: `Watchlist limit reached (max ${MAX_WATCHLIST})` })
  }

  const existing = stmtGet('SELECT 1 FROM watchlist WHERE ticker = ?', [sanitized])
  if (existing) {
    return res.status(409).json({ error: 'Ticker already in watchlist' })
  }

  stmtRun('INSERT INTO watchlist (ticker) VALUES (?)', [sanitized])
  const row = stmtGet('SELECT * FROM watchlist WHERE ticker = ?', [sanitized])

  fetchWatchlistQuotes().catch(() => {})

  res.status(201).json(row)
})

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid ID' })
  }

  const result = stmtRun('DELETE FROM watchlist WHERE id = ?', [id])
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Ticker not found in watchlist' })
  }
  res.json({ success: true })
})

export default router
