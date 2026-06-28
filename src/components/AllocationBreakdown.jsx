import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { convertAmount, formatCurrency } from '../utils/currency'

const COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#a855f7',
  '#0ea5e9', '#84cc16', '#e11d48', '#7c3aed', '#10b981',
]

const HIDDEN = '••••••'

export default function AllocationBreakdown({
  holdings,
  rates,
  displayCurrency,
}) {
  const navigate = useNavigate()

  const [showValues, setShowValues] = useState(() => {
    return localStorage.getItem('portfolio-show-values') !== 'false'
  })

  const toggle = () => {
    const next = !showValues
    setShowValues(next)
    localStorage.setItem('portfolio-show-values', String(next))
  }

  if (!holdings?.length) return null

  const totalValue = holdings.reduce((sum, h) => {
    return sum + convertAmount(h.market_value, h.currency, displayCurrency, rates)
  }, 0)

  if (totalValue <= 0) return null

  const items = holdings
    .map((h, i) => {
      const converted = convertAmount(h.market_value, h.currency, displayCurrency, rates)
      const pct = (converted / totalValue) * 100
      return {
        ticker: h.ticker,
        name: h.name,
        currency: h.currency,
        nativeValue: h.market_value,
        value: converted,
        percent: pct,
        color: COLORS[i % COLORS.length],
      }
    })
    .sort((a, b) => b.value - a.value)

  return (
    <div className="bg-surface-2 rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div />
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-text-muted hover:text-text hover:bg-surface-3 transition-colors"
          title={showValues ? 'Hide values' : 'Show values'}
        >
          {showValues ? <EyeIcon /> : <EyeOffIcon />}
          {showValues ? 'Hide values' : 'Show values'}
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-56 shrink-0 flex items-center justify-center">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={items}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                dataKey="value"
                stroke="none"
                paddingAngle={2}
              >
                {items.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.color}
                    className="cursor-pointer"
                    onClick={() => navigate(`/watchlist?ticker=${entry.ticker}`)}
                  />
                ))}
              </Pie>
              <Tooltip
                content={
                  <ChartTooltip
                    displayCurrency={displayCurrency}
                    showValues={showValues}
                  />
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 min-w-0">
          <div className="space-y-1.5">
            {items.map((item) => (
              <div
                key={item.ticker}
                onClick={() => navigate(`/watchlist?ticker=${item.ticker}`)}
                className="flex items-center gap-3 py-1.5 group cursor-pointer hover:bg-surface-3/30 rounded-lg px-1 -mx-1 transition-colors"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{item.ticker}</span>
                    <span className="text-xs text-text-muted ml-1.5 hidden sm:inline truncate">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 tabular-nums text-sm">
                    <span className="text-text-muted text-xs">
                      {showValues
                        ? formatCurrency(item.value, displayCurrency)
                        : HIDDEN}
                    </span>
                    <div className="w-24 bg-surface-3 rounded-full h-1.5 hidden md:block">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${item.percent}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                    <span className="font-medium w-14 text-right">
                      {item.percent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload, displayCurrency, showValues }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm shadow-lg">
      <div className="font-medium">{d.ticker}</div>
      <div className="text-text-muted tabular-nums">
        {showValues
          ? `${formatCurrency(d.value, displayCurrency)} (${d.percent.toFixed(1)}%)`
          : `${d.percent.toFixed(1)}%`}
      </div>
    </div>
  )
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" />
      <circle cx="7" cy="7" r="2" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 2l10 10M5.6 5.6a2 2 0 002.8 2.8M1 7s2.5-4 6-4c.8 0 1.5.2 2.2.5M13 7s-1.2 1.9-3 3" />
    </svg>
  )
}
