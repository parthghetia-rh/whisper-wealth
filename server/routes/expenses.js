import { Router } from 'express'
import { stmtAll, stmtGet, stmtRun } from '../db.js'

const router = Router()
const CURRENCY_RE = /^[A-Z]{3,5}$/
const VALID_FREQ = ['weekly', 'biweekly', 'monthly', 'yearly']
const VALID_CATEGORIES = [
  'housing', 'transportation', 'food', 'utilities', 'insurance',
  'healthcare', 'subscriptions', 'education', 'personal', 'debt', 'other',
]

function annualize(amount, frequency) {
  if (frequency === 'weekly') return amount * 52
  if (frequency === 'biweekly') return amount * 26
  if (frequency === 'monthly') return amount * 12
  return amount
}

function validate(body) {
  const { label, category, currency, amount, frequency } = body
  if (!label || typeof label !== 'string' || label.trim().length > 100) {
    return 'Label is required (max 100 characters)'
  }
  if (!VALID_CATEGORIES.includes(category || 'other')) {
    return 'Invalid category'
  }
  if (!currency || !CURRENCY_RE.test(currency.trim().toUpperCase())) {
    return 'Invalid currency'
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Amount must be positive'
  }
  if (!VALID_FREQ.includes(frequency || 'monthly')) {
    return 'Frequency must be weekly, biweekly, monthly, or yearly'
  }
  return null
}

router.get('/', (req, res) => {
  const rows = stmtAll('SELECT * FROM expenses ORDER BY category, id')
  res.json(rows)
})

router.get('/summary', (req, res) => {
  const rows = stmtAll('SELECT * FROM expenses')

  const byCurrency = {}
  const byCategory = {}
  let totalAnnual = 0

  for (const r of rows) {
    const annual = annualize(r.amount, r.frequency)

    if (!byCurrency[r.currency]) {
      byCurrency[r.currency] = { total_annual: 0, total_monthly: 0, items: [] }
    }
    byCurrency[r.currency].total_annual += annual
    byCurrency[r.currency].total_monthly += annual / 12
    byCurrency[r.currency].items.push({
      id: r.id,
      label: r.label,
      category: r.category,
      amount: r.amount,
      frequency: r.frequency,
      annual: Math.round(annual * 100) / 100,
      monthly: Math.round((annual / 12) * 100) / 100,
    })

    if (!byCategory[r.category]) byCategory[r.category] = 0
    byCategory[r.category] += annual
    totalAnnual += annual
  }

  const currencies = Object.entries(byCurrency).map(([currency, data]) => ({
    currency,
    total_annual: Math.round(data.total_annual * 100) / 100,
    total_monthly: Math.round(data.total_monthly * 100) / 100,
    total_weekly: Math.round((data.total_annual / 52) * 100) / 100,
    items: data.items,
  }))

  const categories = Object.entries(byCategory)
    .map(([category, annual]) => ({
      category,
      annual: Math.round(annual * 100) / 100,
      monthly: Math.round((annual / 12) * 100) / 100,
      percent: totalAnnual > 0 ? Math.round((annual / totalAnnual) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.annual - a.annual)

  res.json({ currencies, categories })
})

router.post('/', (req, res) => {
  const error = validate(req.body)
  if (error) return res.status(400).json({ error })

  const { label, category, currency, amount, frequency } = req.body
  const result = stmtRun(
    'INSERT INTO expenses (label, category, currency, amount, frequency) VALUES (?, ?, ?, ?, ?)',
    [label.trim(), category || 'other', (currency || 'CAD').trim().toUpperCase(), amount, frequency || 'monthly']
  )
  const row = stmtGet('SELECT * FROM expenses WHERE id = ?', [result.lastInsertRowid])
  res.status(201).json(row)
})

router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid ID' })

  const existing = stmtGet('SELECT * FROM expenses WHERE id = ?', [id])
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const error = validate(req.body)
  if (error) return res.status(400).json({ error })

  const { label, category, currency, amount, frequency } = req.body
  stmtRun(
    'UPDATE expenses SET label = ?, category = ?, currency = ?, amount = ?, frequency = ? WHERE id = ?',
    [label.trim(), category || 'other', (currency || 'CAD').trim().toUpperCase(), amount, frequency || 'monthly', id]
  )
  const row = stmtGet('SELECT * FROM expenses WHERE id = ?', [id])
  res.json(row)
})

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid ID' })

  const result = stmtRun('DELETE FROM expenses WHERE id = ?', [id])
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' })
  res.json({ success: true })
})

export default router
