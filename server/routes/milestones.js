import { Router } from 'express'
import { stmtAll } from '../db.js'
import { getLatestSnapshotUsd, getUpcoming } from '../services/milestones.js'
import { torontoDate } from '../services/marketDataService.js'
import { readScope } from '../services/household.js'

const router = Router()

router.get('/', (req, res) => {
  let scope
  try { scope = readScope(req) } catch (err) { return res.status(400).json({ error: err.message }) }
  const achieved = stmtAll(
    'SELECT * FROM milestones_v2 WHERE scope_key = ? ORDER BY achieved_at DESC',
    [scope.key]
  )

  const today = torontoDate()
  const latest = achieved.find((m) => m.achieved_at?.startsWith(today)) || null

  const snapshot = getLatestSnapshotUsd(scope.key)

  const upcoming = snapshot
    ? getUpcoming(snapshot)
    : []

  res.json({ scope: scope.key, achieved, upcoming, latest })
})

export default router
