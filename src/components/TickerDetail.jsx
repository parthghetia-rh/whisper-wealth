import { useState } from 'react'
import { useApi, postApi, putApi } from '../hooks/useApi'
import { currencySymbol, formatCurrency } from '../utils/currency'

export default function TickerDetail({ quote, item, onUpdate }) {
  const [note, setNote] = useState(item?.note || '')
  const [noteSaving, setNoteSaving] = useState(false)
  const [alertPrice, setAlertPrice] = useState('')
  const [alertCondition, setAlertCondition] = useState('below')

  const { data: holdings } = useApi('/api/portfolio')
  const { data: transactions } = useApi('/api/transactions')

  if (!quote) return null

  const sym = currencySymbol(quote.currency)
  const holding = holdings?.find((h) => h.ticker === quote.ticker)
  const tickerTxns = (transactions || [])
    .filter((t) => t.ticker === quote.ticker)
    .slice(0, 5)

  const saveNote = async () => {
    setNoteSaving(true)
    try {
      await putApi(`/api/watchlist/${item.id}`, { note })
      onUpdate?.()
    } catch {}
    setNoteSaving(false)
  }

  const addAlert = async (e) => {
    e.preventDefault()
    if (!alertPrice) return
    try {
      await postApi('/api/watchlist/alerts', {
        ticker: quote.ticker,
        condition: alertCondition,
        target_price: Number(alertPrice),
      })
      setAlertPrice('')
    } catch {}
  }

  const formatVol = (v) => {
    if (!v) return '—'
    if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`
    if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
    return v.toLocaleString()
  }

  const formatCap = (v) => {
    if (!v) return '—'
    if (v >= 1e12) return `${sym}${(v / 1e12).toFixed(2)}T`
    if (v >= 1e9) return `${sym}${(v / 1e9).toFixed(2)}B`
    if (v >= 1e6) return `${sym}${(v / 1e6).toFixed(0)}M`
    return `${sym}${v.toLocaleString()}`
  }

  const w52 = quote.fifty_two_week_high && quote.fifty_two_week_low
  const w52Range = w52 ? quote.fifty_two_week_high - quote.fifty_two_week_low : 0
  const w52Pos = w52Range > 0 ? ((quote.price - quote.fifty_two_week_low) / w52Range) * 100 : 50

  return (
    <div className="bg-surface-3/30 px-4 py-3 space-y-3 text-xs">
      {holding && (
        <div className="bg-surface-2/50 rounded-lg p-3">
          <p className="text-[9px] text-text-muted uppercase tracking-widest mb-2">Your Position</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-text-muted">Shares</span>
              <div className="font-medium tabular-nums">{holding.shares}</div>
            </div>
            <div>
              <span className="text-text-muted">Avg Cost</span>
              <div className="font-medium tabular-nums">{sym}{holding.avg_cost.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-text-muted">Market Value</span>
              <div className="font-medium tabular-nums">{formatCurrency(holding.market_value, quote.currency)}</div>
            </div>
            <div>
              <span className="text-text-muted">Gain/Loss</span>
              <div className={`font-medium tabular-nums ${holding.gain_loss >= 0 ? 'text-green' : 'text-red'}`}>
                {holding.gain_loss >= 0 ? '+' : ''}{formatCurrency(holding.gain_loss, quote.currency)}
                <span className="text-text-muted ml-1">({holding.gain_loss_percent.toFixed(2)}%)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tickerTxns.length > 0 && (
        <div className="bg-surface-2/50 rounded-lg p-3">
          <p className="text-[9px] text-text-muted uppercase tracking-widest mb-2">
            Recent Transactions {tickerTxns.length < (transactions || []).filter((t) => t.ticker === quote.ticker).length && '(last 5)'}
          </p>
          <div className="space-y-1">
            {tickerTxns.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                    t.type === 'buy' ? 'bg-green/15 text-green' : 'bg-red/15 text-red'
                  }`}>
                    {t.type.toUpperCase()}
                  </span>
                  <span className="tabular-nums">{t.shares} @ {sym}{t.price_per_share.toFixed(2)}</span>
                </div>
                <span className="text-text-muted tabular-nums">{t.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <span className="text-text-muted">Market Cap</span>
          <div className="font-medium">{formatCap(quote.market_cap)}</div>
        </div>
        <div>
          <span className="text-text-muted">Volume</span>
          <div className="font-medium">
            {formatVol(quote.volume)}
            {quote.avg_volume && (
              <span className="text-text-muted ml-1">(avg {formatVol(quote.avg_volume)})</span>
            )}
          </div>
        </div>
        <div className="col-span-2">
          <span className="text-text-muted">52-Week Range</span>
          {w52 ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="tabular-nums">{sym}{quote.fifty_two_week_low.toFixed(2)}</span>
              <div className="flex-1 bg-surface-3 rounded-full h-1.5 relative">
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent"
                  style={{ left: `${Math.min(Math.max(w52Pos, 3), 97)}%` }}
                />
              </div>
              <span className="tabular-nums">{sym}{quote.fifty_two_week_high.toFixed(2)}</span>
            </div>
          ) : (
            <div className="font-medium">—</div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="text-text-muted block mb-1">Note</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveNote() }}
              placeholder="Personal note..."
              className="flex-1 bg-surface-3 border border-border rounded px-2 py-1 text-xs text-text placeholder:text-text-muted/50 outline-none focus:border-accent"
            />
            <button
              onClick={saveNote}
              disabled={noteSaving}
              className="text-[10px] text-accent hover:text-accent-hover disabled:opacity-50"
            >
              {noteSaving ? '...' : 'Save'}
            </button>
          </div>
        </div>

        <div>
          <label className="text-text-muted block mb-1">Price Alert</label>
          <form onSubmit={addAlert} className="flex gap-1.5">
            <select
              value={alertCondition}
              onChange={(e) => setAlertCondition(e.target.value)}
              className="bg-surface-3 border border-border rounded px-1.5 py-1 text-xs text-text outline-none"
            >
              <option value="below">Below</option>
              <option value="above">Above</option>
            </select>
            <input
              type="number"
              step="any"
              min="0.01"
              value={alertPrice}
              onChange={(e) => setAlertPrice(e.target.value)}
              placeholder="Price"
              className="w-20 bg-surface-3 border border-border rounded px-2 py-1 text-xs text-text placeholder:text-text-muted/50 outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!alertPrice}
              className="text-[10px] px-2 py-1 bg-accent text-white rounded disabled:opacity-50"
            >
              Set
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
