import { useState } from 'react'
import { postApi } from '../hooks/useApi'

export default function TransactionForm({ onAdded }) {
  const [form, setForm] = useState({
    ticker: '',
    type: 'buy',
    shares: '',
    price_per_share: '',
    date: new Date().toISOString().split('T')[0],
  })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await postApi('/api/transactions', {
        ...form,
        shares: Number(form.shares),
        price_per_share: Number(form.price_per_share),
      })
      setForm({
        ticker: '',
        type: 'buy',
        shares: '',
        price_per_share: '',
        date: new Date().toISOString().split('T')[0],
      })
      onAdded?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface-2 rounded-xl border border-border p-5"
    >
      <h3 className="text-sm font-medium mb-4">Add Transaction</h3>
      {error && (
        <div className="text-red text-xs mb-3 bg-red/10 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div>
          <label className="block text-xs text-text-muted mb-1">Ticker</label>
          <input
            type="text"
            value={form.ticker}
            onChange={(e) =>
              setForm({ ...form, ticker: e.target.value.toUpperCase() })
            }
            placeholder="AAPL"
            required
            className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 outline-none focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Type</label>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'buy' })}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                form.type === 'buy'
                  ? 'bg-green/15 text-green'
                  : 'bg-surface-3 text-text-muted hover:text-text'
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: 'sell' })}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                form.type === 'sell'
                  ? 'bg-red/15 text-red'
                  : 'bg-surface-3 text-text-muted hover:text-text'
              }`}
            >
              Sell
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Shares</label>
          <input
            type="number"
            step="any"
            min="0.0001"
            value={form.shares}
            onChange={(e) => setForm({ ...form, shares: e.target.value })}
            placeholder="10"
            required
            className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 outline-none focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">
            Price per Share
          </label>
          <input
            type="number"
            step="any"
            min="0.01"
            value={form.price_per_share}
            onChange={(e) =>
              setForm({ ...form, price_per_share: e.target.value })
            }
            placeholder="150.00"
            required
            className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 outline-none focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
            className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-hover text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    </form>
  )
}
