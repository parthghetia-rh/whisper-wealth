import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { formatCurrency } from '../utils/currency'
import PortfolioHistory from './PortfolioHistory'

export default function PerformanceTracker({ displayCurrency, showValues, combined }) {
  const { data } = useApi('/api/portfolio/snapshot')
  const [showChart, setShowChart] = useState(false)

  if (!combined || combined.total_value <= 0) return null

  const v = (val) => showValues ? val : '••••••'
  const totalGain = combined.total_value - combined.total_cost
  const totalGainPct = combined.total_cost > 0 ? (totalGain / combined.total_cost) * 100 : 0
  const totalUp = totalGain >= 0

  const dayGain = data?.day
  const weekGain = data?.week
  const dayUp = dayGain && dayGain.value >= 0
  const weekUp = weekGain && weekGain.value >= 0

  return (
    <div className="space-y-4">
      <div
        onClick={() => setShowChart(!showChart)}
        className="bg-surface-2/80 backdrop-blur-sm rounded-2xl border border-border/60 p-6 cursor-pointer hover:border-accent/40 transition-all duration-200"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="flex-1">
            <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5">Portfolio Value</p>
            <div className="text-3xl font-bold tabular-nums tracking-tight">
              {v(formatCurrency(combined.total_value, displayCurrency))}
            </div>
            <p className="text-[11px] text-text-muted mt-1">
              {combined.positions} position{combined.positions !== 1 ? 's' : ''}
              {' · '}Cost {v(formatCurrency(combined.total_cost, displayCurrency))}
            </p>
          </div>

          <div className="flex gap-4 md:gap-5 flex-wrap">
            {dayGain && (
              <div className="text-right bg-surface-3/30 rounded-lg px-3 py-2">
                <p className="text-[9px] text-text-muted uppercase tracking-widest mb-1">Today</p>
                <p className={`text-base font-bold tabular-nums ${dayUp ? 'text-green' : 'text-red'}`}>
                  {v(`${dayUp ? '+' : ''}${formatCurrency(dayGain.value, displayCurrency)}`)}
                </p>
                <p className={`text-[10px] tabular-nums mt-0.5 ${dayUp ? 'text-green/60' : 'text-red/60'}`}>
                  {dayUp ? '+' : ''}{dayGain.percent.toFixed(2)}%
                </p>
              </div>
            )}

            {weekGain && (
              <div className="text-right bg-surface-3/30 rounded-lg px-3 py-2">
                <p className="text-[9px] text-text-muted uppercase tracking-widest mb-1">Week</p>
                <p className={`text-base font-bold tabular-nums ${weekUp ? 'text-green' : 'text-red'}`}>
                  {v(`${weekUp ? '+' : ''}${formatCurrency(weekGain.value, displayCurrency)}`)}
                </p>
                <p className={`text-[10px] tabular-nums mt-0.5 ${weekUp ? 'text-green/60' : 'text-red/60'}`}>
                  {weekUp ? '+' : ''}{weekGain.percent.toFixed(2)}%
                </p>
              </div>
            )}

            <div className="text-right bg-surface-3/30 rounded-lg px-3 py-2">
              <p className="text-[9px] text-text-muted uppercase tracking-widest mb-1">Total</p>
              <p className={`text-base font-bold tabular-nums ${totalUp ? 'text-green' : 'text-red'}`}>
                {v(`${totalUp ? '+' : ''}${formatCurrency(totalGain, displayCurrency)}`)}
              </p>
              <p className={`text-[10px] tabular-nums mt-0.5 ${totalUp ? 'text-green/60' : 'text-red/60'}`}>
                {totalUp ? '+' : ''}{totalGainPct.toFixed(2)}%
              </p>
            </div>

            <div className="text-right">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Yield</p>
              <p className="text-sm font-semibold tabular-nums text-green">
                {combined.yield > 0 ? `${combined.yield.toFixed(2)}%` : '—'}
              </p>
            </div>
          </div>
        </div>

        {(data?.topMover || data?.worstMover) && (
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30">
            {data.topMover?.change_percent > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green" />
                <span className="text-[11px] text-text-muted">Top</span>
                <span className="text-[11px] font-medium">{data.topMover.ticker}</span>
                <span className="text-[11px] text-green tabular-nums font-medium">+{data.topMover.change_percent.toFixed(2)}%</span>
              </div>
            )}
            {data.worstMover?.change_percent < 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red" />
                <span className="text-[11px] text-text-muted">Worst</span>
                <span className="text-[11px] font-medium">{data.worstMover.ticker}</span>
                <span className="text-[11px] text-red tabular-nums font-medium">{data.worstMover.change_percent.toFixed(2)}%</span>
              </div>
            )}
            <span className="text-[9px] text-text-muted/50 ml-auto uppercase tracking-wider">Tap for chart</span>
          </div>
        )}
      </div>

      {showChart && (
        <PortfolioHistory
          displayCurrency={displayCurrency}
          mode="value"
          onClose={() => setShowChart(false)}
        />
      )}
    </div>
  )
}
