import { Router } from 'express'
import { stmtAll, stmtGet } from '../db.js'
import { getUpcoming } from '../services/milestones.js'

const router = Router()

router.get('/', (req, res) => {
  const achieved = stmtAll('SELECT * FROM milestones ORDER BY achieved_at DESC')

  const today = new Date().toISOString().split('T')[0]
  const latest = achieved.find((m) => m.achieved_at?.startsWith(today)) || null

  const snapshot = stmtGet(
    'SELECT * FROM portfolio_snapshots ORDER BY date DESC LIMIT 1'
  )

  const upcoming = snapshot
    ? getUpcoming(snapshot)
    : []

  res.json({ achieved, upcoming, latest })
})

export default router
