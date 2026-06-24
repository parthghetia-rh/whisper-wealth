import { currencySymbol } from '../utils/currency'
import { DividendHistoryChart } from './DividendChart'

export default function DividendTable({ holdings }) {
  if (!holdings?.length) {
    return (
      <div className="bg-surface-2 rounded-xl border border-border p-8 text-center text-text-muted">
        No dividend data yet. Add stocks that pay dividends.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {holdings.map((h) => {
        const sym = currencySymbol(h.currency)
        return (
          <div
            key={h.ticker}
            className="bg-surface-2 rounded-xl border border-border overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-3">
              <div>
                <span className="font-medium">{h.ticker}</span>
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
