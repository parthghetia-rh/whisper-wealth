import { lazy, Suspense, useState } from 'react'
import ActionSheet from './ActionSheet'
import StockCard from './StockCard'
import { useApi } from '../hooks/useApi'
import { useHousehold } from '../context/HouseholdContext'
import { formatCurrency } from '../utils/currency'

const TickerChart = lazy(() => import('./TickerChart'))

export function matchingTickers(holdings, watchlist, query) {
  const items = new Map()
  for (const item of [...holdings, ...watchlist]) {
    if (!items.has(item.ticker)) items.set(item.ticker, { ...item, name: item.name || item.quote?.name || item.ticker })
  }
  const needle = query.trim().toUpperCase()
  return [...items.values()].filter((item) => `${item.ticker} ${item.name}`.toUpperCase().includes(needle)).slice(0, 8)
}

export default function TickerSearch({ open, onClose }) {
  return <ActionSheet open={open} onClose={onClose} title="Search tickers" description="Find a chart and your position in the current portfolio view." size="3xl">
    {open && <SearchContent />}
  </ActionSheet>
}

function SearchContent() {
  const { scopedUrl } = useHousehold()
  const { data: holdings, loading: holdingsLoading, error: holdingsError } = useApi(scopedUrl('/api/portfolio'))
  const { data: watchlist } = useApi('/api/watchlist')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')
  const [validation, setValidation] = useState('')
  const choose = (value) => {
    const ticker = value.trim().toUpperCase()
    if (!/^[A-Z0-9.\-=]{1,20}$/.test(ticker)) {
      setValidation('Enter a ticker such as IBM, AAPL, or XEQT.TO.')
      return
    }
    setValidation('')
    setQuery(ticker)
    setSelected(ticker)
  }
  const matches = matchingTickers(holdings || [], watchlist?.items || [], query)
  return <div className="space-y-4">
    <form onSubmit={(event) => { event.preventDefault(); choose(query) }} className="flex min-w-0 gap-2">
      <input autoFocus aria-label="Ticker or company in your portfolio" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search IBM, Apple, XEQT.TO…" maxLength={80} className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface-3 px-3 text-sm outline-none focus:border-accent" />
      <button type="submit" disabled={!query.trim()} className="min-h-11 shrink-0 rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-50">Search</button>
    </form>
    {validation && <p role="alert" className="text-sm text-red">{validation}</p>}
    {matches.length > 0 && <div>
      <p className="mb-2 text-xs text-text-muted">Your holdings and watchlist</p>
      <div className="grid gap-2 sm:grid-cols-2">{matches.map((item) => <button type="button" key={item.ticker} onClick={() => choose(item.ticker)} className="min-w-0 rounded-lg border border-border px-3 py-2 text-left hover:bg-surface-3">
        <span className="block text-sm font-semibold">{item.ticker}</span><span className="block truncate text-xs text-text-muted">{item.name}</span>
      </button>)}</div>
    </div>}
    {!selected && <p className="text-xs text-text-muted">Search an exact ticker to look beyond your portfolio. Use the exchange suffix for Canadian listings, such as .TO.</p>}
    {selected && <SearchResult key={selected} ticker={selected} holdings={holdings} holdingsLoading={holdingsLoading} holdingsError={holdingsError} />}
  </div>
}

function SearchResult({ ticker, holdings, holdingsLoading, holdingsError }) {
  const { data: quote, loading, error, refetch } = useApi(`/api/watchlist/quote/${encodeURIComponent(ticker)}`)
  const holding = holdings?.find((item) => item.ticker === ticker)
  return <div className="space-y-3">
    {loading && <p role="status" className="text-sm text-text-muted">Loading {ticker}…</p>}
    {error && <div role="alert" className="text-sm text-red">{error} <button type="button" onClick={refetch} className="underline">Retry</button></div>}
    {quote && <StockCard item={quote} variant="watchlist" />}
    {quote && <div className="overflow-hidden rounded-xl border border-border"><Suspense fallback={<p role="status" className="p-4 text-sm text-text-muted">Loading chart…</p>}><TickerChart ticker={ticker} currency={quote.currency} /></Suspense></div>}
    <section className="rounded-xl border border-border p-4">
      <h3 className="mb-3 text-sm font-semibold">Your holdings · current portfolio view</h3>
      {holdingsLoading ? <p role="status" className="text-sm text-text-muted">Loading holdings…</p> : holdingsError ? <p role="alert" className="text-sm text-red">{holdingsError}</p> : holding ? <>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Shares" value={holding.shares} />
          <Metric label="Average cost" value={formatCurrency(holding.avg_cost, holding.currency)} />
          <Metric label="Market value" value={holding.market_value == null ? 'Unavailable' : formatCurrency(holding.market_value, holding.currency)} />
          <Metric label="Gain / loss" value={holding.gain_loss == null ? 'Unavailable' : formatCurrency(holding.gain_loss, holding.currency)} />
        </div>
        {holding.owners?.length > 0 && <div className="mt-3 border-t border-border pt-3 text-xs text-text-muted">{holding.owners.map((owner) => <p key={owner.owner_scope}>{owner.owner_name}: {owner.shares} shares</p>)}</div>}
      </> : <p className="text-sm text-text-muted">You don’t hold {ticker} in this portfolio view.</p>}
    </section>
  </div>
}

function Metric({ label, value }) {
  return <div className="min-w-0"><p className="text-xs text-text-muted">{label}</p><p className="mt-1 break-words text-sm font-medium tabular-nums">{value}</p></div>
}

export function SearchIcon() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
}
