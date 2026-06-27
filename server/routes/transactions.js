import { Router } from 'express'
import { stmtAll, stmtGet, stmtRun, stmtRunBatch, save } from '../db.js'
import { triggerPoll } from '../services/poller.js'
import { parseHeaders, importWithMapping } from '../services/csvParser.js'
import { parsePDF } from '../services/pdfParser.js'

const router = Router()
const TICKER_RE = /^[A-Z0-9.\-]{1,20}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function validateTransaction(body) {
  const { ticker, type, shares, price_per_share, date } = body

  if (!ticker || typeof ticker !== 'string') {
    return 'Invalid ticker'
  }
  const sanitized = ticker.trim().toUpperCase()
  if (!TICKER_RE.test(sanitized)) {
    return 'Invalid ticker format'
  }
  if (type !== 'buy' && type !== 'sell') {
    return 'Type must be buy or sell'
  }
  if (!Number.isFinite(shares) || shares <= 0) {
    return 'Shares must be a positive number'
  }
  if (!Number.isFinite(price_per_share) || price_per_share <= 0) {
    return 'Price must be a positive number'
  }
  if (!date || !DATE_RE.test(date)) {
    return 'Date must be in YYYY-MM-DD format'
  }
  return null
}

router.get('/', (req, res) => {
  const rows = stmtAll('SELECT * FROM transactions ORDER BY date DESC, id DESC')
  res.json(rows)
})

router.post('/', (req, res) => {
  const error = validateTransaction(req.body)
  if (error) return res.status(400).json({ error })

  const sanitizedTicker = req.body.ticker.trim().toUpperCase()

  const result = stmtRun(
    'INSERT INTO transactions (ticker, type, shares, price_per_share, date) VALUES (?, ?, ?, ?, ?)',
    [sanitizedTicker, req.body.type, req.body.shares, req.body.price_per_share, req.body.date]
  )

  const row = stmtGet('SELECT * FROM transactions WHERE id = ?', [
    result.lastInsertRowid,
  ])

  const existingQuote = stmtGet('SELECT 1 FROM quotes WHERE ticker = ?', [sanitizedTicker])
  if (!existingQuote) {
    triggerPoll()
  }

  const inWatchlist = stmtGet('SELECT 1 FROM watchlist WHERE ticker = ?', [sanitizedTicker])
  if (!inWatchlist) {
    try { stmtRun('INSERT INTO watchlist (ticker) VALUES (?)', [sanitizedTicker]) } catch {}
  }

  res.status(201).json(row)
})

router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid ID' })
  }

  const existing = stmtGet('SELECT * FROM transactions WHERE id = ?', [id])
  if (!existing) {
    return res.status(404).json({ error: 'Transaction not found' })
  }

  const error = validateTransaction(req.body)
  if (error) return res.status(400).json({ error })

  const sanitizedTicker = req.body.ticker.trim().toUpperCase()

  stmtRun(
    'UPDATE transactions SET ticker = ?, type = ?, shares = ?, price_per_share = ?, date = ? WHERE id = ?',
    [sanitizedTicker, req.body.type, req.body.shares, req.body.price_per_share, req.body.date, id]
  )

  const row = stmtGet('SELECT * FROM transactions WHERE id = ?', [id])

  if (sanitizedTicker !== existing.ticker) {
    const hasQuote = stmtGet('SELECT 1 FROM quotes WHERE ticker = ?', [sanitizedTicker])
    if (!hasQuote) triggerPoll()
  }

  res.json(row)
})

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid ID' })
  }

  const result = stmtRun('DELETE FROM transactions WHERE id = ?', [id])
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Transaction not found' })
  }
  res.json({ success: true })
})

router.post('/import/parse-pdf', async (req, res) => {
  const { pdf } = req.body
  if (!pdf || typeof pdf !== 'string') {
    return res.status(400).json({ error: 'PDF data is required (base64)' })
  }
  try {
    const buffer = Buffer.from(pdf, 'base64')
    const result = await parsePDF(buffer)
    if (result.error) {
      return res.status(400).json({ error: result.error })
    }
    res.json(result)
  } catch (err) {
    console.error('PDF parse failed:', err.message)
    res.status(400).json({ error: 'Failed to parse PDF. Ensure it contains selectable text.' })
  }
})

router.post('/import/parse', (req, res) => {
  const { csv } = req.body
  if (!csv || typeof csv !== 'string') {
    return res.status(400).json({ error: 'File data is required' })
  }
  res.json(parseHeaders(csv))
})

router.post('/import/preview', (req, res) => {
  const { csv, mapping } = req.body
  if (!csv || typeof csv !== 'string') {
    return res.status(400).json({ error: 'File data is required' })
  }
  if (!mapping) {
    return res.status(400).json({ error: 'Column mapping is required' })
  }
  const result = importWithMapping(csv, mapping)
  if (result.error) {
    return res.status(400).json({ error: result.error })
  }
  res.json(result)
})

router.post('/import', (req, res) => {
  const { csv, mapping } = req.body
  if (!csv || typeof csv !== 'string') {
    return res.status(400).json({ error: 'File data is required' })
  }
  if (!mapping) {
    return res.status(400).json({ error: 'Column mapping is required' })
  }
  const result = importWithMapping(csv, mapping)
  if (result.error) {
    return res.status(400).json({ error: result.error })
  }
  if (!result.transactions.length) {
    return res.status(400).json({ error: 'No valid transactions found' })
  }
  if (result.transactions.length > 500) {
    return res.status(400).json({ error: 'Too many rows — max 500 per import' })
  }

  let imported = 0
  for (const t of result.transactions) {
    stmtRunBatch(
      'INSERT INTO transactions (ticker, type, shares, price_per_share, date) VALUES (?, ?, ?, ?, ?)',
      [t.ticker, t.type, t.shares, t.price_per_share, t.date]
    )
    const inWatchlist = stmtGet('SELECT 1 FROM watchlist WHERE ticker = ?', [t.ticker])
    if (!inWatchlist) {
      try { stmtRunBatch('INSERT INTO watchlist (ticker) VALUES (?)', [t.ticker]) } catch {}
    }
    imported++
  }
  save()
  triggerPoll()

  res.json({ imported, skipped: result.skipped.length, skippedDetails: result.skipped })
})

export default router
