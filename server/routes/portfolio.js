import { Router } from 'express'
import { stmtAll, stmtGet } from '../db.js'
import {
  addSSEClient, triggerPoll, triggerQuickRefresh, getRates,
} from '../services/poller.js'
import { torontoDate } from '../services/marketDataService.js'
import { getSettingBool } from './settings.js'

const router = Router()

function getHoldings() {
  const transactions = stmtAll(
    'SELECT ticker, type, shares, price_per_share FROM transactions'
  )

  const holdingsMap = {}
  for (const t of transactions) {
    if (!holdingsMap[t.ticker]) {
      holdingsMap[t.ticker] = { ticker: t.ticker, shares: 0, total_cost: 0 }
    }
    const h = holdingsMap[t.ticker]
    if (t.type === 'buy') {
      h.total_cost += t.shares * t.price_per_share
      h.shares += t.shares
    } else {
      const avg_cost = h.shares > 0 ? h.total_cost / h.shares : 0
      h.shares -= t.shares
      h.total_cost = h.shares * avg_cost
    }
  }

  return Object.values(holdingsMap).filter((h) => h.shares > 0)
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

router.get('/', (req, res) => {
  const holdings = getHoldings()

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
    }
  })

  res.json(result)
})

router.get('/summary', (req, res) => {
  const holdings = getHoldings()
  let unpricedPositions = 0

  const byCurrency = {}

  for (const h of holdings) {
    const quote = stmtGet('SELECT * FROM quotes WHERE ticker = ?', [h.ticker])
    const current_price = quote?.price ?? null
    const market_value = current_price == null ? 0 : h.shares * current_price
    if (current_price == null) unpricedPositions++
    const annual_div_per_share = getAnnualDividendPerShare(h.ticker)
    const annual_div = h.shares * annual_div_per_share
    const currency = quote?.currency || 'USD'

    if (!byCurrency[currency]) {
      byCurrency[currency] = {
        total_value: 0,
        total_cost: 0,
        annual_dividends: 0,
        positions: 0,
      }
    }

    byCurrency[currency].total_value += market_value
    byCurrency[currency].total_cost += h.total_cost
    byCurrency[currency].annual_dividends += annual_div
    byCurrency[currency].positions += 1
  }

  const cashRows = stmtAll('SELECT * FROM cash_positions')
  for (const c of cashRows) {
    const type = c.type || 'cash'
    let annual_income
    if (type === 'income') {
      const freq = c.frequency || 'yearly'
      annual_income = freq === 'weekly' ? c.amount * 52 : freq === 'monthly' ? c.amount * 12 : c.amount
    } else {
      const compound = getSettingBool('cash_interest_compound')
      annual_income = compound
        ? c.amount * Math.pow(1 + c.interest_rate / 100 / 12, 12) - c.amount
        : c.amount * (c.interest_rate / 100)
    }
    const currency = c.currency
    if (!byCurrency[currency]) {
      byCurrency[currency] = {
        total_value: 0,
        total_cost: 0,
        annual_dividends: 0,
        positions: 0,
      }
    }
    if (type === 'cash') {
      byCurrency[currency].total_value += c.amount
      byCurrency[currency].total_cost += c.amount
    }
    byCurrency[currency].annual_dividends += annual_income
  }

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

  res.json({ currencies, unpriced_positions: unpricedPositions })
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

function convertedSnapshot(date, currency) {
  if (!date) return null
  const rows = stmtAll('SELECT * FROM portfolio_snapshots_v2 WHERE date = ?', [date])
  if (!rows.length) return null
  const rates = { USD: 1 }
  for (const row of stmtAll('SELECT currency, usd_rate FROM snapshot_fx_rates WHERE date = ?', [date])) {
    rates[row.currency] = row.usd_rate
  }
  if (!rates[currency]) return null
  const result = rows.reduce((total, row) => {
    const value = convert(row.total_value, row.currency, currency, rates)
    const cost = convert(row.total_cost, row.currency, currency, rates)
    if (value != null) total.total_value += value
    if (cost != null) total.total_cost += cost
    total.positions += row.positions
    return total
  }, { total_value: 0, total_cost: 0, positions: 0 })
  return { ...result, date, total_gain: result.total_value - result.total_cost }
}

function snapshotDateAtOrBefore(date) {
  return stmtGet(
    'SELECT DISTINCT date FROM portfolio_snapshots_v2 WHERE date <= ? ORDER BY date DESC LIMIT 1',
    [date]
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
  const currency = requestedCurrency(req)
  const today = torontoDate()
  const yesterday = torontoDate(new Date(Date.now() - 86400000))
  const weekAgo = torontoDate(new Date(Date.now() - 7 * 86400000))
  const monthAgo = torontoDate(new Date(Date.now() - 30 * 86400000))
  const todaySnap = convertedSnapshot(snapshotDateAtOrBefore(today), currency)
  const yesterdaySnap = convertedSnapshot(snapshotDateAtOrBefore(yesterday), currency)
  const weekSnap = convertedSnapshot(snapshotDateAtOrBefore(weekAgo), currency)
  const monthSnap = convertedSnapshot(snapshotDateAtOrBefore(monthAgo), currency)
  const rates = getRates()

  const holdings = getHoldings()
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
  const currency = requestedCurrency(req)
  const range = ['1m', '3m', '6m', '1y'].includes(req.query.range) ? req.query.range : '1y'
  const months = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 }[range] || 12
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  const cutoffStr = torontoDate(cutoff)

  const dates = stmtAll(
    'SELECT DISTINCT date FROM portfolio_snapshots_v2 WHERE date >= ? ORDER BY date ASC',
    [cutoffStr]
  )

  if (!dates.length) {
    return res.json({ data: [], range, currency, legacy_archived: true })
  }

  try {
    const data = dates.map(({ date }) => convertedSnapshot(date, currency))
      .filter(Boolean)
      .map((snapshot) => ({
        date: snapshot.date,
        value: Math.round(snapshot.total_value * 100) / 100,
        cost: Math.round(snapshot.total_cost * 100) / 100,
        gain: Math.round(snapshot.total_gain * 100) / 100,
      }))

    res.json({ data, range, currency, legacy_archived: true })
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
