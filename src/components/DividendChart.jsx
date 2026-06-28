import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
} from 'recharts'
import { currencySymbol } from '../utils/currency'

const COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#a855f7',
]

export function DividendComparisonChart({ holdings }) {
  const navigate = useNavigate()

  if (!holdings?.length) return null

  const data = holdings
    .filter((h) => h.annual_income > 0)
    .sort((a, b) => b.annual_income - a.annual_income)
    .map((h, i) => ({
      ticker: h.ticker,
      income: h.annual_income,
      yield: h.dividend_yield,
      currency: h.currency,
      color: COLORS[i % COLORS.length],
    }))

  if (!data.length) return null

  return (
    <div className="bg-surface-2 rounded-xl border border-border p-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-text-muted mb-3">
            Annual Income by Holding
          </p>
          <div className="space-y-2">
            {data.map((d) => {
              const maxIncome = data[0].income
              const pct = maxIncome > 0 ? (d.income / maxIncome) * 100 : 0
              return (
                <div
                  key={d.ticker}
                  className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate(`/watchlist?ticker=${d.ticker}`)}
                >
                  <span className="text-xs font-medium w-16 shrink-0">
                    {d.ticker}
                  </span>
                  <div className="flex-1 bg-surface-3 rounded-full h-5 relative overflow-hidden">
                    <div
                      className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                      style={{
                        width: `${Math.max(pct, 8)}%`,
                        backgroundColor: d.color,
                      }}
                    >
                      <span className="text-[10px] font-medium text-white whitespace-nowrap">
                        {currencySymbol(d.currency)}
                        {d.income.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <p className="text-xs text-text-muted mb-3">Dividend Yield</p>
          <ResponsiveContainer width="100%" height={data.length * 40 + 10}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
            >
              <XAxis
                type="number"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="ticker"
                tick={{ fill: '#e2e8f0', fontSize: 11, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip
                content={<YieldTooltip />}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar
                dataKey="yield"
                radius={[0, 4, 4, 0]}
                barSize={20}
                className="cursor-pointer"
                onClick={(entry) => navigate(`/watchlist?ticker=${entry.ticker}`)}
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export function DividendHistoryChart({ history, currency }) {
  if (!history?.length) return null

  const sym = currencySymbol(currency)
  const data = [...history]
    .reverse()
    .map((d) => {
      const date = new Date(d.ex_date)
      return {
        label: date.toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        }),
        amount: d.amount,
        ex_date: d.ex_date,
      }
    })

  const maxAmount = Math.max(...data.map((d) => d.amount))
  const minAmount = Math.min(...data.map((d) => d.amount))
  const isGrowing = data.length >= 2 && data[data.length - 1].amount > data[0].amount

  return (
    <div className="px-4 pb-4 pt-2">
      <ResponsiveContainer width="100%" height={100}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 5, bottom: 0, left: 5 }}
        >
          <XAxis
            dataKey="label"
            tick={{ fill: '#94a3b8', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            interval={Math.max(0, Math.floor(data.length / 6) - 1)}
          />
          <YAxis
            hide
            domain={[minAmount * 0.9, maxAmount * 1.1]}
          />
          <Tooltip
            content={<HistoryTooltip sym={sym} />}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          />
          <Bar dataKey="amount" radius={[3, 3, 0, 0]} barSize={16}>
            {data.map((entry, i) => {
              const ratio = maxAmount > minAmount
                ? (entry.amount - minAmount) / (maxAmount - minAmount)
                : 1
              const opacity = 0.4 + ratio * 0.6
              return (
                <Cell
                  key={i}
                  fill={isGrowing ? '#22c55e' : '#6366f1'}
                  fillOpacity={opacity}
                />
              )
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function YieldTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm shadow-lg">
      <div className="font-medium">{d.ticker}</div>
      <div className="text-text-muted tabular-nums">{d.yield.toFixed(2)}%</div>
    </div>
  )
}

function HistoryTooltip({ active, payload, sym }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm shadow-lg">
      <div className="text-text-muted text-xs">{d.ex_date}</div>
      <div className="font-medium tabular-nums">
        {sym}{d.amount.toFixed(4)}/share
      </div>
    </div>
  )
}
