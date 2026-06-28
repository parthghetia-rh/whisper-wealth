import { useState } from 'react'
import { currencySymbol } from '../utils/currency'
import { DividendHistoryChart } from './DividendChart'

const SORT_OPTIONS = [
  { key: null, label: 'Default' },
  { key: 'annual_income', label: 'Annual Income' },
  { key: 'dividend_yield', label: 'Yield' },
  { key: 'dividend_rate', label: 'Rate/Share' },
  { key: 'monthly_income', label: 'Monthly Income' },
  { key: 'shares', label: 'Shares' },
  { key: 'ticker', label: 'Ticker' },
]

export default function DividendTable({ holdings }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('desc')

  if (!holdings?.length) {
    return (
      <div className="bg-surface-2 rounded-xl border border-border p-8 text-center text-text-muted">
        No dividend data yet. Add stocks that pay dividends.
      </div>
    )
  }

  const sorted = [...holdings].sort((a, b) => {
    if (!sortKey) return 0
    let av = a[sortKey]
    let bv = b[sortKey]
    if (typeof av === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    return sortDir === 'asc' ? av - bv : bv - av
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">Sort:</span>
        <select
          value={sortKey || ''}
          onChange={(e) => {
            const key = e.target.value || null
            setSortKey(key)
            setSortDir(key === 'ticker' ? 'asc' : 'desc')
          }}
          className="bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-xs text-text outline-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key || 'default'} value={o.key || ''}>{o.label}</option>
          ))}
        </select>
        {sortKey && (
          <button
            onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text"
          >
            {sortDir === 'asc' ? 'Low first' : 'High first'}
            <SortArrow dir={sortDir} />
          </button>
        )}
      </div>

      {sorted.map((h) => {
        const sym = currencySymbol(h.currency)
        const yahooUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(h.ticker)}/dividends/`
        return (
          <div
            key={h.ticker}
            id={`dividend-${h.ticker}`}
            className="bg-surface-2 rounded-xl border border-border overflow-hidden scroll-mt-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-3">
              <div>
                <a
                  href={yahooUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:text-accent transition-colors inline-flex items-center gap-1"
                >
                  {h.ticker}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                    <path d="M7.5 5.5v2.5h-5.5v-5.5h2.5M6 1.5h2.5v2.5M4 6l4.5-4.5" />
                  </svg>
                </a>
                <span className="text-text-muted text-sm ml-2">{h.name}</span>
              </div>
              <div className="grid grid-cols-3 sm:flex gap-4 sm:gap-6 text-sm">
                <div className="text-right">
                  <div className="text-text-muted text-xs">Shares</div>
                  <div className="tabular-nums">{h.shares}</div>
                </div>
                <div className="text-right">
                  <div className="text-text-muted text-xs">Rate/Share</div>
                  <div className="tabular-nums">
                    {sym}{h.dividend_rate.toFixed(4)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-text-muted text-xs">Yield</div>
                  <div className="tabular-nums">{h.dividend_yield.toFixed(2)}%</div>
                </div>
                <div className="text-right">
                  <div className="text-text-muted text-xs">Weekly</div>
                  <div className="tabular-nums text-green">
                    {sym}{h.weekly_income.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-text-muted text-xs">Monthly</div>
                  <div className="tabular-nums text-green">
                    {sym}{h.monthly_income.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-text-muted text-xs">Yearly</div>
                  <div className="tabular-nums text-green">
                    {sym}{h.annual_income.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
            <DividendHistoryChart history={h.history} currency={h.currency} />
          </div>
        )
      })}
    </div>
  )
}

function SortArrow({ dir }) {
  return (
    <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor" className="text-accent">
      {dir === 'asc' ? (
        <path d="M4 1L7.5 5.5H0.5z" />
      ) : (
        <path d="M4 9L0.5 4.5H7.5z" />
      )}
    </svg>
  )
}
