import { useState } from 'react'
import { currencySymbol } from '../utils/currency'
import StockCard from './StockCard'
import TickerChart from './TickerChart'
import TickerDetail from './TickerDetail'

const COLUMNS = [
  { key: 'ticker', label: 'Ticker', align: 'left' },
  { key: 'shares', label: 'Shares', align: 'right' },
  { key: 'avg_cost', label: 'Avg Cost', align: 'right' },
  { key: 'current_price', label: 'Price', align: 'right' },
  { key: 'change_percent', label: 'Day Chg', align: 'right' },
  { key: 'market_value', label: 'Value', align: 'right' },
  { key: 'gain_loss', label: 'Gain/Loss', align: 'right' },
  { key: 'dividend_yield', label: 'Div Yield', align: 'right', last: true },
]

const SORT_OPTIONS = [
  { key: null, label: 'Default' },
  { key: 'gain_loss', label: 'Gain/Loss' },
  { key: 'change_percent', label: 'Day Change' },
  { key: 'market_value', label: 'Value' },
  { key: 'dividend_yield', label: 'Yield' },
  { key: 'ticker', label: 'Ticker' },
]

const HIDDEN = '••••••'

export default function HoldingsTable({ holdings, showValues = true }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('desc')
  const [expandedTicker, setExpandedTicker] = useState(null)

  if (!holdings?.length) {
    return (
      <div className="bg-surface-2 rounded-xl border border-border p-8 text-center text-text-muted">
        No holdings yet. Add transactions to get started.
      </div>
    )
  }

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'ticker' ? 'asc' : 'desc')
    }
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

  const grouped = {}
  for (const h of sorted) {
    const c = h.currency || 'USD'
    if (!grouped[c]) grouped[c] = []
    grouped[c].push(h)
  }

  return (
    <div className="space-y-4">
      {/* Mobile sort control */}
      <div className="md:hidden flex items-center gap-2">
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
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text px-2 py-1 bg-surface-3 border border-border rounded-lg"
          >
            {sortDir === 'asc' ? 'Low first' : 'High first'}
            <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor" className="text-accent">
              {sortDir === 'asc' ? <path d="M4 1L7.5 5.5H0.5z" /> : <path d="M4 9L0.5 4.5H7.5z" />}
            </svg>
          </button>
        )}
      </div>

      {Object.entries(grouped).map(([currency, items]) => {
        const sym = currencySymbol(currency)
        return (
          <div key={currency}>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-surface-3 px-2 py-0.5 rounded text-xs font-semibold text-text">
                {currency}
              </span>
            </div>

            {/* Mobile: card view */}
            <div className="md:hidden space-y-2">
              {items.map((h) => {
                const isExpanded = expandedTicker === h.ticker
                return (
                  <div key={h.ticker}>
                    <StockCard
                      item={h}
                      variant="holding"
                      showValues={showValues}
                      onClick={() => setExpandedTicker(isExpanded ? null : h.ticker)}
                    />
                    {isExpanded && (
                      <div className="mt-1 rounded-xl border border-border overflow-hidden">
                        <TickerChart ticker={h.ticker} currency={h.currency} />
                        <TickerDetail quote={h} item={{ id: h.ticker, ticker: h.ticker }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Desktop: table view */}
            <div className="hidden md:block bg-surface-2 rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-sm min-w-[750px]">
                <thead>
                  <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`p-3 cursor-pointer select-none hover:text-text transition-colors ${
                          col.align === 'left' ? 'text-left pl-4' : 'text-right'
                        } ${col.last ? 'pr-4' : ''}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortKey === col.key && (
                            <SortArrow dir={sortDir} />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((h) => {
                    const isExpanded = expandedTicker === h.ticker
                    return (<>
                    <tr
                      key={h.ticker}
                      onClick={() => setExpandedTicker(isExpanded ? null : h.ticker)}
                      className={`border-b border-border/50 cursor-pointer transition-colors ${
                        isExpanded ? 'bg-surface-3/40' : 'hover:bg-surface-3/50'
                      }`}
                    >
                      <td className="p-3 pl-4">
                        <div className="font-medium">{h.ticker}</div>
                        <div className="text-xs text-text-muted truncate max-w-[140px]">
                          {h.name}
                        </div>
                      </td>
                      <td className="text-right p-3 tabular-nums">{showValues ? h.shares : HIDDEN}</td>
                      <td className="text-right p-3 tabular-nums">
                        {showValues ? `${sym}${h.avg_cost.toFixed(2)}` : HIDDEN}
                      </td>
                      <td className="text-right p-3 tabular-nums font-medium">
                        {sym}{h.current_price.toFixed(2)}
                      </td>
                      <td className="text-right p-3 tabular-nums">
                        <span className={h.change >= 0 ? 'text-green' : 'text-red'}>
                          {h.change >= 0 ? '+' : ''}
                          {h.change.toFixed(2)} ({h.change_percent.toFixed(2)}%)
                        </span>
                      </td>
                      <td className="text-right p-3 tabular-nums font-medium">
                        {showValues ? `${sym}${h.market_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : HIDDEN}
                      </td>
                      <td className="text-right p-3 tabular-nums">
                        {showValues ? (
                          <span className={h.gain_loss >= 0 ? 'text-green' : 'text-red'}>
                            {h.gain_loss >= 0 ? '+' : ''}{sym}
                            {Math.abs(h.gain_loss).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                            })}
                            <span className="text-xs ml-1">
                              ({h.gain_loss_percent.toFixed(2)}%)
                            </span>
                          </span>
                        ) : HIDDEN}
                      </td>
                      <td className="text-right p-3 pr-4 tabular-nums text-text-muted">
                        {h.dividend_yield.toFixed(2)}%
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${h.ticker}-detail`}>
                        <td colSpan={8} className="p-0">
                          <TickerChart ticker={h.ticker} currency={h.currency} />
                          <TickerDetail quote={h} item={{ id: h.ticker, ticker: h.ticker }} />
                        </td>
                      </tr>
                    )}
                    </>)
                  })}
                </tbody>
              </table>
            </div>
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
