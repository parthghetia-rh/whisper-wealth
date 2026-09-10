import { useState } from 'react'
import { useApi, postApi, putApi, deleteApi } from '../hooks/useApi'
import { currencySymbol, formatCurrency } from '../utils/currency'
import { useHousehold } from '../context/HouseholdContext'
import OwnerSelect, { OwnerBadge } from '../components/OwnerSelect'
import { notify } from '../components/ToastViewport'
import RecordListSkeleton from '../components/RecordListSkeleton'

export default function Cash() {
  const { scopedUrl } = useHousehold()
  const { data: positions, loading: positionsLoading, refetch } = useApi(scopedUrl('/api/cash'))
  const { data: summary, refetch: refetchSummary } = useApi(scopedUrl('/api/cash/summary'))

  const [cashForm, setCashForm] = useState({
    label: '', currency: 'CAD', amount: '', interest_rate: '', owner_scope: '',
  })
  const [incomeForm, setIncomeForm] = useState({
    label: '', currency: 'CAD', amount: '', frequency: 'monthly', owner_scope: '',
  })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [cashFormOpen, setCashFormOpen] = useState(false)
  const [incomeFormOpen, setIncomeFormOpen] = useState(false)

  const handleAddCash = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await postApi('/api/cash', {
        ...cashForm, type: 'cash',
        amount: Number(cashForm.amount),
        interest_rate: Number(cashForm.interest_rate),
      })
      setCashForm((current) => ({ label: '', currency: 'CAD', amount: '', interest_rate: '', owner_scope: current.owner_scope }))
      refetch(); refetchSummary()
      setCashFormOpen(false)
      notify('Cash position added')
    } catch (err) { setError(err.message); notify(err.message, { tone: 'error' }) }
    finally { setLoading(false) }
  }

  const handleAddIncome = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await postApi('/api/cash', {
        ...incomeForm, type: 'income',
        amount: Number(incomeForm.amount),
        interest_rate: 0,
      })
      setIncomeForm((current) => ({ label: '', currency: 'CAD', amount: '', frequency: 'monthly', owner_scope: current.owner_scope }))
      refetch(); refetchSummary()
      setIncomeFormOpen(false)
      notify('Recurring income added')
    } catch (err) { setError(err.message); notify(err.message, { tone: 'error' }) }
    finally { setLoading(false) }
  }

  const handleDelete = async (id) => {
    try {
      await deleteApi(`/api/cash/${id}`)
      refetch(); refetchSummary()
      notify('Entry deleted', { tone: 'info' })
    } catch (err) {
      setError(err.message)
      notify(err.message, { tone: 'error' })
    }
  }

  const startEdit = (p) => {
    setEditingId(p.id)
    setEditForm({
      label: p.label, currency: p.currency,
      amount: String(p.amount),
      interest_rate: String(p.interest_rate || 0),
      type: p.type || 'cash',
      frequency: p.frequency || 'monthly',
      owner_scope: p.owner_scope,
    })
  }

  const saveEdit = async () => {
    try {
      await putApi(`/api/cash/${editingId}`, {
        ...editForm,
        amount: Number(editForm.amount),
        interest_rate: editForm.type === 'cash' ? Number(editForm.interest_rate) : 0,
      })
      setEditingId(null); setEditForm(null)
      refetch(); refetchSummary()
      notify('Entry updated')
    } catch (err) { setError(err.message); notify(err.message, { tone: 'error' }) }
  }

  const currencies = summary?.currencies || []
  const cashPositions = (positions || []).filter((p) => (p.type || 'cash') === 'cash')
  const incomePositions = (positions || []).filter((p) => p.type === 'income')

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Cash & Income</h2>
          <p className="mt-0.5 text-sm text-text-muted">Track sitting cash with interest, and predictable recurring income</p>
        </div>
        <div className="flex gap-2 md:hidden">
          <button type="button" onClick={() => { setCashFormOpen((open) => !open); setIncomeFormOpen(false) }} className="min-h-11 rounded-lg bg-accent px-3 text-sm font-medium text-white">Add cash</button>
          <button type="button" onClick={() => { setIncomeFormOpen((open) => !open); setCashFormOpen(false) }} className="min-h-11 rounded-lg border border-border bg-surface-2 px-3 text-sm font-medium">Add income</button>
        </div>
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
                {c.total_cash > 0 && (
                  <span className="text-xs text-text-muted">
                    Cash: {formatCurrency(c.total_cash, c.currency)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-surface-2 rounded-xl border border-border p-4">
                  <div className="text-xs text-text-muted mb-1">Weekly</div>
                  <div className="text-lg font-semibold tabular-nums text-green">
                    {formatCurrency(c.total_weekly, c.currency)}
                  </div>
                </div>
                <div className="bg-surface-2 rounded-xl border border-border p-4">
                  <div className="text-xs text-text-muted mb-1">Monthly</div>
                  <div className="text-lg font-semibold tabular-nums text-green">
                    {formatCurrency(c.total_monthly, c.currency)}
                  </div>
                </div>
                <div className="bg-surface-2 rounded-xl border border-border p-4">
                  <div className="text-xs text-text-muted mb-1">Yearly</div>
                  <div className="text-lg font-semibold tabular-nums text-green">
                    {formatCurrency(c.total_annual, c.currency)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={`${cashFormOpen ? 'block' : 'hidden'} rounded-xl border border-border bg-surface-2 p-4 md:block md:p-5`}>
        <h3 className="text-sm font-medium mb-4">Add Cash Position</h3>
        <form onSubmit={handleAddCash}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
            <OwnerSelect value={cashForm.owner_scope} onChange={(owner_scope) => setCashForm((current) => ({ ...current, owner_scope }))} includeLabel />
            <div>
              <label className="block text-xs text-text-muted mb-1">Label</label>
              <input type="text" value={cashForm.label}
                onChange={(e) => setCashForm({ ...cashForm, label: e.target.value })}
                placeholder="HISA, Savings..." required
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 outline-none focus:border-accent" />
            </div>
            <CurrencySelect value={cashForm.currency} onChange={(v) => setCashForm({ ...cashForm, currency: v })} />
            <div>
              <label className="block text-xs text-text-muted mb-1">Amount</label>
              <input type="number" step="any" min="0" value={cashForm.amount}
                onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })}
                placeholder="10000" required
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Annual Rate (%)</label>
              <input type="number" step="any" min="0" value={cashForm.interest_rate}
                onChange={(e) => setCashForm({ ...cashForm, interest_rate: e.target.value })}
                placeholder="3.75" required
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 outline-none focus:border-accent" />
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

      <div className={`${incomeFormOpen ? 'block' : 'hidden'} rounded-xl border border-border bg-surface-2 p-4 md:block md:p-5`}>
        <h3 className="text-sm font-medium mb-1">Add Recurring Income</h3>
        <p className="text-xs text-text-muted mb-4">
          Cashback, rent, side income, paybacks — any predictable recurring amount
        </p>
        <form onSubmit={handleAddIncome}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
            <OwnerSelect value={incomeForm.owner_scope} onChange={(owner_scope) => setIncomeForm((current) => ({ ...current, owner_scope }))} includeLabel />
            <div>
              <label className="block text-xs text-text-muted mb-1">Label</label>
              <input type="text" value={incomeForm.label}
                onChange={(e) => setIncomeForm({ ...incomeForm, label: e.target.value })}
                placeholder="CC Cashback, Rent..." required
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 outline-none focus:border-accent" />
            </div>
            <CurrencySelect value={incomeForm.currency} onChange={(v) => setIncomeForm({ ...incomeForm, currency: v })} />
            <div>
              <label className="block text-xs text-text-muted mb-1">Amount</label>
              <input type="number" step="any" min="0" value={incomeForm.amount}
                onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                placeholder="50" required
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted/50 outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Frequency</label>
              <select value={incomeForm.frequency}
                onChange={(e) => setIncomeForm({ ...incomeForm, frequency: e.target.value })}
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
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

      {cashPositions.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-muted mb-3">Cash Positions</h3>
          <div className="space-y-2 md:hidden">
            {cashPositions.map((position) => editingId === position.id ? (
              <MobileCashEditor key={position.id} form={editForm} setForm={setEditForm} onSave={saveEdit} onCancel={() => setEditingId(null)} />
            ) : (
              <MobileCashCard key={position.id} position={position} onEdit={() => startEdit(position)} onDelete={() => handleDelete(position.id)} />
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface-2 md:block">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
                  <th className="text-left p-3 pl-4">Label</th>
                  <th className="text-left p-3">Owner</th>
                  <th className="text-left p-3">Currency</th>
                  <th className="text-right p-3">Amount</th>
                  <th className="text-right p-3">Rate</th>
                  <th className="text-right p-3">Monthly</th>
                  <th className="text-right p-3">Yearly</th>
                  <th className="text-right p-3 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {cashPositions.map((p) => renderRow(p, editingId, editForm, setEditForm, startEdit, saveEdit, handleDelete, setEditingId))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {incomePositions.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-muted mb-3">Recurring Income</h3>
          <div className="space-y-2 md:hidden">
            {incomePositions.map((position) => editingId === position.id ? (
              <MobileCashEditor key={position.id} form={editForm} setForm={setEditForm} onSave={saveEdit} onCancel={() => setEditingId(null)} />
            ) : (
              <MobileCashCard key={position.id} position={position} onEdit={() => startEdit(position)} onDelete={() => handleDelete(position.id)} />
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface-2 md:block">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
                  <th className="text-left p-3 pl-4">Label</th>
                  <th className="text-left p-3">Owner</th>
                  <th className="text-left p-3">Currency</th>
                  <th className="text-right p-3">Amount</th>
                  <th className="text-right p-3">Frequency</th>
                  <th className="text-right p-3">Monthly</th>
                  <th className="text-right p-3">Yearly</th>
                  <th className="text-right p-3 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {incomePositions.map((p) => renderIncomeRow(p, editingId, editForm, setEditForm, startEdit, saveEdit, handleDelete, setEditingId))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {positionsLoading && <RecordListSkeleton />}

      {!positionsLoading && !cashPositions.length && !incomePositions.length && (
        <div className="bg-surface-2 rounded-xl border border-border p-8 text-center text-text-muted">
          No entries yet. Add a cash position or recurring income above.
        </div>
      )}
    </div>
  )
}

function renderRow(p, editingId, editForm, setEditForm, startEdit, saveEdit, handleDelete, setEditingId) {
  const sym = currencySymbol(p.currency)
  const annual = p.amount * (p.interest_rate / 100)

  if (editingId === p.id) {
    return (
      <tr key={p.id} className="border-b border-border/50 bg-accent/5">
        <td className="p-2 pl-3">
          <input type="text" value={editForm.label}
            onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
            className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-sm text-text outline-none focus:border-accent" />
        </td>
        <td className="p-2 min-w-32"><OwnerSelect value={editForm.owner_scope} onChange={(owner_scope) => setEditForm({ ...editForm, owner_scope })} /></td>
        <td className="p-2"><CurrencySelect value={editForm.currency} onChange={(v) => setEditForm({ ...editForm, currency: v })} small /></td>
        <td className="p-2"><input type="number" step="any" min="0" value={editForm.amount}
          onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
          className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-sm text-text text-right outline-none focus:border-accent" /></td>
        <td className="p-2"><input type="number" step="any" min="0" value={editForm.interest_rate}
          onChange={(e) => setEditForm({ ...editForm, interest_rate: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
          className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-sm text-text text-right outline-none focus:border-accent" /></td>
        <td colSpan={2} />
        <td className="p-2 pr-3"><ActionButtons onSave={saveEdit} onCancel={() => setEditingId(null)} /></td>
      </tr>
    )
  }

  return (
    <tr key={p.id} className="border-b border-border/50 hover:bg-surface-3/50 transition-colors">
      <td className="p-3 pl-4 font-medium">{p.label}</td>
      <td className="p-3"><OwnerBadge name={p.owner_name} color={p.owner_color} /></td>
      <td className="p-3"><span className="bg-surface-3 px-2 py-0.5 rounded text-xs font-medium">{p.currency}</span></td>
      <td className="text-right p-3 tabular-nums">{sym}{p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td className="text-right p-3 tabular-nums">{p.interest_rate}%</td>
      <td className="text-right p-3 tabular-nums text-green">{formatCurrency(annual / 12, p.currency)}</td>
      <td className="text-right p-3 tabular-nums text-green">{formatCurrency(annual, p.currency)}</td>
      <td className="text-right p-3 pr-4"><RowActions onEdit={() => startEdit(p)} onDelete={() => handleDelete(p.id)} /></td>
    </tr>
  )
}

function renderIncomeRow(p, editingId, editForm, setEditForm, startEdit, saveEdit, handleDelete, setEditingId) {
  const sym = currencySymbol(p.currency)
  const freq = p.frequency || 'yearly'
  const annual = freq === 'weekly' ? p.amount * 52 : freq === 'monthly' ? p.amount * 12 : p.amount

  if (editingId === p.id) {
    return (
      <tr key={p.id} className="border-b border-border/50 bg-accent/5">
        <td className="p-2 pl-3">
          <input type="text" value={editForm.label}
            onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
            className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-sm text-text outline-none focus:border-accent" />
        </td>
        <td className="p-2 min-w-32"><OwnerSelect value={editForm.owner_scope} onChange={(owner_scope) => setEditForm({ ...editForm, owner_scope })} /></td>
        <td className="p-2"><CurrencySelect value={editForm.currency} onChange={(v) => setEditForm({ ...editForm, currency: v })} small /></td>
        <td className="p-2"><input type="number" step="any" min="0" value={editForm.amount}
          onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null) }}
          className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-sm text-text text-right outline-none focus:border-accent" /></td>
        <td className="p-2">
          <select value={editForm.frequency} onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value })}
            className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-sm text-text outline-none focus:border-accent">
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </td>
        <td colSpan={2} />
        <td className="p-2 pr-3"><ActionButtons onSave={saveEdit} onCancel={() => setEditingId(null)} /></td>
      </tr>
    )
  }

  return (
    <tr key={p.id} className="border-b border-border/50 hover:bg-surface-3/50 transition-colors">
      <td className="p-3 pl-4 font-medium">{p.label}</td>
      <td className="p-3"><OwnerBadge name={p.owner_name} color={p.owner_color} /></td>
      <td className="p-3"><span className="bg-surface-3 px-2 py-0.5 rounded text-xs font-medium">{p.currency}</span></td>
      <td className="text-right p-3 tabular-nums">{sym}{p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td className="text-right p-3 tabular-nums capitalize">{freq}</td>
      <td className="text-right p-3 tabular-nums text-green">{formatCurrency(annual / 12, p.currency)}</td>
      <td className="text-right p-3 tabular-nums text-green">{formatCurrency(annual, p.currency)}</td>
      <td className="text-right p-3 pr-4"><RowActions onEdit={() => startEdit(p)} onDelete={() => handleDelete(p.id)} /></td>
    </tr>
  )
}

function CurrencySelect({ value, onChange, small }) {
  return (
    <div>
      {!small && <label className="block text-xs text-text-muted mb-1">Currency</label>}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={small
          ? 'w-full rounded border border-border bg-surface-3 px-2 py-1 text-sm text-text outline-none focus:border-accent'
          : 'min-h-11 w-full rounded-lg border border-border bg-surface-3 px-3 py-2 text-sm text-text outline-none focus:border-accent'}>
        <option value="CAD">CAD</option>
        <option value="USD">USD</option>
        <option value="INR">INR</option>
        <option value="EUR">EUR</option>
        <option value="GBP">GBP</option>
      </select>
    </div>
  )
}

export function MobileCashCard({ position, onEdit, onDelete }) {
  const isIncome = position.type === 'income'
  const annual = isIncome
    ? (position.frequency === 'weekly' ? position.amount * 52 : position.frequency === 'monthly' ? position.amount * 12 : position.amount)
    : position.amount * (position.interest_rate / 100)
  return (
    <article className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold">{position.label}</h4>
            <span className="rounded bg-surface-3 px-2 py-0.5 text-xs font-medium">{position.currency}</span>
          </div>
          <div className="mt-1"><OwnerBadge name={position.owner_name} color={position.owner_color} /></div>
        </div>
        <div className="flex shrink-0">
          <button type="button" onClick={onEdit} className="icon-button" aria-label={`Edit ${position.label}`}><EditSmallIcon /></button>
          <button type="button" onClick={onDelete} className="icon-button hover:!bg-red/10 hover:!text-red" aria-label={`Delete ${position.label}`}><TrashSmallIcon /></button>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border/50 pt-3 text-xs">
        <div><dt className="text-text-muted">Amount</dt><dd className="mt-1 font-semibold tabular-nums">{formatCurrency(position.amount, position.currency)}</dd></div>
        <div><dt className="text-text-muted">{isIncome ? 'Frequency' : 'Rate'}</dt><dd className="mt-1 font-medium capitalize">{isIncome ? position.frequency : `${position.interest_rate}%`}</dd></div>
        <div className="text-right"><dt className="text-text-muted">Monthly</dt><dd className="mt-1 font-semibold tabular-nums text-green"><span aria-hidden="true">↑ </span>{formatCurrency(annual / 12, position.currency)}</dd></div>
      </dl>
    </article>
  )
}

function MobileCashEditor({ form, setForm, onSave, onCancel }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return (
    <article className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-4">
      <label><span className="mb-1 block text-xs text-text-muted">Label</span><input value={form.label} onChange={(event) => update('label', event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-surface-3 px-3 text-sm" /></label>
      <div className="grid grid-cols-2 gap-3">
        <CurrencySelect value={form.currency} onChange={(value) => update('currency', value)} />
        <label><span className="mb-1 block text-xs text-text-muted">Amount</span><input type="number" step="any" min="0" value={form.amount} onChange={(event) => update('amount', event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-surface-3 px-3 text-sm" /></label>
        <OwnerSelect value={form.owner_scope} onChange={(value) => update('owner_scope', value)} includeLabel />
        {form.type === 'income' ? (
          <label><span className="mb-1 block text-xs text-text-muted">Frequency</span><select value={form.frequency} onChange={(event) => update('frequency', event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-surface-3 px-3 text-sm"><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
        ) : (
          <label><span className="mb-1 block text-xs text-text-muted">Annual rate (%)</span><input type="number" step="any" min="0" value={form.interest_rate} onChange={(event) => update('interest_rate', event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-surface-3 px-3 text-sm" /></label>
        )}
      </div>
      <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="min-h-11 rounded-lg px-4 text-sm text-text-muted">Cancel</button><button type="button" onClick={onSave} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white">Save</button></div>
    </article>
  )
}

function EditSmallIcon() {
  return <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 2.5l3 3M1.5 9.5l-.5 3.5 3.5-.5 8-8-3-3z" /></svg>
}

function TrashSmallIcon() {
  return <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3.5h8M5.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M9.5 3.5v7a1 1 0 01-1 1h-3a1 1 0 01-1-1v-7" /></svg>
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex gap-1 justify-end">
      <button onClick={onEdit} className="text-text-muted hover:text-accent transition-colors p-1" title="Edit">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.5 2.5l3 3M1.5 9.5l-.5 3.5 3.5-.5 8-8-3-3z" />
        </svg>
      </button>
      <button onClick={onDelete} className="text-text-muted hover:text-red transition-colors p-1" title="Delete">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M3 3.5h8M5.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M9.5 3.5v7a1 1 0 01-1 1h-3a1 1 0 01-1-1v-7" />
        </svg>
      </button>
    </div>
  )
}

function ActionButtons({ onSave, onCancel }) {
  return (
    <div className="flex gap-1 justify-end">
      <button onClick={onSave} className="text-green hover:text-green/80 transition-colors p-1" title="Save">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7.5l3 3 5-6" />
        </svg>
      </button>
      <button onClick={onCancel} className="text-text-muted hover:text-red transition-colors p-1" title="Cancel">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M4 4l6 6M10 4l-6 6" />
        </svg>
      </button>
    </div>
  )
}
