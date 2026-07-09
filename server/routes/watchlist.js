import { Router } from 'express'
import { stmtAll, stmtGet, stmtRun } from '../db.js'
import { getQuotes, getPeriodChanges, getChartData } from '../services/stockService.js'

const router = Router()
const TICKER_RE = /^[A-Z0-9.\-=]{1,20}$/
const MAX_WATCHLIST = 200

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

let cachedQuotes = {}
let cachedPeriodChanges = {}
let lastFetch = 0
let lastPeriodFetch = 0
const PERIOD_CACHE_MS = 30 * 60 * 1000

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

  const alerts = stmtAll('SELECT * FROM price_alerts WHERE triggered = 0')
  for (const alert of alerts) {
    const q = map[alert.ticker]
    if (!q) continue
    const triggered =
      (alert.condition === 'above' && q.price >= alert.target_price) ||
      (alert.condition === 'below' && q.price <= alert.target_price)
    if (triggered) {
      stmtRun("UPDATE price_alerts SET triggered = 1, triggered_at = datetime('now') WHERE id = ?", [alert.id])
      stmtRun(
        'INSERT INTO notifications (type, title, message) VALUES (?, ?, ?)',
        [
          'price_alert',
          `${alert.ticker} hit ${alert.condition === 'above' ? 'above' : 'below'} $${alert.target_price}`,
          `${alert.ticker} is now at $${q.price.toFixed(2)} (target: ${alert.condition} $${alert.target_price})`,
        ]
      )
    }
  }

  const needPeriodRefresh = Date.now() - lastPeriodFetch > PERIOD_CACHE_MS
  if (needPeriodRefresh) {
    for (let i = 0; i < tickers.length; i++) {
      if (i > 0 && i % 3 === 0) await delay(2000)
      try {
        cachedPeriodChanges[tickers[i]] = await getPeriodChanges(tickers[i])
      } catch {
        cachedPeriodChanges[tickers[i]] = {}
      }
    }
    lastPeriodFetch = Date.now()
  }

  return map
}

router.get('/', (req, res) => {
  const rows = stmtAll('SELECT * FROM watchlist ORDER BY sort_order ASC, id ASC')
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

router.get('/lists', (req, res) => {
  const rows = stmtAll('SELECT DISTINCT list_name FROM watchlist ORDER BY list_name')
  res.json(rows.map((r) => r.list_name || 'Default'))
})

router.post('/', (req, res) => {
  const { ticker, list_name } = req.body
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

  const listName = (list_name || 'Default').trim().substring(0, 50)
  stmtRun('INSERT INTO watchlist (ticker, list_name) VALUES (?, ?)', [sanitized, listName])
  const row = stmtGet('SELECT * FROM watchlist WHERE ticker = ?', [sanitized])

  fetchWatchlistQuotes().catch(() => {})
  res.status(201).json(row)
})

router.put('/reorder', (req, res) => {
  const { order } = req.body
  if (!Array.isArray(order)) return res.status(400).json({ error: 'Order must be an array of tickers' })

  for (let i = 0; i < order.length; i++) {
    stmtRun('UPDATE watchlist SET sort_order = ? WHERE ticker = ?', [i, order[i]])
  }
  res.json({ success: true })
})

router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid ID' })

  const existing = stmtGet('SELECT * FROM watchlist WHERE id = ?', [id])
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const { note, list_name } = req.body
  if (note !== undefined) {
    stmtRun('UPDATE watchlist SET note = ? WHERE id = ?', [note?.substring(0, 500) || null, id])
  }
  if (list_name !== undefined) {
    stmtRun('UPDATE watchlist SET list_name = ? WHERE id = ?', [(list_name || 'Default').trim().substring(0, 50), id])
  }
  const row = stmtGet('SELECT * FROM watchlist WHERE id = ?', [id])
  res.json(row)
})

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid ID' })

  const result = stmtRun('DELETE FROM watchlist WHERE id = ?', [id])
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' })
  res.json({ success: true })
})

router.get('/alerts', (req, res) => {
  const rows = stmtAll('SELECT * FROM price_alerts ORDER BY created_at DESC')
  res.json(rows)
})

router.post('/alerts', (req, res) => {
  const { ticker, condition, target_price } = req.body
  if (!ticker || typeof ticker !== 'string') return res.status(400).json({ error: 'Ticker required' })
  if (condition !== 'above' && condition !== 'below') return res.status(400).json({ error: 'Condition must be above or below' })
  if (!Number.isFinite(target_price) || target_price <= 0) return res.status(400).json({ error: 'Invalid target price' })

  const result = stmtRun(
    'INSERT INTO price_alerts (ticker, condition, target_price) VALUES (?, ?, ?)',
    [ticker.trim().toUpperCase(), condition, target_price]
  )
  const row = stmtGet('SELECT * FROM price_alerts WHERE id = ?', [result.lastInsertRowid])
  res.status(201).json(row)
})

router.delete('/alerts/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid ID' })
  stmtRun('DELETE FROM price_alerts WHERE id = ?', [id])
  res.json({ success: true })
})

router.get('/notifications', (req, res) => {
  const rows = stmtAll('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50')
  const unread = stmtAll('SELECT COUNT(*) as c FROM notifications WHERE read = 0')[0]?.c || 0
  res.json({ notifications: rows, unread })
})

router.post('/notifications/read', (req, res) => {
  stmtRun('UPDATE notifications SET read = 1 WHERE read = 0')
  res.json({ success: true })
})

export default router
