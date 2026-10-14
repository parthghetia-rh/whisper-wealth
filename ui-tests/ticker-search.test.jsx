import { describe, expect, it } from 'vitest'
import { matchingTickers } from '../src/components/TickerSearch'

describe('ticker search suggestions', () => {
  const holdings = [{ ticker: 'IBM', name: 'International Business Machines', shares: 3 }]
  const watchlist = [{ ticker: 'IBM', quote: { name: 'IBM' } }, { ticker: 'XEQT.TO', quote: { name: 'iShares Equity ETF' } }]
  it('matches symbols and company names without duplicating owned watchlist symbols', () => {
    expect(matchingTickers(holdings, watchlist, ' ibm ')).toHaveLength(1)
    expect(matchingTickers(holdings, watchlist, 'business')[0].shares).toBe(3)
    expect(matchingTickers(holdings, watchlist, 'equity')[0].ticker).toBe('XEQT.TO')
    expect(matchingTickers(holdings, watchlist, 'missing')).toEqual([])
  })
  it('bounds the suggestion list', () => {
    expect(matchingTickers(Array.from({ length: 100 }, (_, i) => ({ ticker: `T${i}` })), [], '')).toHaveLength(8)
  })
})
