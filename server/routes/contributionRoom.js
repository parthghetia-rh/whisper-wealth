import { Router } from 'express'
import { stmtAll, stmtGet, stmtRun, transaction, stmtRunBatch } from '../db.js'
import { ownerFields, readOwner, readScope, scopeWhere } from '../services/household.js'

const router = Router()
const ACCOUNT_TYPES = new Set(['TFSA', 'RRSP', 'FHSA', 'OTHER'])
const ENTRY_TYPES = new Set(['contribution', 'withdrawal', 'adjustment'])
const CURRENCY_RE = /^[A-Z]{3,5}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

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

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

function validateRoom(body) {
  const accountType = String(body.account_type || '').trim().toUpperCase()
  if (!ACCOUNT_TYPES.has(accountType)) return 'Account type must be TFSA, RRSP, FHSA, or Other'
  if (typeof body.label !== 'string' || !body.label.trim() || body.label.trim().length > 100) {
    return 'Label is required (max 100 characters)'
  }
  const year = Number(body.year)
  const currentYear = Number(torontoDate().slice(0, 4))
  if (!Number.isInteger(year) || year < 1990 || year > currentYear + 1) {
    return `Year must be between 1990 and ${currentYear + 1}`
  }
  const currency = String(body.currency || '').trim().toUpperCase()
  if (!CURRENCY_RE.test(currency)) return 'Invalid currency code'
  if (!Number.isFinite(body.opening_room) || body.opening_room < 0) {
    return 'Opening room must be a non-negative number'
  }
  if (body.note != null && (typeof body.note !== 'string' || body.note.trim().length > 500)) {
    return 'Note must be at most 500 characters'
  }
  return null
}

function validateEntry(body, roomYear) {
  const entryType = String(body.entry_type || '').trim().toLowerCase()
  if (!ENTRY_TYPES.has(entryType)) return 'Entry type is invalid'
  if (!Number.isFinite(body.amount) || body.amount === 0) return 'Amount must be a non-zero number'
  if (entryType !== 'adjustment' && body.amount < 0) return 'Contributions and withdrawals must be positive'
  if (!validDate(body.entry_date) || body.entry_date > torontoDate()) {
    return 'Date must be valid and not in the future'
  }
  if (Number(body.entry_date.slice(0, 4)) !== Number(roomYear)) {
    return `Date must be within the ${roomYear} tracking year`
  }
  if (body.note != null && (typeof body.note !== 'string' || body.note.trim().length > 500)) {
    return 'Note must be at most 500 characters'
  }
  return null
}

function readIndividualOwner(body, fallbackMemberId) {
  const owner = readOwner(body, fallbackMemberId)
  if (owner.type !== 'member') throw new Error('Contribution room must belong to one household member')
  return owner
}

function selectRoom(id) {
  return stmtGet(
    `SELECT r.*, m.name AS member_name, m.color AS member_color
     FROM contribution_rooms r JOIN household_members m ON m.id = r.member_id
     WHERE r.id = ?`,
    [id]
  )
}

function presentRoom(row) {
  const entries = stmtAll(
    `SELECT * FROM contribution_entries WHERE room_id = ?
     ORDER BY entry_date DESC, id DESC`,
    [row.id]
  )
  let contributed = 0
  let withdrawn = 0
  let adjustments = 0
  for (const entry of entries) {
    if (entry.entry_type === 'contribution') contributed += entry.amount
    if (entry.entry_type === 'withdrawal') withdrawn += entry.amount
    if (entry.entry_type === 'adjustment') adjustments += entry.amount
  }
  const available = row.opening_room + adjustments
  const remaining = available - contributed
  return {
    ...row,
    ...ownerFields(row),
    opening_room: roundMoney(row.opening_room),
    adjustments: roundMoney(adjustments),
    available_room: roundMoney(available),
    contributed: roundMoney(contributed),
    withdrawn: roundMoney(withdrawn),
    remaining: roundMoney(remaining),
    over_contribution: roundMoney(Math.max(0, -remaining)),
    used_percent: available > 0 ? Math.round((contributed / available) * 10000) / 100 : null,
    entries,
  }
}

function listRooms(scope) {
  const where = scopeWhere(scope, 'r.member_id')
  return stmtAll(
    `SELECT r.*, m.name AS member_name, m.color AS member_color
     FROM contribution_rooms r JOIN household_members m ON m.id = r.member_id
     WHERE ${where.sql} ORDER BY r.year DESC, r.account_type, r.id`,
    where.params
  ).map(presentRoom)
}

router.get('/', (req, res) => {
  let scope
  try { scope = readScope(req) } catch (err) { return res.status(400).json({ error: err.message }) }
  const items = scope.type === 'shared' ? [] : listRooms(scope)
  const totals = {}
  for (const room of items) {
    if (!totals[room.currency]) {
      totals[room.currency] = {
        currency: room.currency, available_room: 0, contributed: 0,
        withdrawn: 0, remaining: 0, over_contribution: 0,
      }
    }
    const total = totals[room.currency]
    for (const field of ['available_room', 'contributed', 'withdrawn', 'remaining', 'over_contribution']) {
      total[field] += room[field]
    }
  }
  for (const total of Object.values(totals)) {
    for (const field of ['available_room', 'contributed', 'withdrawn', 'remaining', 'over_contribution']) {
      total[field] = roundMoney(total[field])
    }
  }
  res.json({ scope: scope.key, items, totals_by_currency: Object.values(totals) })
})

router.post('/', (req, res) => {
  const error = validateRoom(req.body)
  if (error) return res.status(400).json({ error })
  let owner
  try { owner = readIndividualOwner(req.body) } catch (err) { return res.status(400).json({ error: err.message }) }
  try {
    const result = stmtRun(
      `INSERT INTO contribution_rooms
       (member_id, account_type, label, year, currency, opening_room, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        owner.memberId, req.body.account_type.trim().toUpperCase(), req.body.label.trim(),
        Number(req.body.year), req.body.currency.trim().toUpperCase(), req.body.opening_room,
        cleanOptional(req.body.note),
      ]
    )
    res.status(201).json(presentRoom(selectRoom(result.lastInsertRowid)))
  } catch (err) {
    if (/unique/i.test(err.message)) {
      return res.status(409).json({ error: 'This member already has that account type for the selected year' })
    }
    throw err
  }
})

router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = Number.isInteger(id) && selectRoom(id)
  if (!existing) return res.status(404).json({ error: 'Contribution room not found' })
  const error = validateRoom(req.body)
  if (error) return res.status(400).json({ error })
  const nextYear = Number(req.body.year)
  const hasActivity = stmtGet(
    'SELECT 1 FROM contribution_entries WHERE room_id = ? LIMIT 1', [id]
  )
  if (nextYear !== existing.year && hasActivity) {
    return res.status(400).json({ error: 'Tracking year cannot change after activity has been recorded' })
  }
  if (req.body.currency.trim().toUpperCase() !== existing.currency && hasActivity) {
    return res.status(400).json({ error: 'Currency cannot change after activity has been recorded' })
  }
  let owner
  try { owner = readIndividualOwner(req.body, existing.member_id) } catch (err) { return res.status(400).json({ error: err.message }) }
  try {
    stmtRun(
      `UPDATE contribution_rooms SET member_id = ?, account_type = ?, label = ?, year = ?,
       currency = ?, opening_room = ?, note = ?, updated_at = datetime('now') WHERE id = ?`,
      [
        owner.memberId, req.body.account_type.trim().toUpperCase(), req.body.label.trim(),
        nextYear, req.body.currency.trim().toUpperCase(), req.body.opening_room,
        cleanOptional(req.body.note), id,
      ]
    )
    res.json(presentRoom(selectRoom(id)))
  } catch (err) {
    if (/unique/i.test(err.message)) {
      return res.status(409).json({ error: 'This member already has that account type for the selected year' })
    }
    throw err
  }
})

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || !selectRoom(id)) return res.status(404).json({ error: 'Contribution room not found' })
  transaction(() => {
    stmtRunBatch('DELETE FROM contribution_entries WHERE room_id = ?', [id])
    stmtRunBatch('DELETE FROM contribution_rooms WHERE id = ?', [id])
  })
  res.json({ success: true })
})

router.post('/:id/entries', (req, res) => {
  const roomId = Number(req.params.id)
  const room = Number.isInteger(roomId) && selectRoom(roomId)
  if (!room) return res.status(404).json({ error: 'Contribution room not found' })
  const error = validateEntry(req.body, room.year)
  if (error) return res.status(400).json({ error })
  const result = stmtRun(
    `INSERT INTO contribution_entries (room_id, entry_type, amount, entry_date, note)
     VALUES (?, ?, ?, ?, ?)`,
    [roomId, req.body.entry_type.trim().toLowerCase(), req.body.amount, req.body.entry_date, cleanOptional(req.body.note)]
  )
  res.status(201).json(stmtGet('SELECT * FROM contribution_entries WHERE id = ?', [result.lastInsertRowid]))
})

router.put('/:roomId/entries/:entryId', (req, res) => {
  const roomId = Number(req.params.roomId)
  const entryId = Number(req.params.entryId)
  const room = Number.isInteger(roomId) && selectRoom(roomId)
  const existing = Number.isInteger(entryId) && stmtGet(
    'SELECT * FROM contribution_entries WHERE id = ? AND room_id = ?', [entryId, roomId]
  )
  if (!room || !existing) return res.status(404).json({ error: 'Contribution entry not found' })
  const error = validateEntry(req.body, room.year)
  if (error) return res.status(400).json({ error })
  stmtRun(
    `UPDATE contribution_entries SET entry_type = ?, amount = ?, entry_date = ?, note = ?,
     updated_at = datetime('now') WHERE id = ? AND room_id = ?`,
    [req.body.entry_type.trim().toLowerCase(), req.body.amount, req.body.entry_date, cleanOptional(req.body.note), entryId, roomId]
  )
  res.json(stmtGet('SELECT * FROM contribution_entries WHERE id = ?', [entryId]))
})

router.delete('/:roomId/entries/:entryId', (req, res) => {
  const roomId = Number(req.params.roomId)
  const entryId = Number(req.params.entryId)
  if (!Number.isInteger(roomId) || !Number.isInteger(entryId)) {
    return res.status(400).json({ error: 'Invalid contribution entry ID' })
  }
  const result = stmtRun(
    'DELETE FROM contribution_entries WHERE id = ? AND room_id = ?', [entryId, roomId]
  )
  if (!result.changes) return res.status(404).json({ error: 'Contribution entry not found' })
  res.json({ success: true })
})

export default router
