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
      className={`bg-surface-2 border border-border rounded-xl px-4 py-3 ${
        onClick ? 'cursor-pointer active:bg-surface-3/60 active:scale-[0.99] transition-transform' : ''
      } ${hasAction ? 'pr-12' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-1 self-stretch rounded-full shrink-0 ${up ? 'bg-green' : 'bg-red'}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-semibold">{item.ticker}</span>
              <span className="text-[10px] text-text-muted">{item.currency}</span>
            </div>
            <div className="text-[11px] text-text-muted truncate max-w-[160px]">
              {item.name}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-[15px] font-semibold tabular-nums">
            {sym}{(item.current_price ?? item.price ?? 0).toFixed(2)}
          </div>
          <div className="flex items-center gap-1.5 justify-end">
            <span className={`text-[11px] tabular-nums ${up ? 'text-green' : 'text-red'}`}>
              {up ? '+' : ''}{(item.change ?? 0).toFixed(2)}
            </span>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums ${
                up ? 'bg-green/15 text-green' : 'bg-red/15 text-red'
              }`}
            >
              {up ? '+' : ''}{(item.change_percent ?? 0).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {item.market_state && item.market_state !== 'REGULAR' && (
        <ExtendedHoursCompact item={item} sym={sym} />
      )}

      {variant === 'watchlist' && item.periodChanges && (
        <div className="flex gap-3 mt-2 pt-2 border-t border-border/30">
          {['3m', '6m', '1y'].map((p) => {
            const val = item.periodChanges[p]
            if (val == null) return null
            const pUp = val >= 0
            return (
              <div key={p} className="text-center">
                <div className="text-[9px] text-text-muted uppercase">{p}</div>
                <div className={`text-[11px] font-medium tabular-nums ${pUp ? 'text-green' : 'text-red'}`}>
                  {pUp ? '+' : ''}{val.toFixed(1)}%
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isHolding && (
        <div className="flex gap-4 mt-2 pt-2 border-t border-border/30 text-[11px] text-text-muted tabular-nums">
          <span>{sv(`${item.shares} shares`)}</span>
          <span>{sv(`Avg ${sym}${item.avg_cost?.toFixed(2)}`)}</span>
          {item.gain_loss != null && (
            <span className={item.gain_loss >= 0 ? 'text-green' : 'text-red'}>
              {sv(`${item.gain_loss >= 0 ? '+' : ''}${sym}${Math.abs(item.gain_loss).toFixed(2)}`)}
            </span>
          )}
          {item.dividend_yield > 0 && <span>Yield {item.dividend_yield.toFixed(2)}%</span>}
        </div>
      )}
    </div>
  )
}

export function StockCardSkeleton() {
  return (
    <div className="bg-surface-2 border border-border rounded-xl px-4 py-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-10 rounded-full bg-surface-3" />
          <div>
            <div className="h-4 w-16 bg-surface-3 rounded mb-1.5" />
            <div className="h-3 w-24 bg-surface-3 rounded" />
          </div>
        </div>
        <div className="text-right">
          <div className="h-4 w-16 bg-surface-3 rounded mb-1.5 ml-auto" />
          <div className="h-3 w-20 bg-surface-3 rounded ml-auto" />
        </div>
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
    <div className="flex items-center gap-1.5 justify-end mt-0.5">
      <span className="text-[9px] px-1 py-0.5 rounded bg-surface-3 text-text-muted">{isPre ? 'Pre' : 'AH'}</span>
      <span className="text-[10px] tabular-nums text-text-muted">{sym}{price.toFixed(2)}</span>
      {pct != null && (
        <span className={`text-[9px] tabular-nums ${ehUp ? 'text-green/70' : 'text-red/70'}`}>
          {ehUp ? '+' : ''}{pct.toFixed(2)}%
        </span>
      )}
    </div>
  )
}
