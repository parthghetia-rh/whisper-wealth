import { Router } from 'express'
import { stmtAll, stmtGet, stmtRun } from '../db.js'

const router = Router()
const COLOR_RE = /^#[0-9a-f]{6}$/i

function validate(body) {
  if (!body.name || typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 50) {
    return 'Name is required (max 50 characters)'
  }
  if (body.color != null && !COLOR_RE.test(body.color)) return 'Color must be a six-digit hex value'
  return null
}

function memberResponse(row) {
  return { ...row, scope: `member:${row.id}`, archived: Boolean(row.archived_at), is_primary: Boolean(row.is_primary) }
}

router.get('/members', (req, res) => {
  const includeArchived = req.query.include_archived === 'true'
  const rows = stmtAll(
    `SELECT * FROM household_members ${includeArchived ? '' : 'WHERE archived_at IS NULL'}
     ORDER BY is_primary DESC, name COLLATE NOCASE`
  )
  res.json({
    members: rows.map(memberResponse),
    shared: { scope: 'shared', name: 'Shared', color: '#94a3b8' },
    primary_member_id: stmtGet('SELECT id FROM household_members WHERE is_primary = 1')?.id || null,
  })
})

router.post('/members', (req, res) => {
  const error = validate(req.body)
  if (error) return res.status(400).json({ error })
  try {
    const result = stmtRun(
      'INSERT INTO household_members (name, color) VALUES (?, ?)',
      [req.body.name.trim(), req.body.color || '#6366f1']
    )
    res.status(201).json(memberResponse(stmtGet('SELECT * FROM household_members WHERE id = ?', [result.lastInsertRowid])))
  } catch (err) {
    if (/unique/i.test(err.message)) return res.status(409).json({ error: 'A member with that name already exists' })
    throw err
  }
})

router.put('/members/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = Number.isInteger(id) && stmtGet('SELECT * FROM household_members WHERE id = ?', [id])
  if (!existing) return res.status(404).json({ error: 'Household member not found' })
  const next = {
    name: req.body.name ?? existing.name,
    color: req.body.color ?? existing.color,
  }
  const error = validate(next)
  if (error) return res.status(400).json({ error })
  const archivedAt = req.body.archived === false ? null : existing.archived_at
  try {
    stmtRun(
      'UPDATE household_members SET name = ?, color = ?, archived_at = ? WHERE id = ?',
      [next.name.trim(), next.color, archivedAt, id]
    )
    res.json(memberResponse(stmtGet('SELECT * FROM household_members WHERE id = ?', [id])))
  } catch (err) {
    if (/unique/i.test(err.message)) return res.status(409).json({ error: 'A member with that name already exists' })
    throw err
  }
})

router.delete('/members/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = Number.isInteger(id) && stmtGet('SELECT * FROM household_members WHERE id = ?', [id])
  if (!existing) return res.status(404).json({ error: 'Household member not found' })
  if (existing.is_primary) return res.status(400).json({ error: 'The Primary member cannot be archived' })
  stmtRun("UPDATE household_members SET archived_at = datetime('now') WHERE id = ?", [id])
  res.json(memberResponse(stmtGet('SELECT * FROM household_members WHERE id = ?', [id])))
})

export default router
