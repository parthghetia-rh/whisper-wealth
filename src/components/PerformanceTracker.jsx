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
        className="bg-surface-2 rounded-xl border border-border p-5 cursor-pointer hover:border-accent/50 transition-colors"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs text-text-muted mb-1">Portfolio Value</p>
            <div className="text-2xl font-bold tabular-nums">
              {v(formatCurrency(combined.total_value, displayCurrency))}
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {combined.positions} position{combined.positions !== 1 ? 's' : ''}
              {' · '}Cost {v(formatCurrency(combined.total_cost, displayCurrency))}
            </p>
          </div>

          <div className="flex gap-5 md:gap-6 flex-wrap">
            {dayGain && (
              <div className="text-right">
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Today</p>
                <p className={`text-sm font-semibold tabular-nums ${dayUp ? 'text-green' : 'text-red'}`}>
                  {v(`${dayUp ? '+' : ''}${formatCurrency(dayGain.value, displayCurrency)}`)}
                </p>
                <p className={`text-[10px] tabular-nums ${dayUp ? 'text-green/70' : 'text-red/70'}`}>
                  {dayUp ? '+' : ''}{dayGain.percent.toFixed(2)}%
                </p>
              </div>
            )}

            {weekGain && (
              <div className="text-right">
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Week</p>
                <p className={`text-sm font-semibold tabular-nums ${weekUp ? 'text-green' : 'text-red'}`}>
                  {v(`${weekUp ? '+' : ''}${formatCurrency(weekGain.value, displayCurrency)}`)}
                </p>
                <p className={`text-[10px] tabular-nums ${weekUp ? 'text-green/70' : 'text-red/70'}`}>
                  {weekUp ? '+' : ''}{weekGain.percent.toFixed(2)}%
                </p>
              </div>
            )}

            <div className="text-right">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Total</p>
              <p className={`text-sm font-semibold tabular-nums ${totalUp ? 'text-green' : 'text-red'}`}>
                {v(`${totalUp ? '+' : ''}${formatCurrency(totalGain, displayCurrency)}`)}
              </p>
              <p className={`text-[10px] tabular-nums ${totalUp ? 'text-green/70' : 'text-red/70'}`}>
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
          <div className="flex gap-4 mt-3 pt-3 border-t border-border/50">
            {data.topMover?.change_percent > 0 && (
              <span className="text-xs">
                <span className="text-text-muted">Top: </span>
                <span className="font-medium">{data.topMover.ticker}</span>{' '}
                <span className="text-green tabular-nums">+{data.topMover.change_percent.toFixed(2)}%</span>
              </span>
            )}
            {data.worstMover?.change_percent < 0 && (
              <span className="text-xs">
                <span className="text-text-muted">Worst: </span>
                <span className="font-medium">{data.worstMover.ticker}</span>{' '}
                <span className="text-red tabular-nums">{data.worstMover.change_percent.toFixed(2)}%</span>
              </span>
            )}
            <span className="text-[10px] text-text-muted ml-auto">Click for chart</span>
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
