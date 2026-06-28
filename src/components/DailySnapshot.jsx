import { useApi } from '../hooks/useApi'
import { formatCurrency } from '../utils/currency'

export default function DailySnapshot({ displayCurrency, showValues }) {
  const { data } = useApi('/api/portfolio/snapshot')

  if (!data?.today) return null

  const { change, topMover, worstMover } = data
  const hasChange = change != null
  const up = hasChange && change.value >= 0
  const v = (val) => showValues ? val : '••••••'

  return (
    <div className="bg-surface-2 rounded-xl border border-border p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs text-text-muted mb-1">
            {hasChange ? 'Since yesterday' : 'Today'}
          </p>
          {hasChange ? (
            <div className="flex items-center gap-2.5">
              <span
                className={`text-xl font-bold tabular-nums ${up ? 'text-green' : 'text-red'}`}
              >
                {v(`${up ? '+' : ''}${formatCurrency(change.value, displayCurrency)}`)}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium tabular-nums ${
                  up ? 'bg-green/15 text-green' : 'bg-red/15 text-red'
                }`}
              >
                {up ? '+' : ''}{change.percent.toFixed(2)}%
              </span>
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              Welcome! Your first snapshot has been recorded.
            </p>
          )}
        </div>

        {(topMover || worstMover) && (
          <div className="flex gap-4">
            {topMover && topMover.change_percent > 0 && (
              <div className="text-right">
                <p className="text-[10px] text-text-muted">Top mover</p>
                <p className="text-xs font-medium">
                  {topMover.ticker}{' '}
                  <span className="text-green tabular-nums">
                    +{topMover.change_percent.toFixed(2)}%
                  </span>
                </p>
              </div>
            )}
            {worstMover && worstMover.change_percent < 0 && (
              <div className="text-right">
                <p className="text-[10px] text-text-muted">Worst</p>
                <p className="text-xs font-medium">
                  {worstMover.ticker}{' '}
                  <span className="text-red tabular-nums">
                    {worstMover.change_percent.toFixed(2)}%
                  </span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
