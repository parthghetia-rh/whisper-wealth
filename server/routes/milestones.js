import { Router } from 'express'
import { stmtAll } from '../db.js'
import { getLatestSnapshotUsd, getUpcoming } from '../services/milestones.js'
import { torontoDate } from '../services/marketDataService.js'

const router = Router()

router.get('/', (req, res) => {
  const achieved = stmtAll('SELECT * FROM milestones ORDER BY achieved_at DESC')

  const today = torontoDate()
  const latest = achieved.find((m) => m.achieved_at?.startsWith(today)) || null

  const snapshot = getLatestSnapshotUsd()

  const upcoming = snapshot
    ? getUpcoming(snapshot)
    : []

  res.json({ achieved, upcoming, latest })
})

export default router
