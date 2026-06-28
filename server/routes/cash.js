import { Router } from 'express'
import { stmtAll, stmtGet, stmtRun } from '../db.js'
import { getSettingBool } from './settings.js'

const router = Router()
const CURRENCY_RE = /^[A-Z]{3,5}$/
const VALID_TYPES = ['cash', 'income']
const VALID_FREQ = ['weekly', 'monthly', 'yearly']

function calcAnnualInterest(amount, rate) {
  if (getSettingBool('cash_interest_compound')) {
    return amount * Math.pow(1 + rate / 100 / 12, 12) - amount
  }
  return amount * (rate / 100)
}

function annualizeIncome(amount, frequency) {
  if (frequency === 'weekly') return amount * 52
  if (frequency === 'monthly') return amount * 12
  return amount
}

function validateEntry(body) {
  const { label, currency, amount, type } = body

  if (!label || typeof label !== 'string' || label.trim().length > 100) {
    return 'Label is required (max 100 characters)'
  }
  if (!currency || typeof currency !== 'string' || !CURRENCY_RE.test(currency.trim().toUpperCase())) {
    return 'Invalid currency code'
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return 'Amount must be a non-negative number'
  }

  const entryType = type || 'cash'
  if (entryType === 'cash') {
    const interest_rate = body.interest_rate
    if (!Number.isFinite(interest_rate) || interest_rate < 0 || interest_rate > 100) {
      return 'Interest rate must be between 0 and 100'
    }
  } else if (entryType === 'income') {
    const frequency = body.frequency || 'monthly'
    if (!VALID_FREQ.includes(frequency)) {
      return 'Frequency must be weekly, monthly, or yearly'
    }
  }
  return null
}

router.get('/', (req, res) => {
  const rows = stmtAll('SELECT * FROM cash_positions ORDER BY type, currency, id')
  res.json(rows)
})

router.get('/summary', (req, res) => {
  const rows = stmtAll('SELECT * FROM cash_positions')

  const byCurrency = {}
  for (const r of rows) {
    if (!byCurrency[r.currency]) {
      byCurrency[r.currency] = { total_cash: 0, total_annual: 0, cash_items: [], income_items: [] }
    }

    const type = r.type || 'cash'

    if (type === 'income') {
      const annual = annualizeIncome(r.amount, r.frequency || 'yearly')
      byCurrency[r.currency].total_annual += annual
      byCurrency[r.currency].income_items.push({
        id: r.id,
        label: r.label,
        amount: r.amount,
        frequency: r.frequency || 'yearly',
        annual_amount: Math.round(annual * 100) / 100,
        monthly_amount: Math.round((annual / 12) * 100) / 100,
        weekly_amount: Math.round((annual / 52) * 100) / 100,
      })
    } else {
      const annual_interest = calcAnnualInterest(r.amount, r.interest_rate)
      byCurrency[r.currency].total_cash += r.amount
      byCurrency[r.currency].total_annual += annual_interest
      byCurrency[r.currency].cash_items.push({
        id: r.id,
        label: r.label,
        amount: r.amount,
        interest_rate: r.interest_rate,
        annual_interest: Math.round(annual_interest * 100) / 100,
        monthly_interest: Math.round((annual_interest / 12) * 100) / 100,
        weekly_interest: Math.round((annual_interest / 52) * 100) / 100,
      })
    }
  }

  const currencies = Object.entries(byCurrency).map(([currency, data]) => ({
    currency,
    total_cash: Math.round(data.total_cash * 100) / 100,
    total_annual: Math.round(data.total_annual * 100) / 100,
    total_monthly: Math.round((data.total_annual / 12) * 100) / 100,
    total_weekly: Math.round((data.total_annual / 52) * 100) / 100,
    cash_items: data.cash_items,
    income_items: data.income_items,
  }))

  res.json({ currencies })
})

router.post('/', (req, res) => {
  const error = validateEntry(req.body)
  if (error) return res.status(400).json({ error })

  const type = req.body.type || 'cash'
  const frequency = req.body.frequency || 'yearly'
  const interest_rate = type === 'cash' ? req.body.interest_rate : 0

  const result = stmtRun(
    'INSERT INTO cash_positions (label, currency, amount, interest_rate, type, frequency) VALUES (?, ?, ?, ?, ?, ?)',
    [req.body.label.trim(), req.body.currency.trim().toUpperCase(), req.body.amount, interest_rate, type, frequency]
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
    return res.status(404).json({ error: 'Entry not found' })
  }

  const error = validateEntry(req.body)
  if (error) return res.status(400).json({ error })

  const type = req.body.type || 'cash'
  const frequency = req.body.frequency || 'yearly'
  const interest_rate = type === 'cash' ? req.body.interest_rate : 0

  stmtRun(
    'UPDATE cash_positions SET label = ?, currency = ?, amount = ?, interest_rate = ?, type = ?, frequency = ? WHERE id = ?',
    [req.body.label.trim(), req.body.currency.trim().toUpperCase(), req.body.amount, interest_rate, type, frequency, id]
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
    return res.status(404).json({ error: 'Entry not found' })
  }
  res.json({ success: true })
})

export default router
