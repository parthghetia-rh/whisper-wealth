import {
  stmtAll, stmtGet, stmtRun, stmtRunBatch, transaction, createBackup,
} from '../db.js'
import {
  getQuotes, getDividendHistory, getPeriodChanges, getProviderMetrics,
} from './stockService.js'
import { checkMilestones } from './milestones.js'
import { listSnapshotScopes, scopeWhere } from './household.js'

const ACTIVE_REGULAR_INTERVAL = Number(process.env.QUOTE_ACTIVE_INTERVAL_MS) || 60_000
const IDLE_REGULAR_INTERVAL = Number(process.env.QUOTE_IDLE_INTERVAL_MS) || 5 * 60_000
const EXTENDED_INTERVAL = Number(process.env.QUOTE_EXTENDED_INTERVAL_MS) || 5 * 60_000
const CLOSED_INTERVAL = Number(process.env.QUOTE_CLOSED_INTERVAL_MS) || 30 * 60_000
const MANUAL_FRESHNESS_FLOOR = 30_000
const MAX_SSE_CLIENTS = 20

const sseClients = new Set()
let refreshInFlight = null
let enrichmentInFlight = null
let pollTimer = null
let heartbeatTimer = null
let backupTimer = null
let shuttingDown = false
let lastRefreshAt = 0
let lastProviderSuccessAt = null
let lastRefreshDurationMs = null
let trackedSymbolCount = 0
let lastSymbolKey = ''
let lastResult = { updated: 0, stale: 0, failed: 0, as_of: null }

export function torontoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function getTrackedTickers() {
  return [...new Set([
    ...stmtAll('SELECT DISTINCT ticker FROM transactions').map((row) => row.ticker),
    ...stmtAll('SELECT DISTINCT ticker FROM watchlist').map((row) => row.ticker),
  ].map((ticker) => ticker?.trim().toUpperCase()).filter(Boolean))]
}

function getTrackedCurrencies() {
  return [...new Set([
    'USD',
    ...stmtAll('SELECT DISTINCT currency FROM quotes').map((row) => row.currency),
    ...stmtAll('SELECT DISTINCT currency FROM cash_positions').map((row) => row.currency),
  ].map((currency) => currency?.trim().toUpperCase()).filter(Boolean))]
}

function getFxPairs(currencies) {
  return new Map(currencies.filter((currency) => currency !== 'USD').map((currency) => [
    `${currency}USD=X`, currency,
  ]))
}

function quoteValues(q, now) {
  return [
    q.ticker, q.provider_symbol, q.name, q.currency, q.price, q.regular_market_price,
    q.previous_close, q.change, q.change_percent, q.market_cap, q.dividend_rate,
    q.dividend_yield, q.pre_market_price, q.pre_market_change,
    q.pre_market_change_percent, q.post_market_price, q.post_market_change,
    q.post_market_change_percent, q.market_state, q.price_source, q.day_high, q.day_low,
    q.fifty_two_week_high, q.fifty_two_week_low, q.volume, q.avg_volume,
    q.analyst_rating, q.provider_updated_at, now, now, 'fresh', null,
  ]
}

const QUOTE_UPSERT = `
  INSERT INTO quotes (
    ticker, provider_symbol, name, currency, price, regular_market_price,
    previous_close, change, change_percent, market_cap, dividend_rate, dividend_yield,
    pre_market_price, pre_market_change, pre_market_change_percent,
    post_market_price, post_market_change, post_market_change_percent,
    market_state, price_source, day_high, day_low, fifty_two_week_high,
    fifty_two_week_low, volume, avg_volume, analyst_rating, provider_updated_at,
    updated_at, last_success_at, status, last_error
  ) VALUES (${Array(32).fill('?').join(', ')})
  ON CONFLICT(ticker) DO UPDATE SET
    provider_symbol=excluded.provider_symbol, name=excluded.name, currency=excluded.currency,
    price=excluded.price, regular_market_price=excluded.regular_market_price,
    previous_close=excluded.previous_close, change=excluded.change,
    change_percent=excluded.change_percent, market_cap=excluded.market_cap,
    dividend_rate=excluded.dividend_rate, dividend_yield=excluded.dividend_yield,
    pre_market_price=excluded.pre_market_price, pre_market_change=excluded.pre_market_change,
    pre_market_change_percent=excluded.pre_market_change_percent,
    post_market_price=excluded.post_market_price, post_market_change=excluded.post_market_change,
    post_market_change_percent=excluded.post_market_change_percent,
    market_state=excluded.market_state, price_source=excluded.price_source,
    day_high=excluded.day_high, day_low=excluded.day_low,
    fifty_two_week_high=excluded.fifty_two_week_high,
    fifty_two_week_low=excluded.fifty_two_week_low, volume=excluded.volume,
    avg_volume=excluded.avg_volume, analyst_rating=excluded.analyst_rating,
    provider_updated_at=excluded.provider_updated_at, updated_at=excluded.updated_at,
    last_success_at=excluded.last_success_at, status='fresh', last_error=NULL
`

function persistQuotes(quotes, failures, fxPairs, now) {
  transaction(() => {
    for (const q of quotes) {
      stmtRunBatch(QUOTE_UPSERT, quoteValues(q, now))
      const currency = fxPairs.get(q.ticker)
      if (currency && q.price > 0) {
        stmtRunBatch(
          `INSERT INTO fx_rates (currency, usd_rate, provider_updated_at, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(currency) DO UPDATE SET usd_rate=excluded.usd_rate,
             provider_updated_at=excluded.provider_updated_at, updated_at=excluded.updated_at`,
          [currency, q.price, q.provider_updated_at, now]
        )
      }
    }
    stmtRunBatch(
      `INSERT INTO fx_rates (currency, usd_rate, provider_updated_at, updated_at)
       VALUES ('USD', 1, ?, ?)
       ON CONFLICT(currency) DO UPDATE SET usd_rate=1, updated_at=excluded.updated_at`,
      [now, now]
    )
    for (const failure of failures) {
      const existing = stmtGet('SELECT price FROM quotes WHERE ticker = ?', [failure.ticker])
      const status = existing?.price > 0 ? 'stale' : failure.kind === 'invalid' ? 'invalid' : 'unavailable'
      if (existing) {
        stmtRunBatch(
          'UPDATE quotes SET status = ?, last_error = ?, updated_at = ? WHERE ticker = ?',
          [status, failure.error.substring(0, 300), now, failure.ticker]
        )
      } else if (!fxPairs.has(failure.ticker)) {
        stmtRunBatch(
          `INSERT INTO quotes (ticker, provider_symbol, name, status, last_error, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [failure.ticker, failure.ticker, failure.ticker, status, failure.error.substring(0, 300), now]
        )
      }
    }
  })
}

export function getRates() {
  const rates = { USD: 1 }
  for (const row of stmtAll('SELECT currency, usd_rate FROM fx_rates')) {
    if (row.usd_rate > 0) rates[row.currency] = row.usd_rate
  }
  return rates
}

function annualDividendPerShare(ticker) {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)
  return stmtAll(
    'SELECT amount FROM dividends WHERE ticker = ? AND ex_date >= ?',
    [ticker, cutoff.toISOString().split('T')[0]]
  ).reduce((sum, row) => sum + row.amount, 0)
}

export function updatePortfolioSnapshot() {
  const date = torontoDate()
  const scopeSnapshots = new Map()

  for (const scope of listSnapshotScopes()) {
    const byCurrency = {}
    const ownerHoldings = {}
    const where = scopeWhere(scope, 'member_id')
    const transactions = stmtAll(
      `SELECT ticker, type, shares, price_per_share, member_id FROM transactions
       WHERE ${where.sql} ORDER BY date, id`,
      where.params
    )
    for (const item of transactions) {
      const ownerKey = item.member_id == null ? 'shared' : `member:${item.member_id}`
      const key = `${ownerKey}:${item.ticker}`
      if (!ownerHoldings[key]) ownerHoldings[key] = { ticker: item.ticker, shares: 0, cost: 0 }
      const holding = ownerHoldings[key]
      if (item.type === 'buy') {
        holding.shares += item.shares
        holding.cost += item.shares * item.price_per_share
      } else {
        const average = holding.shares > 0 ? holding.cost / holding.shares : 0
        holding.shares -= item.shares
        holding.cost = Math.max(0, holding.shares * average)
      }
    }

    const holdings = {}
    for (const item of Object.values(ownerHoldings).filter((holding) => holding.shares > 0)) {
      if (!holdings[item.ticker]) holdings[item.ticker] = { shares: 0, cost: 0 }
      holdings[item.ticker].shares += item.shares
      holdings[item.ticker].cost += item.cost
    }
    for (const [ticker, holding] of Object.entries(holdings)) {
      const quote = stmtGet('SELECT price, currency FROM quotes WHERE ticker = ?', [ticker])
      const currency = quote?.currency || 'USD'
      if (!byCurrency[currency]) byCurrency[currency] = { value: 0, cost: 0, dividends: 0, positions: 0 }
      if (quote?.price > 0) byCurrency[currency].value += holding.shares * quote.price
      byCurrency[currency].cost += holding.cost
      byCurrency[currency].dividends += holding.shares * annualDividendPerShare(ticker)
      byCurrency[currency].positions++
    }

    const cashWhere = scopeWhere(scope, 'member_id')
    for (const cash of stmtAll(`SELECT * FROM cash_positions WHERE ${cashWhere.sql}`, cashWhere.params)) {
      const currency = cash.currency || 'USD'
      if (!byCurrency[currency]) byCurrency[currency] = { value: 0, cost: 0, dividends: 0, positions: 0 }
      if ((cash.type || 'cash') === 'income') {
        const frequency = cash.frequency || 'yearly'
        byCurrency[currency].dividends += frequency === 'weekly'
          ? cash.amount * 52
          : frequency === 'monthly' ? cash.amount * 12 : cash.amount
      } else {
        byCurrency[currency].value += cash.amount
        byCurrency[currency].cost += cash.amount
        byCurrency[currency].dividends += cash.amount * ((cash.interest_rate || 0) / 100)
      }
    }
    scopeSnapshots.set(scope.key, byCurrency)
  }

  const rates = getRates()
  transaction(() => {
    const household = scopeSnapshots.get('household') || {}
    stmtRunBatch('DELETE FROM portfolio_snapshots_v2 WHERE date = ?', [date])
    stmtRunBatch('DELETE FROM portfolio_snapshots_v3 WHERE date = ?', [date])
    stmtRunBatch('DELETE FROM snapshot_fx_rates WHERE date = ?', [date])
    for (const [currency, values] of Object.entries(household)) {
      stmtRunBatch(
        `INSERT INTO portfolio_snapshots_v2
          (date, currency, total_value, total_cost, annual_dividends, positions, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [date, currency, values.value, values.cost, values.dividends, values.positions]
      )
    }
    for (const [scopeKey, byCurrency] of scopeSnapshots) {
      for (const [currency, values] of Object.entries(byCurrency)) {
        stmtRunBatch(
          `INSERT INTO portfolio_snapshots_v3
            (date, scope_key, currency, total_value, total_cost, annual_dividends, positions, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [date, scopeKey, currency, values.value, values.cost, values.dividends, values.positions]
        )
      }
    }
    for (const [currency, rate] of Object.entries(rates)) {
      stmtRunBatch(
        `INSERT INTO snapshot_fx_rates (date, currency, usd_rate, updated_at)
         VALUES (?, ?, ?, datetime('now'))`,
        [date, currency, rate]
      )
    }
  })

  for (const [scopeKey, byCurrency] of scopeSnapshots) {
    const totalUsd = Object.entries(byCurrency).reduce((sum, [currency, values]) => (
      sum + values.value * (rates[currency] || 0)
    ), 0)
    const costUsd = Object.entries(byCurrency).reduce((sum, [currency, values]) => (
      sum + values.cost * (rates[currency] || 0)
    ), 0)
    const annualUsd = Object.entries(byCurrency).reduce((sum, [currency, values]) => (
      sum + values.dividends * (rates[currency] || 0)
    ), 0)
    checkMilestones({
      total_value: totalUsd,
      total_cost: costUsd,
      total_gain: totalUsd - costUsd,
      annual_dividends: annualUsd,
      positions: Object.values(byCurrency).reduce((sum, values) => sum + values.positions, 0),
    }, scopeKey)
  }
}

function checkPriceAlerts(quotes) {
  for (const quote of quotes) {
    const alerts = stmtAll(
      'SELECT * FROM price_alerts WHERE ticker = ? AND triggered = 0',
      [quote.ticker]
    )
    for (const alert of alerts) {
      const triggered = (alert.condition === 'above' && quote.price >= alert.target_price)
        || (alert.condition === 'below' && quote.price <= alert.target_price)
      if (!triggered) continue
      transaction(() => {
        stmtRunBatch(
          "UPDATE price_alerts SET triggered = 1, triggered_at = datetime('now') WHERE id = ?",
          [alert.id]
        )
        stmtRunBatch(
          'INSERT INTO notifications (type, title, message) VALUES (?, ?, ?)',
          [
            'price_alert',
            `${alert.ticker} moved ${alert.condition} $${alert.target_price}`,
            `${alert.ticker} is now $${quote.price.toFixed(2)}`,
          ]
        )
      })
    }
  }
}

function broadcast(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`
  for (const client of [...sseClients]) {
    try { client.write(payload) } catch { sseClients.delete(client) }
  }
}

function sessionKind() {
  const recentCutoff = Date.now() - 60 * 60 * 1000
  const states = stmtAll("SELECT market_state, last_success_at FROM quotes WHERE ticker NOT LIKE '%=X'")
    .filter((row) => {
      if (!row.last_success_at) return false
      const normalized = row.last_success_at.includes('T')
        ? row.last_success_at
        : `${row.last_success_at.replace(' ', 'T')}Z`
      return new Date(normalized).getTime() >= recentCutoff
    })
    .map((row) => row.market_state || '')
  if (states.some((state) => state === 'REGULAR')) return 'regular'
  if (states.some((state) => state.startsWith('PRE') || state.startsWith('POST'))) return 'extended'
  return 'closed'
}

export function pollIntervalFor(session, activeClients = 0) {
  if (session === 'regular') return activeClients ? ACTIVE_REGULAR_INTERVAL : IDLE_REGULAR_INTERVAL
  if (session === 'extended') return EXTENDED_INTERVAL
  return CLOSED_INTERVAL
}

function nextInterval() {
  return pollIntervalFor(sessionKind(), sseClients.size)
}

function scheduleNext(delayMs = nextInterval()) {
  if (pollTimer) clearTimeout(pollTimer)
  if (shuttingDown) return
  pollTimer = setTimeout(() => {
    refreshMarketData({ reason: 'scheduled' }).catch((err) => {
      console.error('Scheduled market refresh failed:', err.message)
      scheduleNext()
    })
  }, delayMs)
}

export async function refreshMarketData({ reason = 'manual' } = {}) {
  if (refreshInFlight) return refreshInFlight
  const now = Date.now()
  const tickers = getTrackedTickers()
  const fxPairs = getFxPairs(getTrackedCurrencies())
  const symbols = [...new Set([...tickers, ...fxPairs.keys()])]
  const symbolKey = [...symbols].sort().join(',')
  if (lastRefreshAt && symbolKey === lastSymbolKey && now - lastRefreshAt < MANUAL_FRESHNESS_FLOOR) {
    return { ...lastResult, cached: true }
  }

  refreshInFlight = (async () => {
    const started = Date.now()
    trackedSymbolCount = symbols.length
    if (!symbols.length) {
      lastRefreshAt = Date.now()
      lastSymbolKey = symbolKey
      lastResult = { updated: 0, stale: 0, failed: 0, as_of: new Date().toISOString() }
      return lastResult
    }

    const result = await getQuotes(symbols)
    const quotes = [...result.quotes]
    const failures = [...result.failures]
    const discoveredCurrencies = [...new Set(quotes.map((quote) => quote.currency).filter(Boolean))]
    const missingFxPairs = [...getFxPairs(discoveredCurrencies)].filter(([pair]) => !fxPairs.has(pair))
    if (missingFxPairs.length) {
      const fxResult = await getQuotes(missingFxPairs.map(([pair]) => pair))
      for (const [pair, currency] of missingFxPairs) fxPairs.set(pair, currency)
      quotes.push(...fxResult.quotes)
      failures.push(...fxResult.failures)
    }
    const asOf = new Date().toISOString()
    persistQuotes(quotes, failures, fxPairs, asOf)
    lastSymbolKey = [...new Set([...symbols, ...fxPairs.keys()])].sort().join(',')
    trackedSymbolCount = lastSymbolKey ? lastSymbolKey.split(',').length : 0
    if (quotes.length) lastProviderSuccessAt = asOf
    lastRefreshAt = Date.now()
    lastRefreshDurationMs = lastRefreshAt - started
    checkPriceAlerts(quotes.filter((quote) => tickers.includes(quote.ticker)))
    updatePortfolioSnapshot()

    const stale = failures.filter((failure) => (
      stmtGet('SELECT price FROM quotes WHERE ticker = ?', [failure.ticker])?.price > 0
    )).length
    lastResult = {
      updated: quotes.length,
      stale,
      failed: failures.length - stale,
      as_of: asOf,
      reason,
    }
    broadcast({ type: 'market', ...lastResult, rates: getRates() })
    runDailyEnrichment().catch((err) => console.error('Daily enrichment failed:', err.message))
    return lastResult
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
    scheduleNext()
  }
}

async function runDailyEnrichment() {
  if (enrichmentInFlight) return enrichmentInFlight
  enrichmentInFlight = (async () => {
    const today = torontoDate()
    const portfolioTickers = new Set(stmtAll('SELECT DISTINCT ticker FROM transactions').map((row) => row.ticker))
    for (const ticker of getTrackedTickers().filter((symbol) => !symbol.endsWith('=X'))) {
      if (shuttingDown) break
      const state = stmtGet('SELECT * FROM enrichment_state WHERE ticker = ?', [ticker]) || {}
      if (state.period_date !== today) {
        const changes = await getPeriodChanges(ticker)
        transaction(() => {
          stmtRunBatch(
            `INSERT INTO period_changes (ticker, change_3m, change_6m, change_1y, updated_at)
             VALUES (?, ?, ?, ?, datetime('now'))
             ON CONFLICT(ticker) DO UPDATE SET change_3m=excluded.change_3m,
               change_6m=excluded.change_6m, change_1y=excluded.change_1y,
               updated_at=excluded.updated_at`,
            [ticker, changes['3m'] ?? null, changes['6m'] ?? null, changes['1y'] ?? null]
          )
          stmtRunBatch(
            `INSERT INTO enrichment_state (ticker, period_date)
             VALUES (?, ?) ON CONFLICT(ticker) DO UPDATE SET period_date=excluded.period_date`,
            [ticker, today]
          )
        })
      }
      if (portfolioTickers.has(ticker) && state.dividend_date !== today) {
        const dividends = await getDividendHistory(ticker)
        transaction(() => {
          for (const dividend of dividends) {
            stmtRunBatch(
              'INSERT OR IGNORE INTO dividends (ticker, amount, ex_date) VALUES (?, ?, ?)',
              [dividend.ticker, dividend.amount, dividend.ex_date]
            )
          }
          stmtRunBatch(
            `INSERT INTO enrichment_state (ticker, dividend_date)
             VALUES (?, ?) ON CONFLICT(ticker) DO UPDATE SET dividend_date=excluded.dividend_date`,
            [ticker, today]
          )
        })
      }
    }
    updatePortfolioSnapshot()
  })()
  try { return await enrichmentInFlight } finally { enrichmentInFlight = null }
}

export function addSSEClient(res) {
  if (sseClients.size >= MAX_SSE_CLIENTS) return false
  sseClients.add(res)
  res.write(`data: ${JSON.stringify({
    type: 'connected', as_of: lastResult.as_of, rates: getRates(),
  })}\n\n`)
  res.on('close', () => {
    sseClients.delete(res)
    if (!sseClients.size) {
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      heartbeatTimer = null
      scheduleNext()
    }
  })
  if (!heartbeatTimer) {
    heartbeatTimer = setInterval(() => broadcast({ type: 'heartbeat', at: new Date().toISOString() }), 25_000)
  }
  if (!lastRefreshAt || Date.now() - lastRefreshAt > ACTIVE_REGULAR_INTERVAL) scheduleNext(1000)
  return true
}

export function getMarketHealth() {
  const provider = getProviderMetrics()
  const memory = process.memoryUsage()
  return {
    ...provider,
    tracked_symbols: trackedSymbolCount,
    sse_clients: sseClients.size,
    refresh_in_flight: Boolean(refreshInFlight),
    enrichment_in_flight: Boolean(enrichmentInFlight),
    last_refresh_at: lastResult.as_of,
    last_provider_success_at: lastProviderSuccessAt,
    last_refresh_duration_ms: lastRefreshDurationMs,
    stale_quotes: stmtAll("SELECT COUNT(*) AS count FROM quotes WHERE status = 'stale'")[0]?.count || 0,
    rss_mb: Math.round(memory.rss / 1024 / 1024),
    heap_used_mb: Math.round(memory.heapUsed / 1024 / 1024),
    session: sessionKind(),
    next_interval_ms: nextInterval(),
  }
}

function syncPortfolioToWatchlist() {
  transaction(() => {
    for (const ticker of stmtAll('SELECT DISTINCT ticker FROM transactions').map((row) => row.ticker)) {
      stmtRunBatch('INSERT OR IGNORE INTO watchlist (ticker) VALUES (?)', [ticker])
    }
  })
}

export function startMarketData() {
  syncPortfolioToWatchlist()
  try { createBackup('daily') } catch (err) { console.error('Daily backup failed:', err.message) }
  backupTimer = setInterval(() => {
    try { createBackup('daily') } catch (err) { console.error('Daily backup failed:', err.message) }
  }, 6 * 60 * 60 * 1000)
  refreshMarketData({ reason: 'startup', force: true }).catch((err) => {
    console.error('Initial market refresh failed:', err.message)
    scheduleNext()
  })
}

export function stopMarketData() {
  shuttingDown = true
  if (pollTimer) clearTimeout(pollTimer)
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  if (backupTimer) clearInterval(backupTimer)
  for (const client of sseClients) client.end()
  sseClients.clear()
}
