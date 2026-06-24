import { useState } from 'react'
import { useApi, deleteApi, putApi } from '../hooks/useApi'
import TransactionForm from '../components/TransactionForm'

export default function Transactions() {
  const { data: transactions, refetch } = useApi('/api/transactions')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [editError, setEditError] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleDelete = async (id) => {
    try {
      await deleteApi(`/api/transactions/${id}`)
      refetch()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const startEdit = (t) => {
    setEditingId(t.id)
    setEditError(null)
    setEditForm({
      ticker: t.ticker,
      type: t.type,
      shares: String(t.shares),
      price_per_share: String(t.price_per_share),
      date: t.date,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm(null)
    setEditError(null)
  }

  const saveEdit = async () => {
    setSaving(true)
    setEditError(null)
    try {
      await putApi(`/api/transactions/${editingId}`, {
        ...editForm,
        shares: Number(editForm.shares),
        price_per_share: Number(editForm.price_per_share),
      })
      setEditingId(null)
      setEditForm(null)
      refetch()
    } catch (err) {
      setEditError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEditKey = (e) => {
    if (e.key === 'Enter') saveEdit()
    if (e.key === 'Escape') cancelEdit()
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-xl font-semibold">Transactions</h2>
        <p className="text-sm text-text-muted mt-0.5">
          Add and manage your buy/sell transactions
        </p>
      </div>

      <TransactionForm onAdded={refetch} />

      <div>
        <h3 className="text-sm font-medium text-text-muted mb-3">History</h3>
        {!transactions?.length ? (
          <div className="bg-surface-2 rounded-xl border border-border p-8 text-center text-text-muted">
            No transactions yet.
          </div>
        ) : (
          <div className="bg-surface-2 rounded-xl border border-border overflow-x-auto">
            {editError && (
              <div className="text-red text-xs bg-red/10 px-4 py-2">
                {editError}
              </div>
            )}
            <table className="w-full text-sm min-w-[650px]">
              <thead>
                <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
                  <th className="text-left p-3 pl-4">Date</th>
                  <th className="text-left p-3">Ticker</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-right p-3">Shares</th>
                  <th className="text-right p-3">Price</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-right p-3 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) =>
                  editingId === t.id ? (
                    <tr
                      key={t.id}
                      className="border-b border-border/50 bg-accent/5"
                    >
                      <td className="p-2 pl-3">
                        <input
                          type="date"
                          value={editForm.date}
                          onChange={(e) =>
                            setEditForm({ ...editForm, date: e.target.value })
                          }
                          onKeyDown={handleEditKey}
                          className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-sm text-text outline-none focus:border-accent"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={editForm.ticker}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              ticker: e.target.value.toUpperCase(),
                            })
                          }
                          onKeyDown={handleEditKey}
                          className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-sm text-text outline-none focus:border-accent"
                        />
                      </td>
                      <td className="p-2">
                        <div className="flex rounded border border-border overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              setEditForm({ ...editForm, type: 'buy' })
                            }
                            className={`flex-1 py-1 text-xs font-medium transition-colors ${
                              editForm.type === 'buy'
                                ? 'bg-green/15 text-green'
                                : 'bg-surface-3 text-text-muted'
                            }`}
                          >
                            Buy
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditForm({ ...editForm, type: 'sell' })
                            }
                            className={`flex-1 py-1 text-xs font-medium transition-colors ${
                              editForm.type === 'sell'
                                ? 'bg-red/15 text-red'
                                : 'bg-surface-3 text-text-muted'
                            }`}
                          >
                            Sell
                          </button>
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          min="0.0001"
                          value={editForm.shares}
                          onChange={(e) =>
                            setEditForm({ ...editForm, shares: e.target.value })
                          }
                          onKeyDown={handleEditKey}
                          className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-sm text-text text-right outline-none focus:border-accent"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={editForm.price_per_share}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              price_per_share: e.target.value,
                            })
                          }
                          onKeyDown={handleEditKey}
                          className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-sm text-text text-right outline-none focus:border-accent"
                        />
                      </td>
                      <td className="p-2 text-right tabular-nums text-text-muted text-xs">
                        {editForm.shares && editForm.price_per_share
                          ? `$${(Number(editForm.shares) * Number(editForm.price_per_share)).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : '—'}
                      </td>
                      <td className="p-2 pr-3">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="text-green hover:text-green/80 transition-colors p-1"
                            title="Save"
                          >
                            <CheckIcon />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-text-muted hover:text-red transition-colors p-1"
                            title="Cancel"
                          >
                            <XIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={t.id}
                      className="border-b border-border/50 hover:bg-surface-3/50 transition-colors"
                    >
                      <td className="p-3 pl-4 tabular-nums text-text-muted">
                        {t.date}
                      </td>
                      <td className="p-3 font-medium">{t.ticker}</td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            t.type === 'buy'
                              ? 'bg-green/15 text-green'
                              : 'bg-red/15 text-red'
                          }`}
                        >
                          {t.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="text-right p-3 tabular-nums">{t.shares}</td>
                      <td className="text-right p-3 tabular-nums">
                        ${t.price_per_share.toFixed(2)}
                      </td>
                      <td className="text-right p-3 tabular-nums font-medium">
                        $
                        {(t.shares * t.price_per_share).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="text-right p-3 pr-4">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => startEdit(t)}
                            className="text-text-muted hover:text-accent transition-colors p-1"
                            title="Edit transaction"
                          >
                            <EditIcon />
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="text-text-muted hover:text-red transition-colors p-1"
                            title="Delete transaction"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
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
