import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency } from '../utils/currency'

const RANGES = [
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
]

export default function PortfolioHistory({ displayCurrency, mode, onClose }) {
  const [range, setRange] = useState('1y')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const token = localStorage.getItem('folio-auth-token')
    fetch(`/api/portfolio/history?range=${range}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setData(d.data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [range])

  const dataKey = mode === 'gain' ? 'gain' : 'value'
  const label = mode === 'gain' ? 'Gain/Loss' : 'Portfolio Value'

  const first = data?.[0]?.[dataKey] ?? 0
  const last = data?.[data.length - 1]?.[dataKey] ?? 0
  const isUp = last >= first
  const change = last - first
  const changePct = first !== 0 ? ((change / Math.abs(first)) * 100).toFixed(2) : '0.00'

  return (
    <div className="bg-surface-2 rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">{label} History</h3>
          {data && data.length > 1 && (
            <p className={`text-xs tabular-nums mt-0.5 ${isUp ? 'text-green' : 'text-red'}`}>
              {isUp ? '+' : ''}{formatCurrency(change, displayCurrency)} ({isUp ? '+' : ''}{changePct}%)
              {' '}over {RANGES.find((r) => r.value === range)?.label}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
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
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l6 6M10 4l-6 6" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-[200px] flex items-center justify-center text-text-muted text-xs">
          Loading chart...
        </div>
      ) : !data || data.length < 2 ? (
        <div className="h-[200px] flex items-center justify-center text-text-muted text-xs">
          Not enough data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
            <defs>
              <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
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
              width={60}
              tickFormatter={(v) => formatCurrency(v, displayCurrency)}
            />
            <Tooltip content={<ChartTooltip displayCurrency={displayCurrency} dataKey={dataKey} />} />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={isUp ? '#22c55e' : '#ef4444'}
              strokeWidth={1.5}
              fill="url(#portfolioGrad)"
            />
            {mode === 'gain' && (
              <Area
                type="monotone"
                dataKey="cost"
                stroke="#94a3b8"
                strokeWidth={1}
                strokeDasharray="4 4"
                fill="none"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function ChartTooltip({ active, payload, displayCurrency, dataKey }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm shadow-lg">
      <div className="text-text-muted text-xs">{d.date}</div>
      <div className="font-medium tabular-nums">
        {formatCurrency(d[dataKey], displayCurrency)}
      </div>
      {dataKey === 'gain' && (
        <div className="text-text-muted text-xs tabular-nums">
          Cost: {formatCurrency(d.cost, displayCurrency)}
        </div>
      )}
    </div>
  )
}
