import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { formatCurrency } from '../utils/currency'

const PERIODS = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
]

export default function PerformanceTracker({ displayCurrency, showValues }) {
  const { data } = useApi('/api/portfolio/snapshot')
  const [period, setPeriod] = useState('day')

  if (!data?.today) return null

  const v = (val) => showValues ? val : '••••••'
  const change = data[period]
  const hasChange = change != null
  const up = hasChange && change.value >= 0

  return (
    <div className="bg-surface-2 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs text-text-muted uppercase tracking-wider">Performance</h3>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                period === p.key
                  ? 'bg-accent text-white'
                  : 'bg-surface-3 text-text-muted hover:text-text'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          {hasChange ? (
            <>
              <div className={`text-xl font-bold tabular-nums ${up ? 'text-green' : 'text-red'}`}>
                {v(`${up ? '+' : ''}${formatCurrency(change.value, displayCurrency)}`)}
              </div>
              <div className={`text-xs tabular-nums mt-0.5 ${up ? 'text-green/70' : 'text-red/70'}`}>
                {up ? '+' : ''}{change.percent.toFixed(2)}%
              </div>
            </>
          ) : (
            <div className="text-sm text-text-muted">
              Not enough data for {PERIODS.find((p) => p.key === period)?.label.toLowerCase()} view
            </div>
          )}
        </div>

        {data.topMover && data.worstMover && (
          <div className="flex gap-4 text-right">
            {data.topMover.change_percent > 0 && (
              <div>
                <p className="text-[10px] text-text-muted">Top</p>
                <p className="text-xs font-medium">
                  {data.topMover.ticker}{' '}
                  <span className="text-green tabular-nums">+{data.topMover.change_percent.toFixed(2)}%</span>
                </p>
              </div>
            )}
            {data.worstMover.change_percent < 0 && (
              <div>
                <p className="text-[10px] text-text-muted">Worst</p>
                <p className="text-xs font-medium">
                  {data.worstMover.ticker}{' '}
                  <span className="text-red tabular-nums">{data.worstMover.change_percent.toFixed(2)}%</span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
