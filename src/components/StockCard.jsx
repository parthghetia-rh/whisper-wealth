import { currencySymbol } from '../utils/currency'

const HIDDEN = '••••••'

export default function StockCard({ item, onClick, variant = 'holding', hasAction, showValues = true }) {
  const isHolding = variant === 'holding'
  const sym = currencySymbol(item.currency || 'USD')
  const up = (item.change ?? item.change_percent ?? 0) >= 0
  const sv = (val) => showValues ? val : HIDDEN

  return (
    <div
      onClick={onClick}
      className={`bg-surface-2 border border-border rounded-xl p-3.5 flex items-center gap-3 ${
        onClick ? 'cursor-pointer active:bg-surface-3/60' : ''
      } ${hasAction ? 'pr-10' : ''}`}
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
            {item.market_state && item.market_state !== 'REGULAR' && (
              <ExtendedHoursCompact item={item} sym={sym} />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-1">
          <div className="text-[11px] text-text-muted truncate max-w-[140px]">
            {item.name}
          </div>
          <div className="flex items-center gap-2">
            {isHolding && item.gain_loss != null && (
              <span className={`text-[11px] tabular-nums ${item.gain_loss >= 0 ? 'text-green' : 'text-red'}`}>
                {sv(`${item.gain_loss >= 0 ? '+' : ''}${sym}${Math.abs(item.gain_loss).toFixed(2)}`)}
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
            <span>{sv(`${item.shares} shares`)}</span>
            <span>{sv(`Avg ${sym}${item.avg_cost?.toFixed(2)}`)}</span>
            {item.dividend_yield > 0 && <span>Yield {item.dividend_yield.toFixed(2)}%</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function ExtendedHoursCompact({ item, sym }) {
  const isPre = item.market_state === 'PRE'
  const price = isPre ? item.pre_market_price : item.post_market_price
  const pct = isPre ? item.pre_market_change_percent : item.post_market_change_percent
  if (!price) return null
  const ehUp = (pct ?? 0) >= 0
  return (
    <div className="flex items-center gap-1 justify-end mt-0.5">
      <span className="text-[9px] text-text-muted">{isPre ? 'Pre' : 'AH'}</span>
      <span className="text-[10px] tabular-nums text-text-muted">{sym}{price.toFixed(2)}</span>
      {pct != null && (
        <span className={`text-[9px] tabular-nums ${ehUp ? 'text-green/70' : 'text-red/70'}`}>
          {ehUp ? '+' : ''}{pct.toFixed(2)}%
        </span>
      )}
    </div>
  )
}
