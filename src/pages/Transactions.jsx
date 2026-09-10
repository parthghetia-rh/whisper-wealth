import { useState } from 'react'
import { useApi, deleteApi, postApi, putApi } from '../hooks/useApi'
import TransactionForm from '../components/TransactionForm'
import CSVImport from '../components/CSVImport'
import { useHousehold } from '../context/HouseholdContext'
import OwnerSelect, { OwnerBadge } from '../components/OwnerSelect'
import ActionSheet from '../components/ActionSheet'
import { notify } from '../components/ToastViewport'
import RecordListSkeleton from '../components/RecordListSkeleton'

export default function Transactions() {
  const { scopedUrl } = useHousehold()
  const { data: transactions, loading: transactionsLoading, refetch } = useApi(scopedUrl('/api/transactions'))
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [editError, setEditError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  const handleDelete = async (transaction) => {
    try {
      await deleteApi(`/api/transactions/${transaction.id}`)
      refetch()
      notify(`${transaction.ticker} transaction deleted`, {
        tone: 'info',
        actionLabel: 'Undo',
        onAction: async () => {
          try {
            await postApi('/api/transactions', {
              ticker: transaction.ticker,
              type: transaction.type,
              shares: transaction.shares,
              price_per_share: transaction.price_per_share,
              date: transaction.date,
              owner_scope: transaction.owner_scope,
            })
            refetch()
            notify('Transaction restored')
          } catch (err) {
            notify(err.message, { tone: 'error' })
          }
        },
      })
    } catch (err) {
      notify(err.message, { tone: 'error' })
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
      owner_scope: t.owner_scope,
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
      notify('Transaction updated')
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Transactions</h2>
          <p className="mt-0.5 text-sm text-text-muted">Add and manage your buy/sell transactions</p>
        </div>
        <button type="button" onClick={() => setFormOpen(true)} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover">
          Add transaction
        </button>
      </div>

      <ActionSheet open={formOpen} onClose={() => setFormOpen(false)} title="Add transaction" description="Record a buy or sell for a household member.">
        <TransactionForm
          embedded
          onAdded={() => {
            refetch()
            setFormOpen(false)
            notify('Transaction added')
          }}
        />
      </ActionSheet>

      <CSVImport onImported={refetch} />

      <div>
        <h3 className="text-sm font-medium text-text-muted mb-3">History</h3>
        {transactionsLoading ? (
          <RecordListSkeleton />
        ) : !transactions?.length ? (
          <div className="bg-surface-2 rounded-xl border border-border p-8 text-center text-text-muted">
            No transactions yet.
          </div>
        ) : (
          <>
            {editError && (
              <div className="mb-2 rounded-lg bg-red/10 px-4 py-2 text-xs text-red">
                {editError}
              </div>
            )}
            <div className="space-y-2 md:hidden">
              {transactions.map((transaction) => editingId === transaction.id ? (
                <MobileTransactionEditor
                  key={transaction.id}
                  form={editForm}
                  setForm={setEditForm}
                  saving={saving}
                  onSave={saveEdit}
                  onCancel={cancelEdit}
                />
              ) : (
                <MobileTransactionCard key={transaction.id} transaction={transaction} onEdit={() => startEdit(transaction)} onDelete={() => handleDelete(transaction)} />
              ))}
            </div>
            <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface-2 md:block">
            <table className="w-full min-w-[650px] text-sm">
              <thead>
                <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
                  <th className="text-left p-3 pl-4">Date</th>
                  <th className="text-left p-3">Ticker</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Owner</th>
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
                      <td className="p-2 min-w-32">
                        <OwnerSelect value={editForm.owner_scope} onChange={(owner_scope) => setEditForm({ ...editForm, owner_scope })} />
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
                      <td className="p-3"><OwnerBadge name={t.owner_name} color={t.owner_color} /></td>
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
                            onClick={() => handleDelete(t)}
                            className="icon-button"
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
          </>
        )}
      </div>
    </div>
  )
}

export function MobileTransactionCard({ transaction, onEdit, onDelete }) {
  const total = transaction.shares * transaction.price_per_share
  const isBuy = transaction.type === 'buy'
  return (
    <article className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold">{transaction.ticker}</span>
            <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${isBuy ? 'bg-green/15 text-green' : 'bg-red/15 text-red'}`}>
              <span aria-hidden="true">{isBuy ? '↑' : '↓'}</span>
              {transaction.type.toUpperCase()}
            </span>
            <OwnerBadge name={transaction.owner_name} color={transaction.owner_color} />
          </div>
          <p className="mt-1 text-xs tabular-nums text-text-muted">{transaction.date}</p>
        </div>
        <div className="flex shrink-0">
          <button type="button" onClick={onEdit} className="icon-button" aria-label={`Edit ${transaction.ticker} transaction`}><EditIcon /></button>
          <button type="button" onClick={onDelete} className="icon-button hover:!bg-red/10 hover:!text-red" aria-label={`Delete ${transaction.ticker} transaction`}><TrashIcon /></button>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border/50 pt-3 text-xs">
        <div><dt className="text-text-muted">Shares</dt><dd className="mt-1 font-medium tabular-nums">{transaction.shares}</dd></div>
        <div><dt className="text-text-muted">Price</dt><dd className="mt-1 font-medium tabular-nums">${transaction.price_per_share.toFixed(2)}</dd></div>
        <div className="text-right"><dt className="text-text-muted">Total</dt><dd className="mt-1 font-semibold tabular-nums">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</dd></div>
      </dl>
    </article>
  )
}

function MobileTransactionEditor({ form, setForm, saving, onSave, onCancel }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return (
    <article className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2"><span className="mb-1 block text-xs text-text-muted">Ticker</span><input value={form.ticker} onChange={(event) => update('ticker', event.target.value.toUpperCase())} className="min-h-11 w-full rounded-lg border border-border bg-surface-3 px-3 text-sm" /></label>
        <label><span className="mb-1 block text-xs text-text-muted">Date</span><input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-surface-3 px-3 text-sm" /></label>
        <OwnerSelect value={form.owner_scope} onChange={(owner_scope) => update('owner_scope', owner_scope)} includeLabel />
        <label><span className="mb-1 block text-xs text-text-muted">Shares</span><input type="number" step="any" min="0.0001" value={form.shares} onChange={(event) => update('shares', event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-surface-3 px-3 text-sm" /></label>
        <label><span className="mb-1 block text-xs text-text-muted">Price</span><input type="number" step="any" min="0.01" value={form.price_per_share} onChange={(event) => update('price_per_share', event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-surface-3 px-3 text-sm" /></label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => update('type', 'buy')} className={`min-h-11 rounded-lg text-sm font-medium ${form.type === 'buy' ? 'bg-green/15 text-green' : 'bg-surface-3 text-text-muted'}`}>↑ Buy</button>
        <button type="button" onClick={() => update('type', 'sell')} className={`min-h-11 rounded-lg text-sm font-medium ${form.type === 'sell' ? 'bg-red/15 text-red' : 'bg-surface-3 text-text-muted'}`}>↓ Sell</button>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-lg px-4 text-sm text-text-muted hover:bg-surface-3">Cancel</button>
        <button type="button" onClick={onSave} disabled={saving} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </article>
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
