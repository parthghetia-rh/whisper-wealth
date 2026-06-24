import { currencySymbol } from '../utils/currency'

export default function TickerBar({ holdings }) {
  if (!holdings?.length) return null

  return (
    <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
      {holdings.map((h) => (
        <div
          key={h.ticker}
          className="flex items-center gap-3 bg-surface-2 border border-border rounded-lg px-4 py-2.5 shrink-0"
        >
          <span className="font-medium text-sm">{h.ticker}</span>
          <span className="text-xs text-text-muted">{h.currency}</span>
          <span className="text-sm tabular-nums">
            {currencySymbol(h.currency)}{h.current_price.toFixed(2)}
          </span>
          <span
            className={`text-xs tabular-nums ${h.change >= 0 ? 'text-green' : 'text-red'}`}
          >
            {h.change >= 0 ? '+' : ''}
            {h.change_percent.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  )
}
