import { useApi } from '../hooks/useApi'
import DividendTable from '../components/DividendTable'
import { DividendComparisonChart } from '../components/DividendChart'
import CurrencySelector, { useDisplayCurrency } from '../components/CurrencySelector'
import { convertAmount, formatCurrency } from '../utils/currency'

export default function Dividends() {
  const { data: income } = useApi('/api/dividends/income')
  const { data: ratesData } = useApi('/api/portfolio/rates')

  const currencies = income?.currencies || []
  const rates = ratesData?.rates || { USD: 1 }
  const availableCurrencies = currencies.map((c) => c.currency)
  const [displayCurrency, setDisplayCurrency] = useDisplayCurrency(availableCurrencies)

  const combined = currencies.reduce(
    (acc, c) => {
      acc.annual += convertAmount(c.total_annual, c.currency, displayCurrency, rates)
      return acc
    },
    { annual: 0 }
  )

  const allHoldings = currencies.flatMap((c) => c.holdings)

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Dividends</h2>
          <p className="text-sm text-text-muted mt-0.5">
            Projected income based on last 12 months of actual payments
          </p>
        </div>
        {availableCurrencies.length > 1 && (
          <CurrencySelector
            currencies={availableCurrencies}
            selected={displayCurrency}
            onChange={setDisplayCurrency}
          />
        )}
      </div>

      {currencies.length > 0 && (
        <>
          <div>
            <h3 className="text-sm font-medium text-text-muted mb-3">
              Combined Projected Income
              {availableCurrencies.length > 1 && (
                <span className="text-text-muted/60 ml-1">
                  (in {displayCurrency})
                </span>
              )}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SummaryCard
                label="Weekly"
                value={formatCurrency(combined.annual / 52, displayCurrency)}
              />
              <SummaryCard
                label="Monthly"
                value={formatCurrency(combined.annual / 12, displayCurrency)}
              />
              <SummaryCard
                label="Yearly"
                value={formatCurrency(combined.annual, displayCurrency)}
              />
            </div>
          </div>

          {allHoldings.length > 1 && (
            <div>
              <h3 className="text-sm font-medium text-text-muted mb-3">
                Comparison
              </h3>
              <DividendComparisonChart holdings={allHoldings} />
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-text-muted mb-3">
              By Holding
            </h3>
            <DividendTable holdings={allHoldings} />
          </div>
        </>
      )}

      {currencies.length === 0 && (
        <div className="bg-surface-2 rounded-xl border border-border p-8 text-center text-text-muted">
          No dividend data yet. Add stocks that pay dividends.
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div className="bg-surface-2 rounded-xl border border-border p-4">
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-green">
        {value}
      </div>
    </div>
  )
}
