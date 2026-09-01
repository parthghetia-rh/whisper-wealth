import YahooFinance from 'yahoo-finance2'

export const QUOTE_BATCH_SIZE = 50
export const MAX_REQUESTS_PER_MINUTE = Math.max(
  1,
  Math.min(8, Number(process.env.YAHOO_MAX_REQUESTS_PER_MINUTE) || 8)
)

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  queue: { concurrency: 1, interval: 8000 },
})

const timeoutOptions = () => ({ fetchOptions: { signal: AbortSignal.timeout(15_000) } })

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export class RequestBudget {
  constructor(limit = MAX_REQUESTS_PER_MINUTE, windowMs = 60_000) {
    this.limit = limit
    this.windowMs = windowMs
    this.starts = []
    this.waiters = 0
    this.total = 0
  }

  prune(now = Date.now()) {
    this.starts = this.starts.filter((started) => now - started < this.windowMs)
  }

  async acquire() {
    this.waiters++
    try {
      while (true) {
        const now = Date.now()
        this.prune(now)
        if (this.starts.length < this.limit) {
          this.starts.push(now)
          this.total++
          return
        }
        await delay(Math.max(25, this.windowMs - (now - this.starts[0]) + 25))
      }
    } finally {
      this.waiters--
    }
  }

  metrics() {
    this.prune()
    return {
      requests_last_minute: this.starts.length,
      request_limit_per_minute: this.limit,
      queue_depth: this.waiters,
      total_requests: this.total,
    }
  }
}

const requestBudget = new RequestBudget()

async function yahooRequest(operation, retries = 2) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    await requestBudget.acquire()
    try {
      return await operation()
    } catch (err) {
      lastError = err
      if (attempt < retries) await delay(1000 * (attempt + 1) ** 2)
    }
  }
  throw lastError
}

export function chunkSymbols(symbols, size = QUOTE_BATCH_SIZE) {
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))]
  const chunks = []
  for (let i = 0; i < unique.length; i += size) chunks.push(unique.slice(i, i + size))
  return chunks
}

function isoTime(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function selectEffectivePrice(quote) {
  const state = quote.marketState || 'CLOSED'
  if (state.startsWith('PRE') && Number.isFinite(quote.preMarketPrice)) {
    return { price: quote.preMarketPrice, source: 'pre_market' }
  }
  if (state.startsWith('POST') && Number.isFinite(quote.postMarketPrice)) {
    return { price: quote.postMarketPrice, source: 'post_market' }
  }
  return {
    price: Number.isFinite(quote.regularMarketPrice) ? quote.regularMarketPrice : null,
    source: 'regular',
  }
}

function normalizeQuote(requestedTicker, quote) {
  const effective = selectEffectivePrice(quote)
  const previousClose = quote.regularMarketPreviousClose ?? null
  const change = effective.price != null && previousClose
    ? effective.price - previousClose
    : quote.regularMarketChange ?? null
  const changePercent = change != null && previousClose
    ? (change / previousClose) * 100
    : quote.regularMarketChangePercent ?? null
  const providerTime = effective.source === 'pre_market'
    ? quote.preMarketTime
    : effective.source === 'post_market'
      ? quote.postMarketTime
      : quote.regularMarketTime

  return {
    ticker: requestedTicker,
    provider_symbol: quote.symbol || requestedTicker,
    name: quote.shortName || quote.longName || requestedTicker,
    currency: quote.currency || 'USD',
    price: effective.price,
    regular_market_price: quote.regularMarketPrice ?? null,
    previous_close: previousClose,
    change,
    change_percent: changePercent,
    market_cap: quote.marketCap ?? null,
    dividend_rate: quote.trailingAnnualDividendRate ?? 0,
    dividend_yield: quote.trailingAnnualDividendYield
      ? quote.trailingAnnualDividendYield * 100
      : 0,
    market_state: quote.marketState ?? 'CLOSED',
    price_source: effective.source,
    pre_market_price: quote.preMarketPrice ?? null,
    pre_market_change: quote.preMarketChange ?? null,
    pre_market_change_percent: quote.preMarketChangePercent ?? null,
    post_market_price: quote.postMarketPrice ?? null,
    post_market_change: quote.postMarketChange ?? null,
    post_market_change_percent: quote.postMarketChangePercent ?? null,
    day_high: quote.regularMarketDayHigh ?? null,
    day_low: quote.regularMarketDayLow ?? null,
    fifty_two_week_high: quote.fiftyTwoWeekHigh ?? null,
    fifty_two_week_low: quote.fiftyTwoWeekLow ?? null,
    volume: quote.regularMarketVolume ?? null,
    avg_volume: quote.averageDailyVolume10Day ?? null,
    analyst_rating: quote.averageAnalystRating ?? null,
    provider_updated_at: isoTime(providerTime),
  }
}

export function correlateBatch(requested, received) {
  const bySymbol = new Map(received.map((quote) => [quote.symbol?.toUpperCase(), quote]))
  const assigned = new Map()
  const used = new Set()
  for (const ticker of requested) {
    const exact = bySymbol.get(ticker)
    if (exact) {
      assigned.set(ticker, exact)
      used.add(exact)
    }
  }
  const remainingTickers = requested.filter((ticker) => !assigned.has(ticker))
  const remainingQuotes = received.filter((quote) => !used.has(quote))
  if (remainingTickers.length === remainingQuotes.length) {
    remainingTickers.forEach((ticker, index) => assigned.set(ticker, remainingQuotes[index]))
  }
  return assigned
}

export async function getQuotes(tickers) {
  const quotes = []
  const failures = []
  for (const batch of chunkSymbols(tickers)) {
    try {
      const received = await yahooRequest(() => yahooFinance.quote(batch, undefined, timeoutOptions()))
      const assigned = correlateBatch(batch, received || [])
      for (const ticker of batch) {
        const quote = assigned.get(ticker)
        if (!quote) {
          failures.push({ ticker, kind: 'invalid', error: 'No quote returned by provider' })
          continue
        }
        const normalized = normalizeQuote(ticker, quote)
        if (normalized.price == null || normalized.price <= 0) {
          failures.push({ ticker, kind: 'unavailable', error: 'Provider returned no usable price' })
          continue
        }
        quotes.push(normalized)
      }
    } catch (err) {
      for (const ticker of batch) {
        failures.push({ ticker, kind: 'transient', error: err.message || 'Quote request failed' })
      }
    }
  }
  return { quotes, failures }
}

export async function getPeriodChanges(ticker) {
  const now = new Date()
  const oneYearAgo = new Date(now)
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  try {
    const result = await yahooRequest(() => yahooFinance.chart(ticker, {
      period1: oneYearAgo.toISOString().split('T')[0],
      period2: now.toISOString().split('T')[0],
      interval: '1d',
    }, timeoutOptions()))
    const quotes = (result.quotes || []).filter((q) => q.close > 0)
    if (quotes.length < 2) return {}
    const last = quotes[quotes.length - 1].close
    const changes = {}
    for (const [label, months] of [['3m', 3], ['6m', 6], ['1y', 12]]) {
      const cutoff = new Date(now)
      cutoff.setMonth(cutoff.getMonth() - months)
      const ref = quotes.find((q) => q.date >= cutoff)
      changes[label] = ref?.close > 0
        ? Math.round(((last - ref.close) / ref.close) * 10000) / 100
        : null
    }
    return changes
  } catch (err) {
    console.error(`Failed to fetch period changes for ${ticker}:`, err.message)
    return {}
  }
}

const chartCache = new Map()
const CHART_CACHE_MS = 15 * 60 * 1000
const MAX_CHART_CACHE = 100

export function chartOptionsForRange(range, now = new Date()) {
  const start = new Date(now)
  if (range === '1d') {
    // A full week guarantees a previous trading session after weekends/holidays.
    start.setDate(start.getDate() - 7)
    return { period1: start, period2: now, interval: '5m', includePrePost: true }
  }
  const months = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 }[range] || 12
  start.setMonth(start.getMonth() - months)
  return { period1: start, period2: now, interval: months <= 3 ? '1d' : '1wk' }
}

function marketDate(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function normalizeChartData(result, range) {
  const intraday = range === '1d'
  const timeZone = result.meta?.exchangeTimezoneName || 'America/New_York'
  let data = (result.quotes || []).map((q) => ({
    date: intraday ? q.date?.toISOString() : q.date?.toISOString().split('T')[0],
    marketDate: q.date ? marketDate(q.date, timeZone) : null,
    close: Math.round((q.close ?? 0) * 100) / 100,
  })).filter((q) => q.date && q.close > 0)
  if (intraday && data.length) {
    const latestSession = data.reduce(
      (latest, point) => point.marketDate > latest ? point.marketDate : latest,
      data[0].marketDate
    )
    data = data.filter((point) => point.marketDate === latestSession)
  }
  return data.map(({ marketDate: _marketDate, ...point }) => point)
}

export async function getChartData(ticker, range) {
  const key = `${ticker}:${range}`
  const cached = chartCache.get(key)
  if (cached && Date.now() - cached.at < CHART_CACHE_MS) return cached.data
  const now = new Date()
  const result = await yahooRequest(() => yahooFinance.chart(
    ticker, chartOptionsForRange(range, now), timeoutOptions()
  ))
  const data = normalizeChartData(result, range)
  if (chartCache.size >= MAX_CHART_CACHE) chartCache.delete(chartCache.keys().next().value)
  chartCache.set(key, { at: Date.now(), data })
  return data
}

export async function getDividendHistory(ticker) {
  try {
    const now = new Date()
    const threeYearsAgo = new Date(now)
    threeYearsAgo.setFullYear(now.getFullYear() - 3)
    const result = await yahooRequest(() => yahooFinance.historical(ticker, {
      period1: threeYearsAgo.toISOString().split('T')[0],
      period2: now.toISOString().split('T')[0],
      events: 'dividends',
    }, timeoutOptions()))
    return result.map((d) => ({
      ticker,
      amount: d.dividends,
      ex_date: d.date.toISOString().split('T')[0],
    }))
  } catch (err) {
    console.error(`Failed to fetch dividends for ${ticker}:`, err.message)
    return []
  }
}

export function getProviderMetrics() {
  return requestBudget.metrics()
}
