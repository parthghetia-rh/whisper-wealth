import { Router } from 'express'
import { stmtAll, stmtRun } from '../db.js'

const router = Router()

const DEFAULTS = {
  drip_enabled: 'false',
  fractional_shares: 'true',
  cash_interest_compound: 'false',
}

export function getSetting(key) {
  const row = stmtAll('SELECT value FROM settings WHERE key = ?', [key])
  return row.length ? row[0].value : (DEFAULTS[key] || null)
}

export function getSettingBool(key) {
  return getSetting(key) === 'true'
}

router.get('/', (req, res) => {
  const rows = stmtAll('SELECT * FROM settings')
  const settings = { ...DEFAULTS }
  for (const r of rows) {
    settings[r.key] = r.value
  }
  res.json(settings)
})

router.put('/', (req, res) => {
  const allowed = Object.keys(DEFAULTS)
  const updates = req.body

  for (const [key, value] of Object.entries(updates)) {
    if (!allowed.includes(key)) continue
    const strVal = value === true || value === 'true' ? 'true' : 'false'
    stmtRun(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
      [key, strVal, strVal]
    )
  }

  const rows = stmtAll('SELECT * FROM settings')
  const settings = { ...DEFAULTS }
  for (const r of rows) {
    settings[r.key] = r.value
  }
  res.json(settings)
})

export default router
