import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useSSE } from '../hooks/useSSE'
import HoldingsTable from '../components/HoldingsTable'
import CurrencySelector, { useDisplayCurrency } from '../components/CurrencySelector'
import RefreshSelector from '../components/RefreshSelector'
import PortfolioHistory from '../components/PortfolioHistory'
import { convertAmount, formatCurrency } from '../utils/currency'
import AllocationBreakdown from '../components/AllocationBreakdown'

export default function Dashboard() {
  const [historyMode, setHistoryMode] = useState(null)
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

  const total_gain = combined.total_value - combined.total_cost
  const total_gain_percent =
    combined.total_cost > 0 ? (total_gain / combined.total_cost) * 100 : 0
  const portfolio_yield =
    combined.total_value > 0
      ? (combined.annual_dividends / combined.total_value) * 100
      : 0

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Dashboard</h2>
          <p className="text-sm text-text-muted mt-0.5">Portfolio overview</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
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

      {currencies.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              label="Portfolio Value"
              value={formatCurrency(combined.total_value, displayCurrency)}
              sub={`${combined.positions} position${combined.positions !== 1 ? 's' : ''}`}
              onClick={() => setHistoryMode(historyMode === 'value' ? null : 'value')}
            />
            <SummaryCard
              label="Total Gain/Loss"
              value={`${total_gain >= 0 ? '+' : ''}${formatCurrency(total_gain, displayCurrency)}`}
              sub={`${total_gain_percent >= 0 ? '+' : ''}${total_gain_percent.toFixed(2)}%`}
              color={total_gain >= 0 ? 'green' : 'red'}
              onClick={() => setHistoryMode(historyMode === 'gain' ? null : 'gain')}
            />
            <SummaryCard
              label="Cost Basis"
              value={formatCurrency(combined.total_cost, displayCurrency)}
            />
            <SummaryCard
              label="Yield"
              value={`${portfolio_yield.toFixed(2)}%`}
              color={portfolio_yield > 0 ? 'green' : undefined}
            />
          </div>

          {historyMode && (
            <PortfolioHistory
              displayCurrency={displayCurrency}
              mode={historyMode}
              onClose={() => setHistoryMode(null)}
            />
          )}

          <Link to="/dividends" className="block group">
            <h3 className="text-sm font-medium text-text-muted mb-3 group-hover:text-accent transition-colors">
              Projected Dividend Income
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SummaryCard
                label="Weekly"
                value={formatCurrency(combined.annual_dividends / 52, displayCurrency)}
                color="green"
              />
              <SummaryCard
                label="Monthly"
                value={formatCurrency(combined.annual_dividends / 12, displayCurrency)}
                color="green"
              />
              <SummaryCard
                label="Yearly"
                value={formatCurrency(combined.annual_dividends, displayCurrency)}
                color="green"
              />
            </div>
          </Link>

        </>
      )}

      {holdings?.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-muted mb-3">
            Allocation
          </h3>
          <AllocationBreakdown
            holdings={holdings}
            rates={rates}
            displayCurrency={displayCurrency}
          />
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-text-muted mb-3">Holdings</h3>
        <HoldingsTable holdings={holdings} />
      </div>
    </div>
  )
}

function WelcomeBanner() {
  return (
    <div className="bg-surface-2 rounded-xl border border-border p-6 space-y-5">
      <div className="flex items-center gap-3">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="1" width="34" height="34" rx="10" className="fill-accent/15 stroke-accent" strokeWidth="1.5" />
          <path d="M5 18 Q7 12, 9 18 Q11 24, 13 18" className="stroke-accent/50" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <path d="M13 18 Q14.5 14, 16 18" className="stroke-accent/70" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <rect x="18" y="20" width="3.5" height="9" rx="1.2" className="fill-accent/50" />
          <rect x="23" y="15" width="3.5" height="14" rx="1.2" className="fill-accent/75" />
          <rect x="28" y="9" width="3.5" height="20" rx="1.2" className="fill-accent" />
        </svg>
        <div>
          <h3 className="text-lg font-semibold">Welcome to WhisperWealth</h3>
          <p className="text-sm text-text-muted">Your private financial dashboard</p>
        </div>
      </div>

      <p className="text-sm text-text-muted">
        Get started by adding your first transactions. Here's how:
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface-3 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-accent/20 text-accent text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">1</span>
            <span className="text-sm font-medium">Add transactions manually</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Go to the <Link to="/transactions" className="text-accent hover:text-accent-hover">Transactions</Link> tab and
            use the form to add buy/sell entries one at a time. Enter the ticker, shares, price, and date.
          </p>
        </div>

        <div className="bg-surface-3 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-accent/20 text-accent text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">2</span>
            <span className="text-sm font-medium">Import from CSV</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Export your transaction history from your broker (Wealthsimple, Questrade, etc.) as a CSV file, then
            click <Link to="/transactions" className="text-accent hover:text-accent-hover">Import CSV</Link> on
            the Transactions page to bulk-import.
          </p>
        </div>

        <div className="bg-surface-3 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-accent/20 text-accent text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">3</span>
            <span className="text-sm font-medium">Track sitting cash</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Head to <Link to="/cash" className="text-accent hover:text-accent-hover">Sitting Cash</Link> to add
            your HISA or savings balances with interest rates. The projected interest feeds into your dividend income.
          </p>
        </div>

        <div className="bg-surface-3 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-accent/20 text-accent text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">4</span>
            <span className="text-sm font-medium">Build your watchlist</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Visit the <Link to="/watchlist" className="text-accent hover:text-accent-hover">Watchlist</Link> tab
            to track any ticker with live prices. Your portfolio stocks are added automatically.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Link
          to="/transactions"
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
        >
          Add your first transaction
        </Link>
        <span className="text-xs text-text-muted">or import a CSV</span>
      </div>
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
          color === 'green'
            ? 'text-green'
            : color === 'red'
              ? 'text-red'
              : 'text-text'
        }`}
      >
        {value}
      </div>
      {sub && (
        <div
          className={`text-xs mt-0.5 tabular-nums ${
            color === 'green'
              ? 'text-green/70'
              : color === 'red'
                ? 'text-red/70'
                : 'text-text-muted'
          }`}
        >
          {sub}
        </div>
      )}
    </div>
  )
}
