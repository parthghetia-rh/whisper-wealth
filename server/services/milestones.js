import { stmtAll, stmtGet, stmtRunBatch, save } from '../db.js'

const VALUE_THRESHOLDS = [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000]
const INCOME_THRESHOLDS = [100, 500, 1000, 5000, 10000, 25000]
const POSITION_THRESHOLDS = [1, 5, 10, 25, 50]
const GAIN_THRESHOLDS = [10, 25, 50, 100]
const STREAK_THRESHOLDS = [5, 10, 30]

function formatValue(v) {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`
  return `$${v}`
}

function isAchieved(id, scopeKey) {
  return !!stmtGet('SELECT 1 FROM milestones_v2 WHERE scope_key = ? AND id = ?', [scopeKey, id])
}

function achieve(scopeKey, id, category, title, description, icon, value) {
  if (isAchieved(id, scopeKey)) return null
  stmtRunBatch(
    `INSERT OR IGNORE INTO milestones_v2
      (scope_key, id, category, title, description, icon, achieved_at, value)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
    [scopeKey, id, category, title, description, icon, value]
  )
  return { scope_key: scopeKey, id, category, title, description, icon, value }
}

export function checkMilestones(snapshot, scopeKey = 'household') {
  const { total_value, total_cost, total_gain, annual_dividends, positions } = snapshot
  const newlyAchieved = []

  for (const t of VALUE_THRESHOLDS) {
    if (total_value < t) break
    const id = `value_${t}`
    const m = achieve(scopeKey, id, 'value', `Portfolio hit ${formatValue(t)}`,
      `Your total portfolio value crossed ${formatValue(t)}!`, 'chart', total_value)
    if (m) newlyAchieved.push(m)
  }

  for (const t of INCOME_THRESHOLDS) {
    const id = `income_${t}`
    if (annual_dividends >= t) {
      const m = achieve(scopeKey, id, 'income', `${formatValue(t)}/yr income`,
        `Your projected annual income hit ${formatValue(t)}!`, 'dollar', annual_dividends)
      if (m) newlyAchieved.push(m)
    }
  }

  for (const t of POSITION_THRESHOLDS) {
    const id = `positions_${t}`
    if (positions >= t) {
      const label = t === 1 ? 'First position' : `${t} positions`
      const m = achieve(scopeKey, id, 'holdings', label,
        t === 1 ? 'You added your first holding!' : `You now have ${t} positions in your portfolio!`, 'grid', positions)
      if (m) newlyAchieved.push(m)
    }
  }

  if (total_cost > 0) {
    const gainPct = (total_gain / total_cost) * 100
    for (const t of GAIN_THRESHOLDS) {
      const id = `gain_${t}pct`
      if (gainPct >= t) {
        const label = t === 100 ? 'Portfolio doubled!' : `${t}% gain`
        const m = achieve(scopeKey, id, 'growth', label,
          t === 100
            ? 'Your portfolio doubled from your cost basis!'
            : `Your portfolio is up ${t}% from your cost basis!`, 'rocket', gainPct)
        if (m) newlyAchieved.push(m)
      }
    }
  }

  const snapshots = stmtAll(
    `SELECT s.date,
       SUM((s.total_value - s.total_cost) * COALESCE(r.usd_rate, 0)) AS total_gain
     FROM portfolio_snapshots_v3 s
     LEFT JOIN snapshot_fx_rates r ON r.date = s.date AND r.currency = s.currency
     WHERE s.scope_key = ?
     GROUP BY s.date ORDER BY s.date DESC LIMIT 31`,
    [scopeKey]
  )
  if (snapshots.length >= 2) {
    let streak = 0
    for (let i = 0; i < snapshots.length - 1; i++) {
      if (snapshots[i].total_gain > snapshots[i + 1].total_gain) {
        streak++
      } else {
        break
      }
    }
    for (const t of STREAK_THRESHOLDS) {
      const id = `streak_${t}`
      if (streak >= t) {
        const m = achieve(scopeKey, id, 'streak', `${t}-day winning streak`,
          `Your portfolio gained value ${t} days in a row!`, 'flame', streak)
        if (m) newlyAchieved.push(m)
      }
    }
  }

  if (newlyAchieved.length) save()
  return newlyAchieved
}

export function getLatestSnapshotUsd(scopeKey = 'household') {
  return stmtGet(`
    SELECT s.date,
      SUM(s.total_value * COALESCE(r.usd_rate, 0)) AS total_value,
      SUM(s.total_cost * COALESCE(r.usd_rate, 0)) AS total_cost,
      SUM((s.total_value - s.total_cost) * COALESCE(r.usd_rate, 0)) AS total_gain,
      SUM(s.annual_dividends * COALESCE(r.usd_rate, 0)) AS annual_dividends,
      SUM(s.positions) AS positions
    FROM portfolio_snapshots_v3 s
    LEFT JOIN snapshot_fx_rates r ON r.date = s.date AND r.currency = s.currency
    WHERE s.scope_key = ?
      AND s.date = (SELECT MAX(date) FROM portfolio_snapshots_v3 WHERE scope_key = ?)
    GROUP BY s.date
  `, [scopeKey, scopeKey])
}

export function getUpcoming(snapshot) {
  const { total_value, total_cost, total_gain, annual_dividends, positions } = snapshot
  const upcoming = []

  for (const t of VALUE_THRESHOLDS) {
    if (total_value < t) {
      const progress = total_value / t
      upcoming.push({
        id: `value_${t}`, category: 'value', title: `Portfolio ${formatValue(t)}`,
        target: t, current: total_value, progress: Math.min(progress, 0.99), icon: 'chart',
      })
      break
    }
  }

  for (const t of INCOME_THRESHOLDS) {
    if (annual_dividends < t) {
      const progress = annual_dividends / t
      upcoming.push({
        id: `income_${t}`, category: 'income', title: `${formatValue(t)}/yr income`,
        target: t, current: annual_dividends, progress: Math.min(progress, 0.99), icon: 'dollar',
      })
      break
    }
  }

  for (const t of GAIN_THRESHOLDS) {
    const gainPct = total_cost > 0 ? (total_gain / total_cost) * 100 : 0
    if (gainPct < t) {
      upcoming.push({
        id: `gain_${t}pct`, category: 'growth', title: t === 100 ? 'Double your money' : `${t}% gain`,
        target: t, current: gainPct, progress: Math.min(gainPct / t, 0.99), icon: 'rocket',
      })
      break
    }
  }

  return upcoming
}
