import { Router } from 'express'
import { stmtAll, stmtGet } from '../db.js'
import { getSettingBool } from './settings.js'

const router = Router()

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
  const rows = stmtAll(`
    SELECT d.*, q.name, q.currency
    FROM dividends d
    LEFT JOIN quotes q ON d.ticker = q.ticker
    ORDER BY d.ex_date DESC
  `)
  res.json(rows)
})

router.get('/income', (req, res) => {
  const transactions = stmtAll(
    'SELECT ticker, type, shares, price_per_share, date FROM transactions ORDER BY date'
  )

  const holdingsMap = {}
  for (const t of transactions) {
    if (!holdingsMap[t.ticker]) {
      holdingsMap[t.ticker] = { shares: 0 }
    }
    if (t.type === 'buy') {
      holdingsMap[t.ticker].shares += t.shares
    } else {
      holdingsMap[t.ticker].shares -= t.shares
    }
  }

  const byCurrency = {}

  for (const [ticker, h] of Object.entries(holdingsMap)) {
    if (h.shares <= 0) continue

    const quote = stmtGet('SELECT * FROM quotes WHERE ticker = ?', [ticker])
    const dividends = stmtAll(
      'SELECT * FROM dividends WHERE ticker = ? ORDER BY ex_date DESC',
      [ticker]
    )

    const annual_rate_per_share = getAnnualDividendPerShare(ticker)
    const annual_income = h.shares * annual_rate_per_share
    const current_price = quote?.price || 0
    const market_value = h.shares * current_price
    const effective_yield =
      market_value > 0 ? (annual_income / market_value) * 100 : 0
    const currency = quote?.currency || 'USD'

    if (!byCurrency[currency]) {
      byCurrency[currency] = { holdings: [], total_annual: 0 }
    }

    byCurrency[currency].total_annual += annual_income
    byCurrency[currency].holdings.push({
      ticker,
      name: quote?.name || ticker,
      currency,
      shares: h.shares,
      current_price,
      market_value: Math.round(market_value * 100) / 100,
      dividend_rate: Math.round(annual_rate_per_share * 10000) / 10000,
      dividend_yield: Math.round(effective_yield * 100) / 100,
      weekly_income: Math.round((annual_income / 52) * 100) / 100,
      monthly_income: Math.round((annual_income / 12) * 100) / 100,
      annual_income: Math.round(annual_income * 100) / 100,
      history: dividends.slice(0, 12),
    })
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
    if (annual_income <= 0) continue
    if (!byCurrency[c.currency]) {
      byCurrency[c.currency] = { holdings: [], total_annual: 0 }
    }
    byCurrency[c.currency].total_annual += annual_income
  }

  const currencies = Object.entries(byCurrency).map(([currency, data]) => ({
    currency,
    total_annual: Math.round(data.total_annual * 100) / 100,
    total_monthly: Math.round((data.total_annual / 12) * 100) / 100,
    total_weekly: Math.round((data.total_annual / 52) * 100) / 100,
    holdings: data.holdings,
  }))

  res.json({ currencies })
})

export default router
