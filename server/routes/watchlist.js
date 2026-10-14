import { Router } from 'express'
import { stmtAll, stmtGet, stmtRun } from '../db.js'
import { getChartData, getQuotes } from '../services/stockService.js'
import { refreshMarketData } from '../services/marketDataService.js'

const router = Router()
const TICKER_RE = /^[A-Z0-9.\-=]{1,20}$/
const MAX_WATCHLIST = 200
const lookupCache = new Map()
const lookupJobs = new Map()

// Explicit lookups only: typing in the search box never calls the provider.
router.get('/quote/:ticker', async (req, res) => {
  const ticker = req.params.ticker.trim().toUpperCase()
  if (!TICKER_RE.test(ticker)) return res.status(400).json({ error: 'Invalid ticker' })
  const stored = stmtGet('SELECT * FROM quotes WHERE ticker = ?', [ticker])
  if (stored?.price != null) return res.json(stored)
  const cached = lookupCache.get(ticker)
  if (cached && Date.now() - cached.at < 60_000) return res.json(cached.quote)
  try {
    if (!lookupJobs.has(ticker)) {
      if (lookupJobs.size >= 8) return res.status(429).json({ error: 'Search is busy. Please try again shortly.' })
      lookupJobs.set(ticker, getQuotes([ticker]).then(({ quotes, failures }) => {
        if (!quotes.length) {
          const error = new Error(failures[0]?.kind === 'invalid' ? 'Ticker not found. Check the exchange suffix (for example, .TO).' : 'Market data is temporarily unavailable. Try again shortly.')
          error.status = failures[0]?.kind === 'invalid' ? 404 : 503
          throw error
        }
        const quote = { ...quotes[0], status: 'fresh', last_success_at: new Date().toISOString() }
        lookupCache.delete(ticker)
        lookupCache.set(ticker, { quote, at: Date.now() })
        if (lookupCache.size > 100) lookupCache.delete(lookupCache.keys().next().value)
        return quote
      }).finally(() => lookupJobs.delete(ticker)))
    }
    res.json(await lookupJobs.get(ticker))
  } catch (err) {
    res.status(err.status || 503).json({ error: err.message })
  }
})

router.get('/', (req, res) => {
  const rows = stmtAll('SELECT * FROM watchlist ORDER BY sort_order ASC, id ASC')
  const result = rows.map((row) => {
    const quote = stmtGet('SELECT * FROM quotes WHERE ticker = ?', [row.ticker])
    const period = stmtGet('SELECT * FROM period_changes WHERE ticker = ?', [row.ticker])
    return {
      ...row,
      quote,
      periodChanges: period ? {
        '3m': period.change_3m,
        '6m': period.change_6m,
        '1y': period.change_1y,
      } : null,
    }
  })
  const lastFetch = stmtGet('SELECT MAX(last_success_at) AS value FROM quotes')?.value || null
  res.json({ items: result, lastFetch })
})

router.get('/chart/:ticker', async (req, res) => {
  const ticker = req.params.ticker.trim().toUpperCase()
  if (!TICKER_RE.test(ticker)) {
    return res.status(400).json({ error: 'Invalid ticker' })
  }
  const range = ['1d', '1w', '1m', '3m', '6m', '1y'].includes(req.query.range)
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
    const result = await refreshMarketData({ reason: 'watchlist-manual', force: true })
    res.json(result)
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

  refreshMarketData({ reason: 'watchlist-add', force: true }).catch((err) => {
    console.error('Quote refresh after watchlist add failed:', err.message)
  })
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
