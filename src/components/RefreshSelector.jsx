import { useState } from 'react'
import { postApi } from '../hooks/useApi'

export default function RefreshSelector({ onTick }) {
  const [lastRefresh, setLastRefresh] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const doRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    setError(null)
    try {
      const result = await postApi('/api/portfolio/quick-refresh', {})
      setLastRefresh(result?.as_of ? new Date(result.as_of) : new Date())
      onTick?.(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={doRefresh}
        disabled={refreshing}
        className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-3 transition-colors disabled:opacity-50"
        title="Refresh market data now"
      >
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          className={refreshing ? 'animate-spin' : ''}
        >
          <path d="M1.5 7a5.5 5.5 0 019.5-3.5M12.5 7a5.5 5.5 0 01-9.5 3.5" />
          <path d="M11 1v2.5h-2.5M3 11v-2.5h2.5" />
        </svg>
      </button>
      {lastRefresh && (
        <span className="text-[10px] text-text-muted tabular-nums">
          {lastRefresh.toLocaleTimeString()}
        </span>
      )}
      {error && <span className="text-[10px] text-red">{error}</span>}
    </div>
  )
}
