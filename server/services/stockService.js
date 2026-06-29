import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
})

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

export async function getQuotes(tickers) {
  if (!tickers.length) return []

  const results = []
  for (let i = 0; i < tickers.length; i++) {
    if (i > 0 && i % 5 === 0) await delay(1000)
    const ticker = tickers[i]
    try {
      const quote = await yahooFinance.quote(ticker)
      results.push({
        ticker: quote.symbol,
        name: quote.shortName || quote.longName || ticker,
        currency: quote.currency || 'USD',
        price: quote.regularMarketPrice ?? 0,
        previous_close: quote.regularMarketPreviousClose ?? 0,
        change: quote.regularMarketChange ?? 0,
        change_percent: quote.regularMarketChangePercent ?? 0,
        market_cap: quote.marketCap ?? null,
        dividend_rate: quote.trailingAnnualDividendRate ?? 0,
        dividend_yield: quote.trailingAnnualDividendYield
          ? quote.trailingAnnualDividendYield * 100
          : 0,
        market_state: quote.marketState ?? null,
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
      })
    } catch (err) {
      console.error(`Failed to fetch quote for ${ticker}:`, err.message)
    }
  }

  for (const r of results) {
    if (!r.analyst_rating && r.ticker.includes('.')) {
      const baseTicker = r.ticker.split('.')[0]
      try {
        const baseQuote = await yahooFinance.quote(baseTicker)
        r.analyst_rating = baseQuote.averageAnalystRating ?? null
      } catch {}
    }
  }

  return results
}

export async function getPeriodChanges(ticker) {
  const now = new Date()
  const oneYearAgo = new Date(now)
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  try {
    const result = await yahooFinance.chart(ticker, {
      period1: oneYearAgo.toISOString().split('T')[0],
      period2: now.toISOString().split('T')[0],
      interval: '1d',
    })
    const quotes = (result.quotes || []).filter((q) => q.close > 0)
    if (quotes.length < 2) return {}

    const last = quotes[quotes.length - 1].close
    const changes = {}

    for (const [label, months] of [['3m', 3], ['6m', 6], ['1y', 12]]) {
      const cutoff = new Date(now)
      cutoff.setMonth(cutoff.getMonth() - months)
      const ref = quotes.find((q) => q.date >= cutoff)
      if (ref && ref.close > 0) {
        changes[label] = Math.round(((last - ref.close) / ref.close) * 10000) / 100
      } else {
        changes[label] = null
      }
    }

    return changes
  } catch {
    return {}
  }
}

export async function getChartData(ticker, range) {
  const now = new Date()
  const months = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 }[range] || 12
  const start = new Date(now)
  start.setMonth(start.getMonth() - months)

  const result = await yahooFinance.chart(ticker, {
    period1: start.toISOString().split('T')[0],
    period2: now.toISOString().split('T')[0],
    interval: months <= 3 ? '1d' : '1wk',
  })

  return (result.quotes || []).map((q) => ({
    date: q.date?.toISOString().split('T')[0],
    close: Math.round((q.close ?? 0) * 100) / 100,
  })).filter((q) => q.date && q.close > 0)
}

export async function getExchangeRates(currencies) {
  const rates = { USD: 1 }
  const nonUsd = currencies.filter((c) => c !== 'USD')

  for (const currency of nonUsd) {
    try {
      const quote = await yahooFinance.quote(`${currency}USD=X`)
      rates[currency] = quote.regularMarketPrice
    } catch (err) {
      console.error(`Failed to fetch rate for ${currency}:`, err.message)
    }
  }

  return rates
}

export async function getDividendHistory(ticker) {
  try {
    const now = new Date()
    const threeYearsAgo = new Date(now)
    threeYearsAgo.setFullYear(now.getFullYear() - 3)

    const result = await yahooFinance.historical(ticker, {
      period1: threeYearsAgo.toISOString().split('T')[0],
      period2: now.toISOString().split('T')[0],
      events: 'dividends',
    })

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
