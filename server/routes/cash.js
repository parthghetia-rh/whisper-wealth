import { Router } from 'express'
import { stmtAll, stmtGet, stmtRun } from '../db.js'

const router = Router()
const CURRENCY_RE = /^[A-Z]{3,5}$/

function validateCash(body) {
  const { label, currency, amount, interest_rate } = body

  if (!label || typeof label !== 'string' || label.trim().length > 100) {
    return 'Label is required (max 100 characters)'
  }
  if (!currency || typeof currency !== 'string' || !CURRENCY_RE.test(currency.trim().toUpperCase())) {
    return 'Invalid currency code'
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return 'Amount must be a non-negative number'
  }
  if (!Number.isFinite(interest_rate) || interest_rate < 0 || interest_rate > 100) {
    return 'Interest rate must be between 0 and 100'
  }
  return null
}

router.get('/', (req, res) => {
  const rows = stmtAll('SELECT * FROM cash_positions ORDER BY currency, id')
  res.json(rows)
})

router.get('/summary', (req, res) => {
  const rows = stmtAll('SELECT * FROM cash_positions')

  const byCurrency = {}
  for (const r of rows) {
    if (!byCurrency[r.currency]) {
      byCurrency[r.currency] = { total_cash: 0, total_annual_interest: 0, positions: [] }
    }
    const annual_interest = r.amount * (r.interest_rate / 100)
    byCurrency[r.currency].total_cash += r.amount
    byCurrency[r.currency].total_annual_interest += annual_interest
    byCurrency[r.currency].positions.push({
      id: r.id,
      label: r.label,
      amount: r.amount,
      interest_rate: r.interest_rate,
      annual_interest: Math.round(annual_interest * 100) / 100,
      monthly_interest: Math.round((annual_interest / 12) * 100) / 100,
      weekly_interest: Math.round((annual_interest / 52) * 100) / 100,
    })
  }

  const currencies = Object.entries(byCurrency).map(([currency, data]) => ({
    currency,
    total_cash: Math.round(data.total_cash * 100) / 100,
    total_annual_interest: Math.round(data.total_annual_interest * 100) / 100,
    total_monthly_interest: Math.round((data.total_annual_interest / 12) * 100) / 100,
    total_weekly_interest: Math.round((data.total_annual_interest / 52) * 100) / 100,
    positions: data.positions,
  }))

  res.json({ currencies })
})

router.post('/', (req, res) => {
  const error = validateCash(req.body)
  if (error) return res.status(400).json({ error })

  const result = stmtRun(
    'INSERT INTO cash_positions (label, currency, amount, interest_rate) VALUES (?, ?, ?, ?)',
    [req.body.label.trim(), req.body.currency.trim().toUpperCase(), req.body.amount, req.body.interest_rate]
  )

  const row = stmtGet('SELECT * FROM cash_positions WHERE id = ?', [result.lastInsertRowid])
  res.status(201).json(row)
})

router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid ID' })
  }

  const existing = stmtGet('SELECT * FROM cash_positions WHERE id = ?', [id])
  if (!existing) {
    return res.status(404).json({ error: 'Cash position not found' })
  }

  const error = validateCash(req.body)
  if (error) return res.status(400).json({ error })

  stmtRun(
    'UPDATE cash_positions SET label = ?, currency = ?, amount = ?, interest_rate = ? WHERE id = ?',
    [req.body.label.trim(), req.body.currency.trim().toUpperCase(), req.body.amount, req.body.interest_rate, id]
  )

  const row = stmtGet('SELECT * FROM cash_positions WHERE id = ?', [id])
  res.json(row)
})

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid ID' })
  }

  const result = stmtRun('DELETE FROM cash_positions WHERE id = ?', [id])
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Cash position not found' })
  }
  res.json({ success: true })
})

export default router
