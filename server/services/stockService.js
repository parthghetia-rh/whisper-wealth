import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
})

export async function getQuotes(tickers) {
  if (!tickers.length) return []

  const results = []
  for (const ticker of tickers) {
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
      })
    } catch (err) {
      console.error(`Failed to fetch quote for ${ticker}:`, err.message)
    }
  }
  return results
}

export async function getPeriodChanges(ticker) {
  const now = new Date()
  const changes = {}

  for (const [label, months] of [['3m', 3], ['6m', 6], ['1y', 12]]) {
    try {
      const start = new Date(now)
      start.setMonth(start.getMonth() - months)
      const result = await yahooFinance.chart(ticker, {
        period1: start.toISOString().split('T')[0],
        period2: now.toISOString().split('T')[0],
        interval: '1d',
      })
      const quotes = result.quotes || []
      if (quotes.length >= 2) {
        const first = quotes[0].close
        const last = quotes[quotes.length - 1].close
        changes[label] = first > 0 ? Math.round(((last - first) / first) * 10000) / 100 : 0
      }
    } catch {
      changes[label] = null
    }
  }

  return changes
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
