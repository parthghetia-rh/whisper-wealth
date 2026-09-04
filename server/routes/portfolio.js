import { Router } from 'express'
import { stmtAll, stmtGet } from '../db.js'
import {
  addSSEClient, triggerPoll, triggerQuickRefresh, getRates,
} from '../services/poller.js'
import { torontoDate } from '../services/marketDataService.js'
import { getSettingBool } from './settings.js'
import { ownedRows, ownerFields, readScope, scopeWhere } from '../services/household.js'

const router = Router()

function getHoldings(scope) {
  const where = scopeWhere(scope, 't.member_id')
  const transactions = stmtAll(
    `SELECT t.*, m.name AS member_name, m.color AS member_color
     FROM transactions t LEFT JOIN household_members m ON m.id = t.member_id
     WHERE ${where.sql} ORDER BY t.date, t.id`,
    where.params
  )

  const ownerHoldings = {}
  for (const t of transactions) {
    const owner = ownerFields(t)
    const key = `${owner.owner_scope}:${t.ticker}`
    if (!ownerHoldings[key]) {
      ownerHoldings[key] = { ticker: t.ticker, shares: 0, total_cost: 0, ...owner }
    }
    const h = ownerHoldings[key]
    if (t.type === 'buy') {
      h.total_cost += t.shares * t.price_per_share
      h.shares += t.shares
    } else {
      const avg_cost = h.shares > 0 ? h.total_cost / h.shares : 0
      h.shares -= t.shares
      h.total_cost = h.shares * avg_cost
    }
  }

  const combined = {}
  for (const holding of Object.values(ownerHoldings).filter((h) => h.shares > 0)) {
    if (!combined[holding.ticker]) {
      combined[holding.ticker] = { ticker: holding.ticker, shares: 0, total_cost: 0, owners: [] }
    }
    combined[holding.ticker].shares += holding.shares
    combined[holding.ticker].total_cost += holding.total_cost
    combined[holding.ticker].owners.push({
      owner_scope: holding.owner_scope,
      owner_name: holding.owner_name,
      owner_color: holding.owner_color,
      shares: Math.round(holding.shares * 10000) / 10000,
      total_cost: Math.round(holding.total_cost * 100) / 100,
    })
  }
  return Object.values(combined)
}

function getAnnualDividendPerShare(ticker) {
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const cutoff = oneYearAgo.toISOString().split('T')[0]

  const rows = stmtAll(
    'SELECT amount FROM dividends WHERE ticker = ? AND ex_date >= ? ORDER BY ex_date DESC',
    [ticker, cutoff]
  )

  return rows.reduce((sum, r) => sum + r.amount, 0)
}

function portfolioTotalsByCurrency(scope) {
  const holdings = getHoldings(scope)
  const byCurrency = {}
  let unpricedPositions = 0

  for (const holding of holdings) {
    const quote = stmtGet('SELECT * FROM quotes WHERE ticker = ?', [holding.ticker])
    const currentPrice = quote?.price ?? null
    const marketValue = currentPrice == null ? 0 : holding.shares * currentPrice
    const annualDividend = holding.shares * getAnnualDividendPerShare(holding.ticker)
    const currency = quote?.currency || 'USD'

    if (currentPrice == null) unpricedPositions++
    if (!byCurrency[currency]) {
      byCurrency[currency] = {
        total_value: 0,
        total_cost: 0,
        annual_dividends: 0,
        positions: 0,
      }
    }

    byCurrency[currency].total_value += marketValue
    byCurrency[currency].total_cost += holding.total_cost
    byCurrency[currency].annual_dividends += annualDividend
    byCurrency[currency].positions++
  }

  for (const cash of ownedRows('cash_positions', scope)) {
    const type = cash.type || 'cash'
    const currency = cash.currency || 'USD'
    if (!byCurrency[currency]) {
      byCurrency[currency] = {
        total_value: 0,
        total_cost: 0,
        annual_dividends: 0,
        positions: 0,
      }
    }

    if (type === 'income') {
      const frequency = cash.frequency || 'yearly'
      byCurrency[currency].annual_dividends += frequency === 'weekly'
        ? cash.amount * 52
        : frequency === 'monthly' ? cash.amount * 12 : cash.amount
      continue
    }

    const compound = getSettingBool('cash_interest_compound')
    byCurrency[currency].total_value += cash.amount
    byCurrency[currency].total_cost += cash.amount
    byCurrency[currency].annual_dividends += compound
      ? cash.amount * Math.pow(1 + cash.interest_rate / 100 / 12, 12) - cash.amount
      : cash.amount * (cash.interest_rate / 100)
  }

  return { byCurrency, unpricedPositions }
}

router.get('/', (req, res) => {
  let scope
  try { scope = readScope(req) } catch (err) { return res.status(400).json({ error: err.message }) }
  const holdings = getHoldings(scope)

  const result = holdings.map((h) => {
    const quote = stmtGet('SELECT * FROM quotes WHERE ticker = ?', [h.ticker])
    const avg_cost = h.shares > 0 ? h.total_cost / h.shares : 0
    const current_price = quote?.price ?? null
    const market_value = current_price == null ? null : h.shares * current_price
    const gain_loss = market_value == null ? null : market_value - h.total_cost
    const gain_loss_percent =
      gain_loss != null && h.total_cost > 0 ? (gain_loss / h.total_cost) * 100 : null

    const annual_div_per_share = getAnnualDividendPerShare(h.ticker)
    const effective_yield =
      current_price > 0 ? (annual_div_per_share / current_price) * 100 : 0

    return {
      ticker: h.ticker,
      name: quote?.name || h.ticker,
      currency: quote?.currency || 'USD',
      shares: Math.round(h.shares * 10000) / 10000,
      avg_cost: Math.round(avg_cost * 100) / 100,
      current_price,
      market_value: market_value == null ? null : Math.round(market_value * 100) / 100,
      total_cost: Math.round(h.total_cost * 100) / 100,
      gain_loss: gain_loss == null ? null : Math.round(gain_loss * 100) / 100,
      gain_loss_percent: gain_loss_percent == null ? null : Math.round(gain_loss_percent * 100) / 100,
      change: quote?.change || 0,
      change_percent: quote?.change_percent || 0,
      dividend_rate: Math.round(annual_div_per_share * 10000) / 10000,
      dividend_yield: Math.round(effective_yield * 100) / 100,
      quote_status: quote?.status || 'unavailable',
      quote_as_of: quote?.last_success_at || null,
      market_state: quote?.market_state || null,
      price_source: quote?.price_source || null,
      regular_market_price: quote?.regular_market_price ?? null,
      pre_market_price: quote?.pre_market_price ?? null,
      post_market_price: quote?.post_market_price ?? null,
      last_error: quote?.last_error || null,
      owners: scope.type === 'household' ? h.owners : undefined,
    }
  })

  res.json(result)
})

router.get('/summary', (req, res) => {
  let scope
  try { scope = readScope(req) } catch (err) { return res.status(400).json({ error: err.message }) }
  const { byCurrency, unpricedPositions } = portfolioTotalsByCurrency(scope)

  const currencies = Object.entries(byCurrency).map(([currency, data]) => {
    const total_gain = data.total_value - data.total_cost
    const total_gain_percent =
      data.total_cost > 0 ? (total_gain / data.total_cost) * 100 : 0
    const portfolio_yield =
      data.total_value > 0
        ? (data.annual_dividends / data.total_value) * 100
        : 0

    return {
      currency,
      total_value: Math.round(data.total_value * 100) / 100,
      total_cost: Math.round(data.total_cost * 100) / 100,
      total_gain: Math.round(total_gain * 100) / 100,
      total_gain_percent: Math.round(total_gain_percent * 100) / 100,
      annual_dividends: Math.round(data.annual_dividends * 100) / 100,
      monthly_dividends:
        Math.round((data.annual_dividends / 12) * 100) / 100,
      weekly_dividends:
        Math.round((data.annual_dividends / 52) * 100) / 100,
      portfolio_yield: Math.round(portfolio_yield * 100) / 100,
      positions: data.positions,
    }
  })

  res.json({ scope: scope.key, currencies, unpriced_positions: unpricedPositions })
})

function requestedCurrency(req) {
  const currency = String(req.query.currency || 'USD').trim().toUpperCase()
  return /^[A-Z]{3,5}$/.test(currency) ? currency : 'USD'
}

function convert(amount, from, to, rates) {
  if (from === to) return amount
  if (!rates[from] || !rates[to]) return null
  return (amount * rates[from]) / rates[to]
}

function aggregateCurrencyRows(rows, currency, rates, date) {
  if (!rows.length) return null
  const result = { total_value: 0, total_cost: 0, positions: 0 }
  for (const row of rows) {
    const value = convert(row.total_value, row.currency, currency, rates)
    const cost = convert(row.total_cost, row.currency, currency, rates)
    // A partial total creates a false dip in the chart. Exclude the whole point
    // until every currency in that snapshot can be converted.
    if (value == null || cost == null) return null
    result.total_value += value
    result.total_cost += cost
    result.positions += row.positions
  }
  return { ...result, date, total_gain: result.total_value - result.total_cost }
}

function convertedSnapshot(date, currency, scopeKey) {
  if (!date) return null
  const rows = stmtAll(
    'SELECT * FROM portfolio_snapshots_v3 WHERE date = ? AND scope_key = ?',
    [date, scopeKey]
  )
  if (!rows.length) return null
  const rates = { USD: 1 }
  for (const row of stmtAll('SELECT currency, usd_rate FROM snapshot_fx_rates WHERE date = ?', [date])) {
    rates[row.currency] = row.usd_rate
  }
  return aggregateCurrencyRows(rows, currency, rates, date)
}

function currentPortfolioSnapshot(scope, currency) {
  const { byCurrency } = portfolioTotalsByCurrency(scope)
  const rows = Object.entries(byCurrency).map(([rowCurrency, totals]) => ({
    currency: rowCurrency,
    ...totals,
    // Match the per-currency precision returned by /summary so the chart's
    // current point and the dashboard card display the exact same total.
    total_value: Math.round(totals.total_value * 100) / 100,
    total_cost: Math.round(totals.total_cost * 100) / 100,
  }))
  return aggregateCurrencyRows(rows, currency, getRates(), torontoDate())
}

function snapshotDateAtOrBefore(date, scopeKey) {
  return stmtGet(
    `SELECT DISTINCT date FROM portfolio_snapshots_v3
     WHERE date <= ? AND scope_key = ? ORDER BY date DESC LIMIT 1`,
    [date, scopeKey]
  )?.date || null
}

function calcChange(current, reference) {
  if (!current || !reference || reference.total_value <= 0) return null
  const diff = current.total_value - reference.total_value
  return {
    value: Math.round(diff * 100) / 100,
    percent: Math.round((diff / reference.total_value) * 10000) / 100,
  }
}

router.get('/snapshot', (req, res) => {
  let scope
  try { scope = readScope(req) } catch (err) { return res.status(400).json({ error: err.message }) }
  const currency = requestedCurrency(req)
  const today = torontoDate()
  const yesterday = torontoDate(new Date(Date.now() - 86400000))
  const weekAgo = torontoDate(new Date(Date.now() - 7 * 86400000))
  const monthAgo = torontoDate(new Date(Date.now() - 30 * 86400000))
  const todaySnap = currentPortfolioSnapshot(scope, currency)
    || convertedSnapshot(snapshotDateAtOrBefore(today, scope.key), currency, scope.key)
  const yesterdaySnap = convertedSnapshot(snapshotDateAtOrBefore(yesterday, scope.key), currency, scope.key)
  const weekSnap = convertedSnapshot(snapshotDateAtOrBefore(weekAgo, scope.key), currency, scope.key)
  const monthSnap = convertedSnapshot(snapshotDateAtOrBefore(monthAgo, scope.key), currency, scope.key)
  const rates = getRates()

  const holdings = getHoldings(scope)
  let topMover = null
  let worstMover = null
  let dayGain = 0
  for (const h of holdings) {
    const quote = stmtGet('SELECT * FROM quotes WHERE ticker = ?', [h.ticker])
    if (!quote) continue
    const pct = quote.change_percent || 0
    const convertedChange = convert(h.shares * (quote.change || 0), quote.currency || 'USD', currency, rates)
    dayGain += convertedChange || 0
    if (!topMover || pct > topMover.change_percent) {
      topMover = { ticker: h.ticker, name: quote.name, change_percent: pct, change: quote.change || 0 }
    }
    if (!worstMover || pct < worstMover.change_percent) {
      worstMover = { ticker: h.ticker, name: quote.name, change_percent: pct, change: quote.change || 0 }
    }
  }

  const totalValue = todaySnap?.total_value || 0
  const dayGainPct = totalValue > 0 ? Math.round((dayGain / (totalValue - dayGain)) * 10000) / 100 : 0

  res.json({
    scope: scope.key,
    currency,
    as_of: stmtGet('SELECT MAX(last_success_at) AS value FROM quotes')?.value || null,
    today: todaySnap,
    day: {
      value: Math.round(dayGain * 100) / 100,
      percent: dayGainPct,
    },
    week: calcChange(todaySnap, weekSnap),
    month: calcChange(todaySnap, monthSnap),
    previous_day: calcChange(todaySnap, yesterdaySnap),
    total: todaySnap ? {
      value: Math.round(todaySnap.total_gain * 100) / 100,
      percent: todaySnap.total_cost > 0
        ? Math.round((todaySnap.total_gain / todaySnap.total_cost) * 10000) / 100
        : 0,
    } : null,
    topMover,
    worstMover,
  })
})

router.get('/history', (req, res) => {
  let scope
  try { scope = readScope(req) } catch (err) { return res.status(400).json({ error: err.message }) }
  const currency = requestedCurrency(req)
  const range = ['1m', '3m', '6m', '1y'].includes(req.query.range) ? req.query.range : '1y'
  const months = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 }[range] || 12
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  const cutoffStr = torontoDate(cutoff)

  const dates = stmtAll(
    `SELECT DISTINCT date FROM portfolio_snapshots_v3
     WHERE date >= ? AND scope_key = ? ORDER BY date ASC`,
    [cutoffStr, scope.key]
  )

  try {
    const stored = dates.map(({ date }) => convertedSnapshot(date, currency, scope.key))
    const excludedIncomplete = stored.filter((snapshot) => !snapshot).length
    const snapshots = stored.filter(Boolean)
    const current = currentPortfolioSnapshot(scope, currency)
    if (current) {
      const todayIndex = snapshots.findIndex((snapshot) => snapshot.date === current.date)
      if (todayIndex >= 0) snapshots[todayIndex] = current
      else snapshots.push(current)
    }

    const data = snapshots
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((snapshot) => ({
        date: snapshot.date,
        value: Math.round(snapshot.total_value * 100) / 100,
        cost: Math.round(snapshot.total_cost * 100) / 100,
        gain: Math.round(snapshot.total_gain * 100) / 100,
        source: snapshot.date === current?.date ? 'live' : 'snapshot',
      }))

    res.json({
      data,
      range,
      currency,
      scope: scope.key,
      as_of: stmtGet('SELECT MAX(last_success_at) AS value FROM quotes')?.value || null,
      excluded_incomplete: excludedIncomplete,
      legacy_archived: true,
    })
  } catch (err) {
    console.error('Portfolio history failed:', err.message)
    res.status(500).json({ error: 'Failed to load portfolio history' })
  }
})

router.get('/rates', (req, res) => {
  res.json({ base: 'USD', rates: getRates() })
})

router.post('/refresh', async (req, res, next) => {
  try { res.json(await triggerPoll()) } catch (err) { next(err) }
})

router.post('/quick-refresh', async (req, res, next) => {
  try { res.json(await triggerQuickRefresh()) } catch (err) { next(err) }
})

router.get('/sse', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  if (!addSSEClient(res)) res.end()
})

export default router
