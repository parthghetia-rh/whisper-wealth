import { useState } from 'react'
import { useApi, postApi, putApi, deleteApi } from '../hooks/useApi'
import { currencySymbol, formatCurrency } from '../utils/currency'

export default function Cash() {
  const { data: positions, refetch } = useApi('/api/cash')
  const { data: summary, refetch: refetchSummary } = useApi('/api/cash/summary')

  const [form, setForm] = useState({
    label: '',
    currency: 'CAD',
    amount: '',
    interest_rate: '',
  })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await postApi('/api/cash', {
        ...form,
        amount: Number(form.amount),
        interest_rate: Number(form.interest_rate),
      })
      setForm({ label: '', currency: 'CAD', amount: '', interest_rate: '' })
      refetch()
      refetchSummary()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    await deleteApi(`/api/cash/${id}`)
    refetch()
    refetchSummary()
  }

  const startEdit = (p) => {
    setEditingId(p.id)
    setEditForm({
      label: p.label,
      currency: p.currency,
      amount: String(p.amount),
      interest_rate: String(p.interest_rate),
    })
  }

  const saveEdit = async () => {
    try {
      await putApi(`/api/cash/${editingId}`, {
        ...editForm,
        amount: Number(editForm.amount),
        interest_rate: Number(editForm.interest_rate),
      })
      setEditingId(null)
      setEditForm(null)
      refetch()
      refetchSummary()
    } catch (err) {
      setError(err.message)
    }
  }

  const currencies = summary?.currencies || []

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-xl font-semibold">Sitting Cash</h2>
        <p className="text-sm text-text-muted mt-0.5">
          Track idle cash and projected interest income
        </p>
      </div>

      {currencies.length > 0 && (
        <div className="space-y-4">
          {currencies.map((c) => {
            const sym = currencySymbol(c.currency)
            return (
              <div key={c.currency}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-surface-3 px-2 py-0.5 rounded text-xs font-semibold text-text">
                    {c.currency}
                  </span>
                  <span className="text-sm text-text-muted">
                    Total: {sym}
                    {c.total_cash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-surface-2 rounded-xl border border-border p-4">
                    <div className="text-xs text-text-muted mb-1">
                      Weekly Interest
                    </div>
                    <div className="text-lg font-semibold tabular-nums text-green">
                      {formatCurrency(c.total_weekly_interest, c.currency)}
                    </div>
                  </div>
                  <div className="bg-surface-2 rounded-xl border border-border p-4">
                    <div className="text-xs text-text-muted mb-1">
                      Monthly Interest
                    </div>
                    <div className="text-lg font-semibold tabular-nums text-green">
                      {formatCurrency(c.total_monthly_interest, c.currency)}
                    </div>
                  </div>
                  <div className="bg-surface-2 rounded-xl border border-border p-4">
                    <div className="text-xs text-text-muted mb-1">
                      Yearly Interest
                    </div>
                    <div className="text-lg font-semibold tabular-nums text-green">
                      {formatCurrency(c.total_annual_interest, c.currency)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-surface-2 rounded-xl border border-border p-5">
        <h3 className="text-sm font-medium mb-4">Add Cash Position</h3>
        {error && (
          <div className="text-red text-xs mb-3 bg-red/10 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">
                Label
              </label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="HISA, Savings..."
                required
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">
                Currency
              </label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent transition-colors"
              >
                <option value="CAD">CAD</option>
                <option value="USD">USD</option>
                <option value="INR">INR</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">
                Amount
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="10000"
                required
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">
                Annual Rate (%)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={form.interest_rate}
                onChange={(e) =>
                  setForm({ ...form, interest_rate: e.target.value })
                }
                placeholder="3.75"
                required
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 outline-none focus:border-accent transition-colors"
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
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-muted mb-3">Positions</h3>
        {!positions?.length ? (
          <div className="bg-surface-2 rounded-xl border border-border p-8 text-center text-text-muted">
            No cash positions yet.
          </div>
        ) : (
          <div className="bg-surface-2 rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
                  <th className="text-left p-3 pl-4">Label</th>
                  <th className="text-left p-3">Currency</th>
                  <th className="text-right p-3">Amount</th>
                  <th className="text-right p-3">Rate</th>
                  <th className="text-right p-3">Monthly</th>
                  <th className="text-right p-3">Yearly</th>
                  <th className="text-right p-3 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const annual = p.amount * (p.interest_rate / 100)
                  const sym = currencySymbol(p.currency)

                  if (editingId === p.id) {
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-border/50 bg-accent/5"
                      >
                        <td className="p-2 pl-3">
                          <input
                            type="text"
                            value={editForm.label}
                            onChange={(e) =>
                              setEditForm({ ...editForm, label: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit()
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-sm text-text outline-none focus:border-accent"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={editForm.currency}
                            onChange={(e) =>
                              setEditForm({ ...editForm, currency: e.target.value })
                            }
                            className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-sm text-text outline-none focus:border-accent"
                          >
                            <option value="CAD">CAD</option>
                            <option value="USD">USD</option>
                            <option value="INR">INR</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={editForm.amount}
                            onChange={(e) =>
                              setEditForm({ ...editForm, amount: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit()
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-sm text-text text-right outline-none focus:border-accent"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={editForm.interest_rate}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                interest_rate: e.target.value,
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit()
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-sm text-text text-right outline-none focus:border-accent"
                          />
                        </td>
                        <td className="p-2 text-right tabular-nums text-text-muted text-xs">
                          {editForm.amount && editForm.interest_rate
                            ? formatCurrency(
                                (Number(editForm.amount) *
                                  (Number(editForm.interest_rate) / 100)) /
                                  12,
                                editForm.currency
                              )
                            : '—'}
                        </td>
                        <td className="p-2 text-right tabular-nums text-text-muted text-xs">
                          {editForm.amount && editForm.interest_rate
                            ? formatCurrency(
                                Number(editForm.amount) *
                                  (Number(editForm.interest_rate) / 100),
                                editForm.currency
                              )
                            : '—'}
                        </td>
                        <td className="p-2 pr-3">
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={saveEdit}
                              className="text-green hover:text-green/80 transition-colors p-1"
                              title="Save"
                            >
                              <CheckIcon />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-text-muted hover:text-red transition-colors p-1"
                              title="Cancel"
                            >
                              <XIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr
                      key={p.id}
                      className="border-b border-border/50 hover:bg-surface-3/50 transition-colors"
                    >
                      <td className="p-3 pl-4 font-medium">{p.label}</td>
                      <td className="p-3">
                        <span className="bg-surface-3 px-2 py-0.5 rounded text-xs font-medium">
                          {p.currency}
                        </span>
                      </td>
                      <td className="text-right p-3 tabular-nums">
                        {sym}
                        {p.amount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="text-right p-3 tabular-nums">
                        {p.interest_rate}%
                      </td>
                      <td className="text-right p-3 tabular-nums text-green">
                        {formatCurrency(annual / 12, p.currency)}
                      </td>
                      <td className="text-right p-3 tabular-nums text-green">
                        {formatCurrency(annual, p.currency)}
                      </td>
                      <td className="text-right p-3 pr-4">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => startEdit(p)}
                            className="text-text-muted hover:text-accent transition-colors p-1"
                            title="Edit"
                          >
                            <EditIcon />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="text-text-muted hover:text-red transition-colors p-1"
                            title="Delete"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 2.5l3 3M1.5 9.5l-.5 3.5 3.5-.5 8-8-3-3z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 3.5h8M5.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M9.5 3.5v7a1 1 0 01-1 1h-3a1 1 0 01-1-1v-7" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7.5l3 3 5-6" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M4 4l6 6M10 4l-6 6" />
    </svg>
  )
}
