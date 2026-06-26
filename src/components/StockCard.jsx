import { currencySymbol } from '../utils/currency'

export default function StockCard({ item, onClick, variant = 'holding' }) {
  const isHolding = variant === 'holding'
  const sym = currencySymbol(item.currency || 'USD')
  const up = (item.change ?? item.change_percent ?? 0) >= 0

  return (
    <div
      onClick={onClick}
      className={`bg-surface-2 border border-border rounded-xl p-3.5 flex items-center gap-3 ${
        onClick ? 'cursor-pointer active:bg-surface-3/60' : ''
      }`}
    >
      <div className={`w-1 h-10 rounded-full shrink-0 ${up ? 'bg-green' : 'bg-red'}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-sm font-semibold">{item.ticker}</span>
            <span className="text-[10px] text-text-muted ml-1.5 hidden xs:inline">
              {item.currency}
            </span>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold tabular-nums">
              {sym}{(item.current_price ?? item.price ?? 0).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="text-[11px] text-text-muted truncate max-w-[140px]">
            {item.name}
          </div>
          <div className="flex items-center gap-2">
            {isHolding && item.gain_loss != null && (
              <span className={`text-[11px] tabular-nums ${item.gain_loss >= 0 ? 'text-green' : 'text-red'}`}>
                {item.gain_loss >= 0 ? '+' : ''}{sym}{Math.abs(item.gain_loss).toFixed(2)}
              </span>
            )}
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums ${
                up ? 'bg-green/15 text-green' : 'bg-red/15 text-red'
              }`}
            >
              {up ? '+' : ''}
              {(item.change_percent ?? 0).toFixed(2)}%
            </span>
          </div>
        </div>

        {variant === 'watchlist' && item.periodChanges && (
          <div className="flex gap-2 mt-1.5">
            {['3m', '6m', '1y'].map((p) => {
              const val = item.periodChanges[p]
              if (val == null) return null
              const pUp = val >= 0
              return (
                <span
                  key={p}
                  className={`text-[10px] tabular-nums ${pUp ? 'text-green/70' : 'text-red/70'}`}
                >
                  {p.toUpperCase()} {pUp ? '+' : ''}{val.toFixed(1)}%
                </span>
              )
            })}
          </div>
        )}

        {isHolding && (
          <div className="flex gap-3 mt-1.5 text-[10px] text-text-muted tabular-nums">
            <span>{item.shares} shares</span>
            <span>Avg {sym}{item.avg_cost?.toFixed(2)}</span>
            {item.dividend_yield > 0 && <span>Yield {item.dividend_yield.toFixed(2)}%</span>}
          </div>
        )}
      </div>
    </div>
  )
}
