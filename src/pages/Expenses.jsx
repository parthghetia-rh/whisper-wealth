import { useState } from 'react'
import { useApi, postApi, putApi, deleteApi } from '../hooks/useApi'
import { currencySymbol, formatCurrency } from '../utils/currency'

const CATEGORIES = [
  { id: 'housing', label: 'Housing' },
  { id: 'transportation', label: 'Transportation' },
  { id: 'food', label: 'Food & Groceries' },
  { id: 'utilities', label: 'Utilities' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'education', label: 'Education' },
  { id: 'personal', label: 'Personal' },
  { id: 'debt', label: 'Debt Payments' },
  { id: 'other', label: 'Other' },
]

const CATEGORY_COLORS = {
  housing: '#6366f1', transportation: '#f59e0b', food: '#22c55e',
  utilities: '#06b6d4', insurance: '#8b5cf6', healthcare: '#ec4899',
  subscriptions: '#f97316', education: '#14b8a6', personal: '#a855f7',
  debt: '#ef4444', other: '#94a3b8',
}

export default function Expenses() {
  const { data: expenses, refetch } = useApi('/api/expenses')
  const { data: summary, refetch: refetchSummary } = useApi('/api/expenses/summary')

  const [form, setForm] = useState({
    label: '', category: 'other', currency: 'CAD', amount: '', frequency: 'monthly',
  })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)

  const handleAdd = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await postApi('/api/expenses', { ...form, amount: Number(form.amount) })
      setForm({ label: '', category: 'other', currency: 'CAD', amount: '', frequency: 'monthly' })
      refetch(); refetchSummary()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const handleDelete = async (id) => {
    await deleteApi(`/api/expenses/${id}`)
    refetch(); refetchSummary()
  }

  const startEdit = (e) => {
    setEditingId(e.id)
    setEditForm({
      label: e.label, category: e.category, currency: e.currency,
      amount: String(e.amount), frequency: e.frequency,
    })
  }

  const saveEdit = async () => {
    try {
      await putApi(`/api/expenses/${editingId}`, { ...editForm, amount: Number(editForm.amount) })
      setEditingId(null); setEditForm(null)
      refetch(); refetchSummary()
    } catch (err) { setError(err.message) }
  }

  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('desc')

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'label' || key === 'category' ? 'asc' : 'desc')
    }
  }

  const annualizeAmount = (e) => {
    if (e.frequency === 'weekly') return e.amount * 52
    if (e.frequency === 'biweekly') return e.amount * 26
    if (e.frequency === 'monthly') return e.amount * 12
    return e.amount
  }

  const sortedExpenses = [...(expenses || [])].sort((a, b) => {
    if (!sortKey) return 0
    let av, bv
    if (sortKey === 'monthly') {
      av = annualizeAmount(a) / 12
      bv = annualizeAmount(b) / 12
    } else {
      av = a[sortKey]
      bv = b[sortKey]
    }
    if (typeof av === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    return sortDir === 'asc' ? av - bv : bv - av
  })

  const currencies = summary?.currencies || []
  const categories = summary?.categories || []

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-xl font-semibold">Expenses</h2>
        <p className="text-sm text-text-muted mt-0.5">
          Track recurring expenses — mortgage, bills, subscriptions, and more
        </p>
      </div>

      {error && (
        <div className="text-red text-xs bg-red/10 rounded-lg px-3 py-2">{error}</div>
      )}

      {currencies.length > 0 && (
        <div className="space-y-4">
          {currencies.map((c) => (
            <div key={c.currency}>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-surface-3 px-2 py-0.5 rounded text-xs font-semibold text-text">
                  {c.currency}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-surface-2 rounded-xl border border-border p-4">
                  <div className="text-xs text-text-muted mb-1">Weekly</div>
                  <div className="text-lg font-semibold tabular-nums text-red">
                    {formatCurrency(c.total_weekly, c.currency)}
                  </div>
                </div>
                <div className="bg-surface-2 rounded-xl border border-border p-4">
                  <div className="text-xs text-text-muted mb-1">Monthly</div>
                  <div className="text-lg font-semibold tabular-nums text-red">
                    {formatCurrency(c.total_monthly, c.currency)}
                  </div>
                </div>
                <div className="bg-surface-2 rounded-xl border border-border p-4">
                  <div className="text-xs text-text-muted mb-1">Yearly</div>
                  <div className="text-lg font-semibold tabular-nums text-red">
                    {formatCurrency(c.total_annual, c.currency)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {categories.length > 0 && (
        <div className="bg-surface-2 rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium mb-3">Breakdown</h3>
          <div className="space-y-2">
            {categories.map((c) => (
              <div key={c.category} className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[c.category] }} />
                <span className="text-xs font-medium w-28 shrink-0 capitalize">{c.category}</span>
                <div className="flex-1 bg-surface-3 rounded-full h-4 relative overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${c.percent}%`, backgroundColor: CATEGORY_COLORS[c.category] }}
                  />
                </div>
                <span className="text-xs tabular-nums text-text-muted w-12 text-right">{c.percent}%</span>
                <span className="text-xs tabular-nums w-20 text-right">${c.monthly.toFixed(0)}/mo</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface-2 rounded-xl border border-border p-5">
        <h3 className="text-sm font-medium mb-4">Add Expense</h3>
        <form onSubmit={handleAdd}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Label</label>
              <input type="text" value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Mortgage, Netflix..." required
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent">
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Currency</label>
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent">
                <option value="CAD">CAD</option><option value="USD">USD</option>
                <option value="INR">INR</option><option value="EUR">EUR</option><option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Amount</label>
              <input type="number" step="any" min="0.01" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="1500" required
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Frequency</label>
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent">
                <option value="weekly">Weekly</option><option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={loading}
                className="w-full bg-accent hover:bg-accent-hover text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50">
                Add
              </button>
            </div>
          </div>
        </form>
      </div>

      {!(expenses?.length) ? (
        <div className="bg-surface-2 rounded-xl border border-border p-8 text-center text-text-muted">
          No expenses yet. Add your recurring expenses above.
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-medium text-text-muted mb-3">All Expenses</h3>
          <div className="bg-surface-2 rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[650px]">
              <thead>
                <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
                  {[
                    { key: 'label', label: 'Expense', align: 'left', pl: true },
                    { key: 'category', label: 'Category', align: 'left' },
                    { key: 'currency', label: 'Currency', align: 'left' },
                    { key: 'amount', label: 'Amount', align: 'right' },
                    { key: 'frequency', label: 'Frequency', align: 'right' },
                    { key: 'monthly', label: 'Monthly', align: 'right' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`p-3 cursor-pointer select-none hover:text-text transition-colors ${
                        col.align === 'left' ? 'text-left' : 'text-right'
                      } ${col.pl ? 'pl-4' : ''}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key && (
                          <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor" className="text-accent">
                            {sortDir === 'asc' ? <path d="M4 1L7.5 5.5H0.5z" /> : <path d="M4 9L0.5 4.5H7.5z" />}
                          </svg>
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="p-3 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {sortedExpenses.map((e) => {
                  const sym = currencySymbol(e.currency)
                  const annual = e.frequency === 'weekly' ? e.amount * 52 :
                    e.frequency === 'biweekly' ? e.amount * 26 :
                    e.frequency === 'monthly' ? e.amount * 12 : e.amount

                  if (editingId === e.id) {
                    return (
                      <tr key={e.id} className="border-b border-border/50 bg-accent/5">
                        <td className="p-2 pl-3">
                          <input type="text" value={editForm.label}
                            onChange={(ev) => setEditForm({ ...editForm, label: ev.target.value })}
                            onKeyDown={(ev) => { if (ev.key === 'Enter') saveEdit(); if (ev.key === 'Escape') setEditingId(null) }}
                            className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-sm text-text outline-none focus:border-accent" />
                        </td>
                        <td className="p-2">
                          <select value={editForm.category} onChange={(ev) => setEditForm({ ...editForm, category: ev.target.value })}
                            className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-sm text-text outline-none focus:border-accent">
                            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                          </select>
                        </td>
                        <td className="p-2">
                          <select value={editForm.currency} onChange={(ev) => setEditForm({ ...editForm, currency: ev.target.value })}
                            className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-sm text-text outline-none focus:border-accent">
                            <option value="CAD">CAD</option><option value="USD">USD</option>
                            <option value="INR">INR</option><option value="EUR">EUR</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input type="number" step="any" min="0.01" value={editForm.amount}
                            onChange={(ev) => setEditForm({ ...editForm, amount: ev.target.value })}
                            onKeyDown={(ev) => { if (ev.key === 'Enter') saveEdit(); if (ev.key === 'Escape') setEditingId(null) }}
                            className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-sm text-text text-right outline-none focus:border-accent" />
                        </td>
                        <td className="p-2">
                          <select value={editForm.frequency} onChange={(ev) => setEditForm({ ...editForm, frequency: ev.target.value })}
                            className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-sm text-text outline-none focus:border-accent">
                            <option value="weekly">Weekly</option><option value="biweekly">Biweekly</option>
                            <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                          </select>
                        </td>
                        <td />
                        <td className="p-2 pr-3">
                          <div className="flex gap-1 justify-end">
                            <button onClick={saveEdit} className="text-green hover:text-green/80 transition-colors p-1">
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7.5l3 3 5-6" /></svg>
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-text-muted hover:text-red transition-colors p-1">
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l6 6M10 4l-6 6" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-surface-3/50 transition-colors">
                      <td className="p-3 pl-4 font-medium">{e.label}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[e.category] }} />
                          <span className="capitalize">{e.category}</span>
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="bg-surface-3 px-2 py-0.5 rounded text-xs font-medium">{e.currency}</span>
                      </td>
                      <td className="text-right p-3 tabular-nums">{sym}{e.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="text-right p-3 tabular-nums capitalize text-text-muted">{e.frequency}</td>
                      <td className="text-right p-3 tabular-nums text-red">{formatCurrency(annual / 12, e.currency)}</td>
                      <td className="text-right p-3 pr-4">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => startEdit(e)} className="text-text-muted hover:text-accent transition-colors p-1">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 2.5l3 3M1.5 9.5l-.5 3.5 3.5-.5 8-8-3-3z" /></svg>
                          </button>
                          <button onClick={() => handleDelete(e.id)} className="text-text-muted hover:text-red transition-colors p-1">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3.5h8M5.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M9.5 3.5v7a1 1 0 01-1 1h-3a1 1 0 01-1-1v-7" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
