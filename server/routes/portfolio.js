import { Router } from 'express'
import { stmtAll, stmtGet } from '../db.js'
import { addSSEClient, triggerPoll, triggerQuickRefresh, getRates } from '../services/poller.js'
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
    const current_price = quote?.price || avg_cost
    const market_value = h.shares * current_price
    const gain_loss = market_value - h.total_cost
    const gain_loss_percent =
      h.total_cost > 0 ? (gain_loss / h.total_cost) * 100 : 0

    const annual_div_per_share = getAnnualDividendPerShare(h.ticker)
    const effective_yield =
      current_price > 0 ? (annual_div_per_share / current_price) * 100 : 0

    return {
      ticker: h.ticker,
      name: quote?.name || h.ticker,
      currency: quote?.currency || 'USD',
      shares: h.shares,
      avg_cost: Math.round(avg_cost * 100) / 100,
      current_price,
      market_value: Math.round(market_value * 100) / 100,
      total_cost: Math.round(h.total_cost * 100) / 100,
      gain_loss: Math.round(gain_loss * 100) / 100,
      gain_loss_percent: Math.round(gain_loss_percent * 100) / 100,
      change: quote?.change || 0,
      change_percent: quote?.change_percent || 0,
      dividend_rate: Math.round(annual_div_per_share * 10000) / 10000,
      dividend_yield: Math.round(effective_yield * 100) / 100,
    }
  })

  res.json(result)
})

router.get('/summary', (req, res) => {
  const holdings = getHoldings()

  const byCurrency = {}

  for (const h of holdings) {
    const quote = stmtGet('SELECT * FROM quotes WHERE ticker = ?', [h.ticker])
    const current_price =
      quote?.price || (h.shares > 0 ? h.total_cost / h.shares : 0)
    const market_value = h.shares * current_price
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

  res.json({ currencies })
})

router.get('/rates', (req, res) => {
  res.json({ base: 'USD', rates: getRates() })
})

router.post('/refresh', (req, res) => {
  triggerPoll()
  res.json({ success: true })
})

router.post('/quick-refresh', (req, res) => {
  triggerQuickRefresh()
  res.json({ success: true })
})

router.get('/sse', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.write('\n')
  addSSEClient(res)
})

export default router
