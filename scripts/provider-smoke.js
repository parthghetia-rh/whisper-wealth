import { getProviderMetrics, getQuotes } from '../server/services/stockService.js'

const symbols = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['AAPL', 'MSFT.TO', 'CADUSD=X']
const result = await getQuotes(symbols)

console.log(JSON.stringify({
  quotes: result.quotes.map((quote) => ({
    ticker: quote.ticker,
    provider_symbol: quote.provider_symbol,
    has_price: quote.price > 0,
    price_source: quote.price_source,
  })),
  failures: result.failures,
  metrics: getProviderMetrics(),
}, null, 2))

if (result.quotes.length !== symbols.length) process.exitCode = 1
