import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useApi, putApi } from '../hooks/useApi'
import { useSSE } from '../hooks/useSSE'
import HoldingsTable from '../components/HoldingsTable'
import CurrencySelector, { useDisplayCurrency } from '../components/CurrencySelector'
import RefreshSelector from '../components/RefreshSelector'
import { convertAmount, formatCurrency } from '../utils/currency'
import AllocationBreakdown from '../components/AllocationBreakdown'
import PerformanceTracker from '../components/PerformanceTracker'
import DashboardWatchlist from '../components/DashboardWatchlist'

const HIDDEN = '••••••'

const DEFAULT_MODULE_ORDER = ['performance', 'dividends', 'allocation', 'holdings']

export default function Dashboard() {
  const [showValues, setShowValues] = useState(() => {
    return localStorage.getItem('portfolio-show-values') !== 'false'
  })
  const [moduleOrder, setModuleOrder] = useState(() => {
    try {
      const saved = localStorage.getItem('dashboard-module-order')
      if (saved) {
        const order = JSON.parse(saved)
        if (order.length === DEFAULT_MODULE_ORDER.length && order.every((m) => DEFAULT_MODULE_ORDER.includes(m))) {
          return order
        }
      }
    } catch {}
    return DEFAULT_MODULE_ORDER
  })
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)

  const toggleValues = () => {
    const next = !showValues
    setShowValues(next)
    localStorage.setItem('portfolio-show-values', String(next))
  }

  const v = (val) => showValues ? val : HIDDEN
  const { data: summary, refetch: refetchSummary } = useApi('/api/portfolio/summary')
  const { data: holdings, refetch: refetchHoldings } = useApi('/api/portfolio')
  const { data: ratesData, refetch: refetchRates } = useApi('/api/portfolio/rates')

  const refetchAll = () => {
    refetchSummary()
    refetchHoldings()
    refetchRates()
  }

  useSSE('/api/portfolio/sse', refetchAll)

  const currencies = summary?.currencies || []
  const rates = ratesData?.rates || { USD: 1 }
  const availableCurrencies = currencies.map((c) => c.currency)
  const [displayCurrency, setDisplayCurrency] = useDisplayCurrency(availableCurrencies)

  const combined = currencies.reduce(
    (acc, c) => {
      acc.total_value += convertAmount(c.total_value, c.currency, displayCurrency, rates)
      acc.total_cost += convertAmount(c.total_cost, c.currency, displayCurrency, rates)
      acc.annual_dividends += convertAmount(c.annual_dividends, c.currency, displayCurrency, rates)
      acc.positions += c.positions
      return acc
    },
    { total_value: 0, total_cost: 0, annual_dividends: 0, positions: 0 }
  )

  const portfolio_yield =
    combined.total_value > 0
      ? (combined.annual_dividends / combined.total_value) * 100
      : 0

  const handleDragStart = (e, idx) => {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverIdx(idx)
  }
  const handleDrop = (e, idx) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const updated = [...moduleOrder]
    const [moved] = updated.splice(dragIdx, 1)
    updated.splice(idx, 0, moved)
    setModuleOrder(updated)
    localStorage.setItem('dashboard-module-order', JSON.stringify(updated))
    setDragIdx(null)
    setOverIdx(null)
  }
  const handleDragEnd = () => { setDragIdx(null); setOverIdx(null) }

  const modules = {
    performance: (
      <PerformanceTracker
        displayCurrency={displayCurrency}
        showValues={showValues}
        combined={{ ...combined, yield: portfolio_yield }}
      />
    ),
    dividends: currencies.length > 0 ? (
      <Link to="/dividends" className="block group">
        <h3 className="text-sm font-medium text-text-muted mb-3 group-hover:text-accent transition-colors">
          Projected Dividend Income
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard label="Weekly" value={v(formatCurrency(combined.annual_dividends / 52, displayCurrency))} color="green" />
          <SummaryCard label="Monthly" value={v(formatCurrency(combined.annual_dividends / 12, displayCurrency))} color="green" />
          <SummaryCard label="Yearly" value={v(formatCurrency(combined.annual_dividends, displayCurrency))} color="green" />
        </div>
      </Link>
    ) : null,
    allocation: holdings?.length > 0 ? (
      <div>
        <h3 className="text-sm font-medium text-text-muted mb-3">Allocation</h3>
        <AllocationBreakdown holdings={holdings} rates={rates} displayCurrency={displayCurrency} showValues={showValues} />
      </div>
    ) : null,
    holdings: (
      <DashboardWatchlist holdings={holdings} showValues={showValues} />
    ),
  }

  const moduleLabels = {
    performance: 'Overview',
    dividends: 'Dividends',
    allocation: 'Allocation',
    holdings: 'Holdings',
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Dashboard</h2>
          <p className="text-sm text-text-muted mt-0.5">Portfolio overview</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={toggleValues}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-text-muted hover:text-text hover:bg-surface-3 transition-colors"
            title={showValues ? 'Hide values' : 'Show values'}
          >
            {showValues ? <EyeIcon /> : <EyeOffIcon />}
            {showValues ? 'Hide' : 'Show'}
          </button>
          <RefreshSelector onTick={refetchAll} />
          {availableCurrencies.length > 1 && (
            <CurrencySelector
              currencies={availableCurrencies}
              selected={displayCurrency}
              onChange={setDisplayCurrency}
            />
          )}
        </div>
      </div>

      {currencies.length === 0 && !holdings?.length && (
        <WelcomeBanner />
      )}

      {moduleOrder.map((key, idx) => {
        const content = modules[key]
        if (!content) return null
        return (
          <div
            key={key}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            className={`group relative ${dragIdx === idx ? 'opacity-40' : ''} ${
              overIdx === idx && dragIdx !== idx ? 'border-t-2 border-accent rounded-t-lg' : ''
            }`}
          >
            <div className="absolute -left-6 top-2 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
              <svg width="10" height="16" viewBox="0 0 8 14" fill="currentColor" className="text-text-muted/30">
                <circle cx="2" cy="2" r="1.2" /><circle cx="6" cy="2" r="1.2" />
                <circle cx="2" cy="7" r="1.2" /><circle cx="6" cy="7" r="1.2" />
                <circle cx="2" cy="12" r="1.2" /><circle cx="6" cy="12" r="1.2" />
              </svg>
            </div>
            {content}
          </div>
        )
      })}
    </div>
  )
}

function SummaryCard({ label, value, sub, color, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-surface-2 rounded-xl border border-border p-4 ${
        onClick ? 'cursor-pointer hover:border-accent/50 transition-colors' : ''
      }`}
    >
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <div
        className={`text-lg font-semibold tabular-nums ${
          color === 'green' ? 'text-green' : color === 'red' ? 'text-red' : 'text-text'
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className={`text-xs mt-0.5 tabular-nums ${
          color === 'green' ? 'text-green/70' : color === 'red' ? 'text-red/70' : 'text-text-muted'
        }`}>
          {sub}
        </div>
      )}
    </div>
  )
}

function WelcomeBanner() {
  return (
    <div className="bg-surface-2 rounded-xl border border-border p-6 space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Welcome to WhisperWealth</h3>
        <p className="text-sm text-text-muted">Your private financial dashboard</p>
      </div>
      <p className="text-sm text-text-muted">Get started by adding your first transactions.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface-3 rounded-lg p-4 space-y-2">
          <span className="text-sm font-medium">Add transactions manually</span>
          <p className="text-xs text-text-muted leading-relaxed">
            Go to <Link to="/transactions" className="text-accent hover:text-accent-hover">Transactions</Link> and enter buy/sell entries.
          </p>
        </div>
        <div className="bg-surface-3 rounded-lg p-4 space-y-2">
          <span className="text-sm font-medium">Import from CSV or PDF</span>
          <p className="text-xs text-text-muted leading-relaxed">
            Click <Link to="/transactions" className="text-accent hover:text-accent-hover">Import File</Link> on the Transactions page.
          </p>
        </div>
      </div>
      <Link to="/transactions" className="inline-block px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors">
        Add your first transaction
      </Link>
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
