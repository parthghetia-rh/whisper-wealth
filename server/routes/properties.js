import { Router } from 'express'
import { stmtAll, stmtGet, stmtRun, stmtRunBatch, transaction } from '../db.js'
import { ownerFields, readOwner, readScope, scopeWhere } from '../services/household.js'

const router = Router()
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const SUPPORTED_CURRENCIES = new Set(['CAD', 'USD', 'INR', 'EUR', 'GBP', 'JPY', 'AUD', 'HKD', 'SGD', 'CHF'])

function torontoDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

function cleanOptional(value) {
  const cleaned = typeof value === 'string' ? value.trim() : ''
  return cleaned || null
}

function validDate(value) {
  if (!DATE_RE.test(value || '')) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function validateSourceUrl(value) {
  if (!value) return null
  if (value.length > 500) return 'Source URL must be at most 500 characters'
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? null : 'Source URL must use HTTPS'
  } catch {
    return 'Source URL is invalid'
  }
}

function validateProperty(body) {
  if (typeof body.label !== 'string' || !body.label.trim() || body.label.trim().length > 100) {
    return 'Label is required (max 100 characters)'
  }
  if (body.address != null && (typeof body.address !== 'string' || body.address.trim().length > 250)) {
    return 'Address must be at most 250 characters'
  }
  const currency = String(body.currency || '').trim().toUpperCase()
  if (!SUPPORTED_CURRENCIES.has(currency)) return 'Unsupported currency'
  if (!Number.isFinite(body.purchase_price) || body.purchase_price < 0) {
    return 'Purchase price must be a non-negative number'
  }
  if (!validDate(body.purchase_date) || body.purchase_date > torontoDate()) {
    return 'Purchase date must be a valid date that is not in the future'
  }
  return null
}

function validateSnapshot(body, purchaseDate) {
  if (!validDate(body.valuation_date) || body.valuation_date > torontoDate()) {
    return 'Valuation date must be a valid date that is not in the future'
  }
  if (purchaseDate && body.valuation_date < purchaseDate) {
    return 'Valuation date cannot be before the purchase date'
  }
  if (!Number.isFinite(body.estimated_value) || body.estimated_value <= 0) {
    return 'Estimated value must be a positive number'
  }
  if (!Number.isFinite(body.mortgage_balance) || body.mortgage_balance < 0) {
    return 'Mortgage balance must be a non-negative number'
  }
  if (body.source_label != null && (typeof body.source_label !== 'string' || body.source_label.trim().length > 100)) {
    return 'Source label must be at most 100 characters'
  }
  if (body.note != null && (typeof body.note !== 'string' || body.note.trim().length > 500)) {
    return 'Note must be at most 500 characters'
  }
  return validateSourceUrl(cleanOptional(body.source_url))
}

function roundMoney(value) {
  return Math.round(value * 100) / 100
}

function selectProperty(id) {
  return stmtGet(
    `SELECT p.*, m.name AS member_name, m.color AS member_color
     FROM properties p LEFT JOIN household_members m ON m.id = p.member_id
     WHERE p.id = ?`,
    [id]
  )
}

function latestSnapshot(propertyId) {
  return stmtGet(
    `SELECT * FROM property_snapshots WHERE property_id = ?
     ORDER BY valuation_date DESC, id DESC LIMIT 1`,
    [propertyId]
  )
}

export function calculatePropertyMetrics(property, snapshot) {
  if (!snapshot) {
    return { estimated_value: null, mortgage_balance: null, equity: null, appreciation: null, appreciation_percent: null }
  }
  const equity = snapshot.estimated_value - snapshot.mortgage_balance
  const appreciation = snapshot.estimated_value - property.purchase_price
  return {
    estimated_value: roundMoney(snapshot.estimated_value),
    mortgage_balance: roundMoney(snapshot.mortgage_balance),
    equity: roundMoney(equity),
    appreciation: roundMoney(appreciation),
    appreciation_percent: property.purchase_price > 0
      ? Math.round((appreciation / property.purchase_price) * 10000) / 100
      : null,
  }
}

function presentProperty(row) {
  const snapshot = latestSnapshot(row.id)
  return {
    ...row,
    ...ownerFields(row),
    latest_snapshot: snapshot,
    ...calculatePropertyMetrics(row, snapshot),
  }
}

function presentSnapshot(property, snapshot) {
  const metrics = calculatePropertyMetrics(property, snapshot)
  return { ...snapshot, equity: metrics.equity, appreciation: metrics.appreciation }
}

router.get('/', (req, res) => {
  let scope
  try { scope = readScope(req) } catch (err) { return res.status(400).json({ error: err.message }) }
  const where = scopeWhere(scope, 'p.member_id')
  const properties = stmtAll(
    `SELECT p.*, m.name AS member_name, m.color AS member_color
     FROM properties p LEFT JOIN household_members m ON m.id = p.member_id
     WHERE ${where.sql} ORDER BY p.id DESC`,
    where.params
  ).map(presentProperty)

  const totals = {}
  for (const property of properties) {
    if (property.estimated_value == null) continue
    if (!totals[property.currency]) {
      totals[property.currency] = {
        currency: property.currency, properties: 0, estimated_value: 0,
        mortgage_balance: 0, equity: 0, appreciation: 0,
      }
    }
    const total = totals[property.currency]
    total.properties++
    total.estimated_value += property.estimated_value
    total.mortgage_balance += property.mortgage_balance
    total.equity += property.equity
    total.appreciation += property.appreciation
  }
  for (const total of Object.values(totals)) {
    total.estimated_value = roundMoney(total.estimated_value)
    total.mortgage_balance = roundMoney(total.mortgage_balance)
    total.equity = roundMoney(total.equity)
    total.appreciation = roundMoney(total.appreciation)
  }

  res.json({ scope: scope.key, items: properties, totals_by_currency: Object.values(totals) })
})

router.post('/', (req, res) => {
  const propertyError = validateProperty(req.body)
  if (propertyError) return res.status(400).json({ error: propertyError })
  const snapshotError = validateSnapshot(req.body, req.body.purchase_date)
  if (snapshotError) return res.status(400).json({ error: snapshotError })
  let owner
  try { owner = readOwner(req.body) } catch (err) { return res.status(400).json({ error: err.message }) }

  const propertyId = transaction(() => {
    const result = stmtRunBatch(
      `INSERT INTO properties
       (label, address, currency, purchase_price, purchase_date, member_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.body.label.trim(), cleanOptional(req.body.address), req.body.currency.trim().toUpperCase(),
        req.body.purchase_price, req.body.purchase_date, owner.memberId,
      ]
    )
    stmtRunBatch(
      `INSERT INTO property_snapshots
       (property_id, valuation_date, estimated_value, mortgage_balance, source_label, source_url, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        result.lastInsertRowid, req.body.valuation_date, req.body.estimated_value,
        req.body.mortgage_balance, cleanOptional(req.body.source_label) || 'Manual',
        cleanOptional(req.body.source_url), cleanOptional(req.body.note),
      ]
    )
    return result.lastInsertRowid
  })

  res.status(201).json(presentProperty(selectProperty(propertyId)))
})

router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid property ID' })
  const existing = selectProperty(id)
  if (!existing) return res.status(404).json({ error: 'Property not found' })
  const error = validateProperty(req.body)
  if (error) return res.status(400).json({ error })

  const currency = req.body.currency.trim().toUpperCase()
  if (currency !== existing.currency && stmtGet('SELECT 1 FROM property_snapshots WHERE property_id = ? LIMIT 1', [id])) {
    return res.status(400).json({ error: 'Currency cannot change after valuation history exists' })
  }
  const earliest = stmtGet('SELECT MIN(valuation_date) AS value FROM property_snapshots WHERE property_id = ?', [id])?.value
  if (earliest && req.body.purchase_date > earliest) {
    return res.status(400).json({ error: 'Purchase date cannot be after an existing valuation' })
  }
  let owner
  try { owner = readOwner(req.body, existing.member_id) } catch (err) { return res.status(400).json({ error: err.message }) }

  stmtRun(
    `UPDATE properties SET label = ?, address = ?, currency = ?, purchase_price = ?,
     purchase_date = ?, member_id = ?, updated_at = datetime('now') WHERE id = ?`,
    [
      req.body.label.trim(), cleanOptional(req.body.address), currency, req.body.purchase_price,
      req.body.purchase_date, owner.memberId, id,
    ]
  )
  res.json(presentProperty(selectProperty(id)))
})

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid property ID' })
  if (!selectProperty(id)) return res.status(404).json({ error: 'Property not found' })
  transaction(() => {
    stmtRunBatch('DELETE FROM property_snapshots WHERE property_id = ?', [id])
    stmtRunBatch('DELETE FROM properties WHERE id = ?', [id])
  })
  res.json({ success: true })
})

router.get('/:id/history', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid property ID' })
  let scope
  try { scope = readScope(req) } catch (err) { return res.status(400).json({ error: err.message }) }
  const where = scopeWhere(scope, 'p.member_id')
  const property = stmtGet(
    `SELECT p.*, m.name AS member_name, m.color AS member_color
     FROM properties p LEFT JOIN household_members m ON m.id = p.member_id
     WHERE p.id = ? AND ${where.sql}`,
    [id, ...where.params]
  )
  if (!property) return res.status(404).json({ error: 'Property not found in this scope' })
  const data = stmtAll(
    `SELECT * FROM property_snapshots WHERE property_id = ?
     ORDER BY valuation_date ASC, id ASC`,
    [id]
  ).map((snapshot) => presentSnapshot(property, snapshot))
  res.json({ property: presentProperty(property), data })
})

router.post('/:id/snapshots', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid property ID' })
  const property = selectProperty(id)
  if (!property) return res.status(404).json({ error: 'Property not found' })
  const error = validateSnapshot(req.body, property.purchase_date)
  if (error) return res.status(400).json({ error })
  const existing = stmtGet(
    'SELECT id FROM property_snapshots WHERE property_id = ? AND valuation_date = ?',
    [id, req.body.valuation_date]
  )
  stmtRun(
    `INSERT INTO property_snapshots
     (property_id, valuation_date, estimated_value, mortgage_balance, source_label, source_url, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(property_id, valuation_date) DO UPDATE SET
       estimated_value = excluded.estimated_value,
       mortgage_balance = excluded.mortgage_balance,
       source_label = excluded.source_label,
       source_url = excluded.source_url,
       note = excluded.note,
       updated_at = datetime('now')`,
    [
      id, req.body.valuation_date, req.body.estimated_value, req.body.mortgage_balance,
      cleanOptional(req.body.source_label) || 'Manual', cleanOptional(req.body.source_url),
      cleanOptional(req.body.note),
    ]
  )
  const snapshot = stmtGet(
    'SELECT * FROM property_snapshots WHERE property_id = ? AND valuation_date = ?',
    [id, req.body.valuation_date]
  )
  res.status(existing ? 200 : 201).json({ corrected: Boolean(existing), snapshot: presentSnapshot(property, snapshot) })
})

router.put('/:propertyId/snapshots/:snapshotId', (req, res) => {
  const propertyId = Number(req.params.propertyId)
  const snapshotId = Number(req.params.snapshotId)
  if (!Number.isInteger(propertyId) || !Number.isInteger(snapshotId)) {
    return res.status(400).json({ error: 'Invalid property or snapshot ID' })
  }
  const property = selectProperty(propertyId)
  if (!property) return res.status(404).json({ error: 'Property not found' })
  const existing = stmtGet(
    'SELECT * FROM property_snapshots WHERE id = ? AND property_id = ?',
    [snapshotId, propertyId]
  )
  if (!existing) return res.status(404).json({ error: 'Snapshot not found' })
  const error = validateSnapshot(req.body, property.purchase_date)
  if (error) return res.status(400).json({ error })
  const conflict = stmtGet(
    'SELECT 1 FROM property_snapshots WHERE property_id = ? AND valuation_date = ? AND id != ?',
    [propertyId, req.body.valuation_date, snapshotId]
  )
  if (conflict) return res.status(409).json({ error: 'A valuation already exists for that date' })

  stmtRun(
    `UPDATE property_snapshots SET valuation_date = ?, estimated_value = ?, mortgage_balance = ?,
     source_label = ?, source_url = ?, note = ?, updated_at = datetime('now')
     WHERE id = ? AND property_id = ?`,
    [
      req.body.valuation_date, req.body.estimated_value, req.body.mortgage_balance,
      cleanOptional(req.body.source_label) || 'Manual', cleanOptional(req.body.source_url),
      cleanOptional(req.body.note), snapshotId, propertyId,
    ]
  )
  res.json(presentSnapshot(property, stmtGet('SELECT * FROM property_snapshots WHERE id = ?', [snapshotId])))
})

router.delete('/:propertyId/snapshots/:snapshotId', (req, res) => {
  const propertyId = Number(req.params.propertyId)
  const snapshotId = Number(req.params.snapshotId)
  if (!Number.isInteger(propertyId) || !Number.isInteger(snapshotId)) {
    return res.status(400).json({ error: 'Invalid property or snapshot ID' })
  }
  if (!selectProperty(propertyId)) return res.status(404).json({ error: 'Property not found' })
  const count = stmtGet('SELECT COUNT(*) AS value FROM property_snapshots WHERE property_id = ?', [propertyId])?.value || 0
  if (count <= 1) return res.status(400).json({ error: 'A property must keep at least one valuation' })
  const result = stmtRun(
    'DELETE FROM property_snapshots WHERE id = ? AND property_id = ?',
    [snapshotId, propertyId]
  )
  if (!result.changes) return res.status(404).json({ error: 'Snapshot not found' })
  res.json({ success: true })
})

export default router
