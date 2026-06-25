import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { currencySymbol } from '../utils/currency'

const RANGES = [
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
    <div className="bg-surface-3/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
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
        <div className="flex rounded-lg border border-border overflow-hidden">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                range === r.value
                  ? 'bg-accent text-white'
                  : 'bg-surface-3 text-text-muted hover:text-text'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[160px] flex items-center justify-center text-text-muted text-xs">
          Loading chart...
        </div>
      ) : !data || data.length < 2 ? (
        <div className="h-[160px] flex items-center justify-center text-text-muted text-xs">
          No data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
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
              interval={Math.max(0, Math.floor(data.length / 6) - 1)}
              tickFormatter={(d) => {
                const dt = new Date(d)
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
            <Tooltip content={<ChartTooltip sym={sym} />} />
            <Area
              type="monotone"
              dataKey="close"
              stroke={isUp ? '#22c55e' : '#ef4444'}
              strokeWidth={1.5}
              fill={`url(#grad-${ticker})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function ChartTooltip({ active, payload, sym }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm shadow-lg">
      <div className="text-text-muted text-xs">{d.date}</div>
      <div className="font-medium tabular-nums">
        {sym}{d.close.toFixed(2)}
      </div>
    </div>
  )
}
