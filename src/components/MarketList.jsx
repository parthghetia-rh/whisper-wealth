import { currencySymbol } from '../utils/currency'

export default function MarketList({ holdings }) {
  if (!holdings?.length) return null

  const sorted = [...holdings].sort((a, b) => {
    if (a.currency !== b.currency) return a.currency.localeCompare(b.currency)
    return Math.abs(b.change_percent) - Math.abs(a.change_percent)
  })

  return (
    <div className="bg-surface-2 rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
            <th className="text-left p-2.5 pl-4">Ticker</th>
            <th className="text-right p-2.5">Price</th>
            <th className="text-right p-2.5">Change</th>
            <th className="text-right p-2.5 pr-4">% Change</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((h) => {
            const sym = currencySymbol(h.currency)
            const up = h.change >= 0
            return (
              <tr
                key={h.ticker}
                className="border-b border-border/30 hover:bg-surface-3/40 transition-colors"
              >
                <td className="p-2.5 pl-4">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-1.5 h-6 rounded-full ${up ? 'bg-green' : 'bg-red'}`}
                    />
                    <div>
                      <div className="font-medium text-sm">{h.ticker}</div>
                      <div className="text-[11px] text-text-muted truncate max-w-[160px]">
                        {h.name}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="text-right p-2.5 tabular-nums font-medium">
                  {sym}{h.current_price.toFixed(2)}
                </td>
                <td className="text-right p-2.5 tabular-nums">
                  <span className={up ? 'text-green' : 'text-red'}>
                    {up ? '+' : ''}{sym}{Math.abs(h.change).toFixed(2)}
                  </span>
                </td>
                <td className="text-right p-2.5 pr-4">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium tabular-nums ${
                      up ? 'bg-green/15 text-green' : 'bg-red/15 text-red'
                    }`}
                  >
                    {up ? (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M5 2L8.5 6.5H1.5z" />
                      </svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M5 8L1.5 3.5H8.5z" />
                      </svg>
                    )}
                    {up ? '+' : ''}{h.change_percent.toFixed(2)}%
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
