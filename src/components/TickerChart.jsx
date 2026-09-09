import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { currencySymbol } from '../utils/currency'

const RANGES = [
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
]

export default function TickerChart({ ticker, currency }) {
  const [range, setRange] = useState('1y')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const token = localStorage.getItem('folio-auth-token')
    fetch(`/api/watchlist/chart/${ticker}?range=${range}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setData(d.data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [ticker, range])

  const sym = currencySymbol(currency || 'USD')

  const firstClose = data?.[0]?.close
  const lastClose = data?.[data.length - 1]?.close
  const isUp = lastClose >= firstClose
  const changePct =
    firstClose > 0
      ? (((lastClose - firstClose) / firstClose) * 100).toFixed(2)
      : '0.00'

  return (
    <div className="min-w-0 overflow-hidden bg-surface-3/50 p-3 sm:p-4">
      <div className="mb-3 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm font-medium">{ticker}</span>
          {data && data.length > 1 && (
            <span
              className={`text-xs tabular-nums font-medium ${
                isUp ? 'text-green' : 'text-red'
              }`}
            >
              {isUp ? '+' : ''}
              {changePct}% over{' '}
              {RANGES.find((r) => r.value === range)?.label}
            </span>
          )}
        </div>
        <div
          role="group"
          aria-label={`${ticker} chart period`}
          className="grid min-w-0 w-full grid-cols-3 gap-1 overflow-hidden rounded-xl border border-border bg-surface-2/70 p-1 lg:flex lg:w-auto lg:shrink-0 lg:gap-0 lg:rounded-lg lg:p-0"
        >
          {RANGES.map((r) => (
            <button
              type="button"
              key={r.value}
              onClick={() => setRange(r.value)}
              aria-pressed={range === r.value}
              className={`min-h-10 min-w-0 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors lg:min-h-0 lg:rounded-none lg:px-2.5 lg:py-1 ${
                range === r.value
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:bg-surface-3 hover:text-text'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-44 items-center justify-center text-xs text-text-muted sm:h-40">
          Loading chart...
        </div>
      ) : !data || data.length < 2 ? (
        <div className="flex h-44 items-center justify-center text-xs text-text-muted sm:h-40">
          No data available
        </div>
      ) : (
        <div className="h-44 min-w-0 sm:h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 2, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: '#94a3b8', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
                tickMargin={6}
                tickFormatter={(d) => {
                  const dt = new Date(d)
                  if (range === '1d') {
                    return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                  }
                  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: '#94a3b8', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={45}
                tickFormatter={(v) => `${sym}${v}`}
              />
              <Tooltip content={<ChartTooltip sym={sym} intraday={range === '1d' || range === '1w'} />} />
              <Area
                type="monotone"
                dataKey="close"
                stroke={isUp ? '#22c55e' : '#ef4444'}
                strokeWidth={1.5}
                fill={`url(#grad-${ticker})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function ChartTooltip({ active, payload, sym, intraday }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm shadow-lg">
      <div className="text-text-muted text-xs">
        {intraday
          ? new Date(d.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
          : d.date}
      </div>
      <div className="font-medium tabular-nums">
        {sym}{d.close.toFixed(2)}
      </div>
    </div>
  )
}
