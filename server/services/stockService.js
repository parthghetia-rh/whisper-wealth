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
