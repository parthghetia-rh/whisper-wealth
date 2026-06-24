import { useState, useEffect, useRef } from 'react'
import { postApi } from '../hooks/useApi'

const INTERVALS = [
  { label: '30s', value: 30_000 },
  { label: '1m', value: 60_000 },
  { label: '2m', value: 120_000 },
  { label: '5m', value: 300_000 },
  { label: 'Off', value: 0 },
]

const STORAGE_KEY = 'portfolio-refresh-interval'

export default function RefreshSelector({ onTick }) {
  const [interval, setIntervalMs] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? Number(saved) : 300_000
  })
  const [lastRefresh, setLastRefresh] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const onTickRef = useRef(onTick)
  onTickRef.current = onTick

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(interval))
  }, [interval])

  useEffect(() => {
    if (!interval) return

    const tick = async () => {
      setRefreshing(true)
      try {
        await postApi('/api/portfolio/quick-refresh', {})
      } catch {}
      await new Promise((r) => setTimeout(r, 2000))
      onTickRef.current?.()
      setLastRefresh(new Date())
      setRefreshing(false)
    }

    const id = setInterval(tick, interval)
    return () => clearInterval(id)
  }, [interval])

  const handleManualRefresh = async () => {
    setRefreshing(true)
    try {
      await postApi('/api/portfolio/quick-refresh', {})
    } catch {}
    await new Promise((r) => setTimeout(r, 2000))
    onTickRef.current?.()
    setLastRefresh(new Date())
    setRefreshing(false)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleManualRefresh}
        disabled={refreshing}
        className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-3 transition-colors disabled:opacity-50"
        title="Refresh now"
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

      <div className="flex rounded-lg border border-border overflow-hidden">
        {INTERVALS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setIntervalMs(opt.value)}
            className={`px-2 py-1 text-[11px] font-medium transition-colors ${
              interval === opt.value
                ? 'bg-accent text-white'
                : 'bg-surface-3 text-text-muted hover:text-text'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {lastRefresh && (
        <span className="text-[10px] text-text-muted tabular-nums">
          {lastRefresh.toLocaleTimeString()}
        </span>
      )}
    </div>
  )
}
