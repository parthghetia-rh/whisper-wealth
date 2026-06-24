import { useApi } from '../hooks/useApi'
import { useSSE } from '../hooks/useSSE'
import HoldingsTable from '../components/HoldingsTable'
import CurrencySelector, { useDisplayCurrency } from '../components/CurrencySelector'
import RefreshSelector from '../components/RefreshSelector'
import { convertAmount, formatCurrency } from '../utils/currency'
import AllocationBreakdown from '../components/AllocationBreakdown'

export default function Dashboard() {
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

      {currencies.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              label="Portfolio Value"
              value={formatCurrency(combined.total_value, displayCurrency)}
              sub={`${combined.positions} position${combined.positions !== 1 ? 's' : ''}`}
            />
            <SummaryCard
              label="Total Gain/Loss"
              value={`${total_gain >= 0 ? '+' : ''}${formatCurrency(total_gain, displayCurrency)}`}
              sub={`${total_gain_percent >= 0 ? '+' : ''}${total_gain_percent.toFixed(2)}%`}
              color={total_gain >= 0 ? 'green' : 'red'}
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

          <div>
            <h3 className="text-sm font-medium text-text-muted mb-3">
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
          </div>

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

function SummaryCard({ label, value, sub, color }) {
  return (
    <div className="bg-surface-2 rounded-xl border border-border p-4">
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
