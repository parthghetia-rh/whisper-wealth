import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApi, postApi, deleteApi } from '../hooks/useApi'
import { currencySymbol } from '../utils/currency'
import TickerChart from '../components/TickerChart'
import StockCard from '../components/StockCard'

const INTERVALS = [
  { label: '10s', value: 10_000 },
  { label: '30s', value: 30_000 },
  { label: '1m', value: 60_000 },
  { label: '5m', value: 300_000 },
  { label: 'Off', value: 0 },
]

const STORAGE_KEY = 'watchlist-refresh-interval'

const WL_COLUMNS = [
  { key: 'ticker', label: 'Ticker', align: 'left', get: (q) => q?.ticker || '', getP: () => null },
  { key: 'name', label: 'Name', align: 'left', get: (q) => q?.name || '', getP: () => null },
  { key: 'price', label: 'Price', align: 'right', get: (q) => q?.price ?? 0, getP: () => null },
  { key: 'change_percent', label: 'Day', align: 'right', get: (q) => q?.change_percent ?? 0, getP: () => null },
  { key: '3m', label: '3M', align: 'right', get: () => 0, getP: (p) => p?.['3m'] ?? null },
  { key: '6m', label: '6M', align: 'right', get: () => 0, getP: (p) => p?.['6m'] ?? null },
  { key: '1y', label: '1Y', align: 'right', get: () => 0, getP: (p) => p?.['1y'] ?? null },
  { key: 'dividend_yield', label: 'Yield', align: 'right', get: (q) => q?.dividend_yield ?? 0, getP: () => null },
]

export default function Watchlist() {
  const { data, refetch } = useApi('/api/watchlist')
  const [ticker, setTicker] = useState('')
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('desc')
  const [searchParams, setSearchParams] = useSearchParams()
  const [expandedTicker, setExpandedTicker] = useState(() => searchParams.get('ticker') || null)
  const [interval, setIntervalMs] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? Number(saved) : 30_000
  })

  const refetchRef = useRef(refetch)
  refetchRef.current = refetch

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(interval))
  }, [interval])

  const doRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await postApi('/api/watchlist/refresh', {})
    } catch {}
    await new Promise((r) => setTimeout(r, 1500))
    refetchRef.current()
    setLastRefresh(new Date())
    setRefreshing(false)
  }, [])

  useEffect(() => {
    doRefresh()
  }, [doRefresh])

  useEffect(() => {
    if (!interval) return
    const id = setInterval(doRefresh, interval)
    return () => clearInterval(id)
  }, [interval, doRefresh])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!ticker.trim()) return
    setError(null)
    setAdding(true)
    try {
      await postApi('/api/watchlist', { ticker: ticker.trim() })
      setTicker('')
      await new Promise((r) => setTimeout(r, 2000))
      refetch()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id) => {
    await deleteApi(`/api/watchlist/${id}`)
    refetch()
  }

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'ticker' || key === 'name' ? 'asc' : 'desc')
    }
  }

  const items = data?.items || []

  const sortedItems = [...items].sort((a, b) => {
    if (!sortKey) return 0
    const col = WL_COLUMNS.find((c) => c.key === sortKey)
    if (!col) return 0
    let av, bv
    if (['3m', '6m', '1y'].includes(sortKey)) {
      av = col.getP(a.periodChanges) ?? -Infinity
      bv = col.getP(b.periodChanges) ?? -Infinity
    } else {
      av = col.get(a.quote)
      bv = col.get(b.quote)
    }
    if (typeof av === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    return sortDir === 'asc' ? av - bv : bv - av
  })

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Watchlist</h2>
          <p className="text-sm text-text-muted mt-0.5">
            Track tickers with live price updates
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={doRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-3 transition-colors disabled:opacity-50"
            title="Refresh now"
          >
            <svg
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              className={refreshing ? 'animate-spin' : ''}
            >
              <path d="M1.5 7a5.5 5.5 0 019.5-3.5M12.5 7a5.5 5.5 0 01-9.5 3.5" />
              <path d="M11 1v2.5h-2.5M3 11v-2.5h2.5" />
            </svg>
          </button>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {INTERVALS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setIntervalMs(opt.value)}
                className={`px-2 py-1 text-[11px] font-medium transition-colors ${
                  interval === opt.value
                    ? 'bg-accent text-white'
                    : 'bg-surface-3 text-text-muted hover:text-text'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {lastRefresh && (
            <span className="text-[10px] text-text-muted tabular-nums">
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Add ticker e.g. AAPL, MSFT.TO, RELIANCE.NS"
          className="flex-1 bg-surface-2 border border-border rounded-lg px-4 py-2.5 text-sm text-text placeholder:text-text-muted/50 outline-none focus:border-accent transition-colors"
        />
        <button
          type="submit"
          disabled={adding || !ticker.trim()}
          className="bg-accent hover:bg-accent-hover text-white rounded-lg px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {adding ? 'Adding...' : 'Add'}
        </button>
      </form>

      {error && (
        <div className="text-red text-xs bg-red/10 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {!items.length ? (
        <div className="bg-surface-2 rounded-xl border border-border p-8 text-center text-text-muted">
          No tickers in your watchlist yet.
        </div>
      ) : (
        <>
          {/* Mobile: card view */}
          <div className="md:hidden space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-text-muted">Sort:</span>
              <select
                value={sortKey || ''}
                onChange={(e) => {
                  const key = e.target.value || null
                  setSortKey(key)
                  setSortDir(key === 'ticker' || key === 'name' ? 'asc' : 'desc')
                }}
                className="bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-xs text-text outline-none"
              >
                <option value="">Default</option>
                <option value="change_percent">Day Change</option>
                <option value="3m">3M Change</option>
                <option value="6m">6M Change</option>
                <option value="1y">1Y Change</option>
                <option value="price">Price</option>
                <option value="ticker">Ticker</option>
              </select>
            </div>
            {sortedItems.map((item) => {
              const q = item.quote
              const isExpanded = expandedTicker === item.ticker
              if (!q) {
                return (
                  <div key={item.id} className="bg-surface-2 border border-border rounded-xl p-3.5 flex items-center justify-between">
                    <span className="text-sm font-medium">{item.ticker}</span>
                    <span className="text-xs text-text-muted">Loading...</span>
                  </div>
                )
              }
              return (
                <div key={item.id}>
                  <div className="relative">
                    <StockCard
                      item={{ ...q, periodChanges: item.periodChanges }}
                      variant="watchlist"
                      hasAction
                      onClick={() => setExpandedTicker(isExpanded ? null : item.ticker)}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                      className="absolute top-1/2 -translate-y-1/2 right-3 text-text-muted hover:text-red transition-colors p-2"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="mt-1 rounded-xl border border-border overflow-hidden">
                      <TickerChart ticker={item.ticker} currency={q.currency} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop: table view */}
          <div className="hidden md:block bg-surface-2 rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
                  {WL_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`p-3 cursor-pointer select-none hover:text-text transition-colors ${
                        col.align === 'left' ? 'text-left' : 'text-right'
                      } ${col.key === 'ticker' ? 'pl-4' : ''}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key && <SortArrow dir={sortDir} />}
                      </span>
                    </th>
                  ))}
                  <th className="p-3 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => {
                  const q = item.quote
                  const pc = item.periodChanges
                  const isExpanded = expandedTicker === item.ticker

                  if (!q) {
                    return (
                      <tr key={item.id} className="border-b border-border/30">
                        <td className="p-3 pl-4 font-medium">{item.ticker}</td>
                        <td className="p-3 text-text-muted text-xs" colSpan={6}>Loading...</td>
                        <td />
                        <td className="p-3 pr-4 text-right">
                          <button onClick={() => handleDelete(item.id)} className="text-text-muted hover:text-red transition-colors p-1">
                            <TrashIcon />
                          </button>
                        </td>
                      </tr>
                    )
                  }

                  const up = q.change >= 0
                  const sym = currencySymbol(q.currency)

                  return (
                    <>
                      <tr
                        key={item.id}
                        onClick={() => setExpandedTicker(isExpanded ? null : item.ticker)}
                        className={`border-b border-border/30 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-surface-3/40' : 'hover:bg-surface-3/40'
                        }`}
                      >
                        <td className="p-3 pl-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-1.5 h-6 rounded-full ${up ? 'bg-green' : 'bg-red'}`} />
                            <div>
                              <div className="font-medium">{q.ticker}</div>
                              <div className="text-[10px] text-text-muted">{q.currency}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-text-muted text-xs truncate max-w-[150px]">{q.name}</td>
                        <td className="text-right p-3 tabular-nums font-medium">{sym}{q.price.toFixed(2)}</td>
                        <td className="text-right p-3"><PctBadge value={q.change_percent} /></td>
                        <td className="text-right p-3"><PctBadge value={pc?.['3m']} /></td>
                        <td className="text-right p-3"><PctBadge value={pc?.['6m']} /></td>
                        <td className="text-right p-3"><PctBadge value={pc?.['1y']} /></td>
                        <td className="text-right p-3 tabular-nums text-text-muted">
                          {q.dividend_yield > 0 ? `${q.dividend_yield.toFixed(2)}%` : '—'}
                        </td>
                        <td className="text-right p-3 pr-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                            className="text-text-muted hover:text-red transition-colors p-1"
                          >
                            <TrashIcon />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${item.id}-chart`}>
                          <td colSpan={9} className="p-0">
                            <TickerChart ticker={item.ticker} currency={q.currency} />
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function PctBadge({ value }) {
  if (value == null) return <span className="text-text-muted text-xs">—</span>
  const up = value >= 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium tabular-nums ${
        up ? 'bg-green/15 text-green' : 'bg-red/15 text-red'
      }`}
    >
      {up ? '+' : ''}{value.toFixed(2)}%
    </span>
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

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 3.5h8M5.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M9.5 3.5v7a1 1 0 01-1 1h-3a1 1 0 01-1-1v-7" />
    </svg>
  )
}
