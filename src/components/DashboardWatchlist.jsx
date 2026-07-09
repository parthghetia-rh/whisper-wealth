import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { currencySymbol } from '../utils/currency'
import HoldingsTable from './HoldingsTable'
import StockCard from './StockCard'

export default function DashboardWatchlist({ holdings, showValues }) {
  const [tab, setTab] = useState('holdings')
  const { data: watchlistData } = useApi('/api/watchlist')

  const watchlistItems = watchlistData?.items || []

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setTab('holdings')}
            className={`px-4 py-1.5 text-xs font-medium transition-colors ${
              tab === 'holdings' ? 'bg-accent text-white' : 'bg-surface-3 text-text-muted hover:text-text'
            }`}
          >
            Holdings
          </button>
          <button
            onClick={() => setTab('watchlist')}
            className={`px-4 py-1.5 text-xs font-medium transition-colors ${
              tab === 'watchlist' ? 'bg-accent text-white' : 'bg-surface-3 text-text-muted hover:text-text'
            }`}
          >
            Watchlist
          </button>
        </div>
        {tab === 'watchlist' && (
          <Link to="/watchlist" className="text-[10px] text-accent hover:text-accent-hover">
            Full watchlist
          </Link>
        )}
      </div>

      {tab === 'holdings' && (
        <HoldingsTable holdings={holdings} showValues={showValues} />
      )}

      {tab === 'watchlist' && (
        <>
          {!watchlistItems.length ? (
            <div className="bg-surface-2 rounded-xl border border-border p-8 text-center text-text-muted">
              <p className="text-sm mb-2">No tickers in your watchlist</p>
              <Link to="/watchlist" className="text-accent text-xs hover:text-accent-hover">
                Go to Watchlist to add tickers
              </Link>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-2.5">
                {watchlistItems.map((item) => {
                  const q = item.quote
                  if (!q) return null
                  return (
                    <Link key={item.id} to={`/watchlist?ticker=${item.ticker}`}>
                      <StockCard item={{ ...q, periodChanges: item.periodChanges }} variant="watchlist" />
                    </Link>
                  )
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block bg-surface-2 rounded-xl border border-border overflow-x-auto">
                <table className="w-full text-sm min-w-[650px]">
                  <thead>
                    <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
                      <th className="text-left p-3 pl-4">Ticker</th>
                      <th className="text-right p-3">Price</th>
                      <th className="text-right p-3">Day</th>
                      <th className="text-right p-3">3M</th>
                      <th className="text-right p-3">6M</th>
                      <th className="text-right p-3">1Y</th>
                      <th className="text-right p-3 pr-4">Yield</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlistItems.map((item) => {
                      const q = item.quote
                      if (!q) return null
                      const up = q.change >= 0
                      const sym = currencySymbol(q.currency)
                      const pc = item.periodChanges
                      return (
                        <tr key={item.id} className="border-b border-border/30 hover:bg-surface-3/40 transition-colors">
                          <td className="p-3 pl-4">
                            <Link to={`/watchlist?ticker=${item.ticker}`} className="hover:text-accent transition-colors">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-5 rounded-full ${up ? 'bg-green' : 'bg-red'}`} />
                                <div>
                                  <div className="font-medium text-sm">{q.ticker}</div>
                                  <div className="text-[10px] text-text-muted truncate max-w-[120px]">{q.name}</div>
                                </div>
                              </div>
                            </Link>
                          </td>
                          <td className="text-right p-3 tabular-nums font-medium">{sym}{q.price.toFixed(2)}</td>
                          <td className="text-right p-3"><PctBadge value={q.change_percent} /></td>
                          <td className="text-right p-3"><PctBadge value={pc?.['3m']} /></td>
                          <td className="text-right p-3"><PctBadge value={pc?.['6m']} /></td>
                          <td className="text-right p-3"><PctBadge value={pc?.['1y']} /></td>
                          <td className="text-right p-3 pr-4 tabular-nums text-text-muted">
                            {q.dividend_yield > 0 ? `${q.dividend_yield.toFixed(2)}%` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function PctBadge({ value }) {
  if (value == null) return <span className="text-text-muted text-xs">—</span>
  const up = value >= 0
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium tabular-nums ${
      up ? 'bg-green/15 text-green' : 'bg-red/15 text-red'
    }`}>
      {up ? '+' : ''}{value.toFixed(2)}%
    </span>
  )
}
