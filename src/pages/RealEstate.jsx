import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { deleteApi, postApi, putApi, useApi } from '../hooks/useApi'
import OwnerSelect, { OwnerBadge } from '../components/OwnerSelect'
import { formatCurrency } from '../utils/currency'
import { useHousehold } from '../context/HouseholdContext'

const CURRENCIES = ['CAD', 'USD', 'INR', 'EUR', 'GBP', 'JPY', 'AUD', 'HKD', 'SGD', 'CHF']

function torontoDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function initialForm(ownerScope = '') {
  return {
    owner_scope: ownerScope,
    label: '',
    address: '',
    currency: 'CAD',
    purchase_price: '',
    purchase_date: '',
    estimated_value: '',
    mortgage_balance: '',
    valuation_date: torontoDate(),
    source_label: 'HouseSigma',
    source_url: '',
    note: '',
  }
}

function numericSnapshot(form) {
  return {
    ...form,
    estimated_value: Number(form.estimated_value),
    mortgage_balance: Number(form.mortgage_balance),
  }
}

export default function RealEstate() {
  const { scopedUrl, defaultOwnerScope } = useHousehold()
  const { data, loading, error: fetchError, refetch } = useApi(scopedUrl('/api/properties'))
  const [form, setForm] = useState(() => initialForm(defaultOwnerScope))
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const properties = data?.items || []

  const createProperty = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await postApi('/api/properties', {
        ...numericSnapshot(form),
        purchase_price: Number(form.purchase_price),
      })
      setForm(initialForm(form.owner_scope || defaultOwnerScope))
      setFormOpen(false)
      refetch()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Real Estate</h2>
          <p className="mt-0.5 text-sm text-text-muted">
            Track property value, mortgage balance, equity, and appreciation locally
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen((open) => !open)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          {formOpen ? 'Cancel' : 'Add Property'}
        </button>
      </div>

      {(error || fetchError) && (
        <div className="rounded-lg bg-red/10 px-3 py-2 text-xs text-red">{error || fetchError}</div>
      )}

      {data?.totals_by_currency?.map((total) => (
        <section key={total.currency}>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded bg-surface-3 px-2 py-0.5 text-xs font-semibold">{total.currency}</span>
            <span className="text-xs text-text-muted">
              {total.properties} propert{total.properties === 1 ? 'y' : 'ies'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Current value" value={formatCurrency(total.estimated_value, total.currency)} />
            <MetricCard label="Mortgage" value={formatCurrency(total.mortgage_balance, total.currency)} />
            <MetricCard label="Estimated equity" value={formatCurrency(total.equity, total.currency)} tone={total.equity >= 0 ? 'green' : 'red'} />
            <MetricCard label="Appreciation" value={formatCurrency(total.appreciation, total.currency)} tone={total.appreciation >= 0 ? 'green' : 'red'} />
          </div>
        </section>
      ))}

      {formOpen && (
        <section className="rounded-xl border border-border bg-surface-2 p-5">
          <h3 className="mb-1 text-sm font-medium">Add Property</h3>
          <p className="mb-4 text-xs text-text-muted">The initial value and mortgage balance become the first history entry.</p>
          <PropertyCreateForm form={form} setForm={setForm} onSubmit={createProperty} saving={saving} />
        </section>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-surface-2 p-8 text-center text-sm text-text-muted">Loading properties…</div>
      ) : properties.length ? (
        <div className="space-y-4">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} onChanged={refetch} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-2 p-8 text-center">
          <div className="text-sm font-medium">No properties tracked yet</div>
          <p className="mt-1 text-xs text-text-muted">Add your home and its current mortgage balance to calculate equity.</p>
          {!formOpen && (
            <button type="button" onClick={() => setFormOpen(true)} className="mt-4 text-sm text-accent hover:text-accent-hover">
              Add your first property
            </button>
          )}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-text-muted">
        Values are estimates you enter manually. Equity is value minus mortgage; appreciation is value minus purchase price and does not include renovations, transaction costs, or selling fees.
      </p>
    </div>
  )
}

function PropertyCreateForm({ form, setForm, onSubmit, saving }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OwnerSelect value={form.owner_scope} onChange={(value) => update('owner_scope', value)} includeLabel />
        <TextField label="Property label" value={form.label} onChange={(value) => update('label', value)} placeholder="Primary Home" required />
        <TextField label="Address (optional)" value={form.address} onChange={(value) => update('address', value)} placeholder="Stored only on your server" />
        <CurrencyField value={form.currency} onChange={(value) => update('currency', value)} />
        <NumberField label="Purchase price" value={form.purchase_price} onChange={(value) => update('purchase_price', value)} min="0" required />
        <DateField label="Purchase date" value={form.purchase_date} onChange={(value) => update('purchase_date', value)} required />
        <NumberField label="Current estimated value" value={form.estimated_value} onChange={(value) => update('estimated_value', value)} min="0.01" required />
        <NumberField label="Remaining mortgage" value={form.mortgage_balance} onChange={(value) => update('mortgage_balance', value)} min="0" required />
        <DateField label="Valuation date" value={form.valuation_date} onChange={(value) => update('valuation_date', value)} required />
        <TextField label="Valuation source" value={form.source_label} onChange={(value) => update('source_label', value)} placeholder="HouseSigma, appraisal…" />
        <TextField label="Source URL (optional)" type="url" value={form.source_url} onChange={(value) => update('source_url', value)} placeholder="https://…" />
        <TextField label="Note (optional)" value={form.note} onChange={(value) => update('note', value)} placeholder="Reason for this estimate" />
      </div>
      <button type="submit" disabled={saving} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">
        {saving ? 'Saving…' : 'Save Property'}
      </button>
    </form>
  )
}

function PropertyCard({ property, onChanged }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [error, setError] = useState(null)

  const changed = () => {
    setHistoryVersion((version) => version + 1)
    onChanged()
  }

  const remove = async () => {
    if (!window.confirm(`Delete ${property.label} and all of its valuation history?`)) return
    setError(null)
    try {
      await deleteApi(`/api/properties/${property.id}`)
      onChanged()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface-2">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{property.label}</h3>
              <OwnerBadge name={property.owner_name} color={property.owner_color} />
              <span className="rounded bg-surface-3 px-2 py-0.5 text-[10px] font-medium">{property.currency}</span>
            </div>
            {property.address && <p className="mt-1 text-xs text-text-muted">{property.address}</p>}
            <p className="mt-1 text-[11px] text-text-muted">
              Purchased {property.purchase_date} for {formatCurrency(property.purchase_price, property.currency)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setUpdating((open) => !open); setEditing(false) }} className="rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent-hover hover:bg-accent/25">
              Update values
            </button>
            <button type="button" onClick={() => { setEditing((open) => !open); setUpdating(false) }} className="rounded-lg px-2 py-1.5 text-xs text-text-muted hover:bg-surface-3 hover:text-text">Edit</button>
            <button type="button" onClick={remove} className="rounded-lg px-2 py-1.5 text-xs text-text-muted hover:bg-red/10 hover:text-red">Delete</button>
          </div>
        </div>

        {error && <div className="mt-3 rounded-lg bg-red/10 px-3 py-2 text-xs text-red">{error}</div>}

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Current value" value={formatCurrency(property.estimated_value, property.currency)} />
          <MetricCard label="Mortgage" value={formatCurrency(property.mortgage_balance, property.currency)} />
          <MetricCard label="Estimated equity" value={formatCurrency(property.equity, property.currency)} tone={property.equity >= 0 ? 'green' : 'red'} />
          <MetricCard
            label="Appreciation"
            value={formatCurrency(property.appreciation, property.currency)}
            sub={property.appreciation_percent == null ? null : `${property.appreciation_percent >= 0 ? '+' : ''}${property.appreciation_percent.toFixed(2)}%`}
            tone={property.appreciation >= 0 ? 'green' : 'red'}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
          <span>As of {property.latest_snapshot?.valuation_date}</span>
          <span>
            Source:{' '}
            {property.latest_snapshot?.source_url ? (
              <a href={property.latest_snapshot.source_url} target="_blank" rel="noreferrer" className="text-accent hover:text-accent-hover">
                {property.latest_snapshot.source_label}
              </a>
            ) : property.latest_snapshot?.source_label}
          </span>
        </div>

        {updating && <SnapshotForm property={property} onSaved={() => { setUpdating(false); changed() }} />}
        {editing && <PropertyEditForm property={property} onSaved={() => { setEditing(false); changed() }} />}

        <button type="button" onClick={() => setExpanded((open) => !open)} className="mt-4 flex w-full items-center justify-center gap-1 border-t border-border pt-3 text-xs text-text-muted hover:text-text">
          {expanded ? 'Hide history' : 'Show history'}
          <span aria-hidden="true">{expanded ? '↑' : '↓'}</span>
        </button>
      </div>
      {expanded && <PropertyHistory property={property} version={historyVersion} onChanged={changed} />}
    </article>
  )
}

function SnapshotForm({ property, onSaved }) {
  const latest = property.latest_snapshot || {}
  const [form, setForm] = useState({
    valuation_date: torontoDate(),
    estimated_value: String(property.estimated_value ?? ''),
    mortgage_balance: String(property.mortgage_balance ?? ''),
    source_label: latest.source_label || 'Manual',
    source_url: latest.source_url || '',
    note: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await postApi(`/api/properties/${property.id}/snapshots`, numericSnapshot(form))
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-border bg-surface-3/50 p-4">
      <div className="text-xs font-medium">Update valuation and mortgage</div>
      {error && <div className="rounded bg-red/10 px-3 py-2 text-xs text-red">{error}</div>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DateField label="As of date" value={form.valuation_date} onChange={(value) => update('valuation_date', value)} required />
        <NumberField label="Estimated value" value={form.estimated_value} onChange={(value) => update('estimated_value', value)} min="0.01" required />
        <NumberField label="Remaining mortgage" value={form.mortgage_balance} onChange={(value) => update('mortgage_balance', value)} min="0" required />
        <TextField label="Source" value={form.source_label} onChange={(value) => update('source_label', value)} />
        <TextField label="Source URL (optional)" type="url" value={form.source_url} onChange={(value) => update('source_url', value)} placeholder="https://…" />
        <TextField label="Note (optional)" value={form.note} onChange={(value) => update('note', value)} />
      </div>
      <button type="submit" disabled={saving} className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50">
        {saving ? 'Saving…' : 'Save Update'}
      </button>
    </form>
  )
}

function PropertyEditForm({ property, onSaved }) {
  const [form, setForm] = useState({
    owner_scope: property.owner_scope,
    label: property.label,
    address: property.address || '',
    currency: property.currency,
    purchase_price: String(property.purchase_price),
    purchase_date: property.purchase_date,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await putApi(`/api/properties/${property.id}`, { ...form, purchase_price: Number(form.purchase_price) })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-border bg-surface-3/50 p-4">
      <div className="text-xs font-medium">Edit property</div>
      {error && <div className="rounded bg-red/10 px-3 py-2 text-xs text-red">{error}</div>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <OwnerSelect value={form.owner_scope} onChange={(value) => update('owner_scope', value)} includeLabel />
        <TextField label="Property label" value={form.label} onChange={(value) => update('label', value)} required />
        <TextField label="Address (optional)" value={form.address} onChange={(value) => update('address', value)} />
        <CurrencyField value={form.currency} onChange={(value) => update('currency', value)} disabled />
        <NumberField label="Purchase price" value={form.purchase_price} onChange={(value) => update('purchase_price', value)} min="0" required />
        <DateField label="Purchase date" value={form.purchase_date} onChange={(value) => update('purchase_date', value)} required />
      </div>
      <p className="text-[10px] text-text-muted">Currency is locked once valuation history exists.</p>
      <button type="submit" disabled={saving} className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50">
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </form>
  )
}

function PropertyHistory({ property, version, onChanged }) {
  const { scopedUrl } = useHousehold()
  const { data, loading, error, refetch } = useApi(scopedUrl(`/api/properties/${property.id}/history?version=${version}`))
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [actionError, setActionError] = useState(null)
  const history = data?.data || []

  const startEdit = (snapshot) => {
    setEditingId(snapshot.id)
    setEditForm({
      valuation_date: snapshot.valuation_date,
      estimated_value: String(snapshot.estimated_value),
      mortgage_balance: String(snapshot.mortgage_balance),
      source_label: snapshot.source_label || 'Manual',
      source_url: snapshot.source_url || '',
      note: snapshot.note || '',
    })
  }

  const saveEdit = async () => {
    setActionError(null)
    try {
      await putApi(`/api/properties/${property.id}/snapshots/${editingId}`, numericSnapshot(editForm))
      setEditingId(null)
      setEditForm(null)
      refetch()
      onChanged()
    } catch (err) {
      setActionError(err.message)
    }
  }

  const remove = async (snapshot) => {
    if (!window.confirm(`Delete the valuation from ${snapshot.valuation_date}?`)) return
    setActionError(null)
    try {
      await deleteApi(`/api/properties/${property.id}/snapshots/${snapshot.id}`)
      refetch()
      onChanged()
    } catch (err) {
      setActionError(err.message)
    }
  }

  return (
    <div className="border-t border-border bg-surface-3/30 p-4 sm:p-5">
      <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">Value history</h4>
      {(error || actionError) && <div className="mb-3 rounded bg-red/10 px-3 py-2 text-xs text-red">{error || actionError}</div>}
      {loading ? (
        <div className="flex h-48 items-center justify-center text-xs text-text-muted">Loading history…</div>
      ) : (
        <>
          {history.length > 1 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <XAxis dataKey="valuation_date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={65} tickFormatter={(value) => compactMoney(value, property.currency)} />
                <Tooltip content={<HistoryTooltip currency={property.currency} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="estimated_value" name="Property value" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="mortgage_balance" name="Mortgage" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="equity" name="Equity" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="mb-4 flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-xs text-text-muted">
              Add another dated update to build the history chart.
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-[760px] w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left uppercase tracking-wider text-text-muted">
                  <th className="p-2 pl-3">Date</th>
                  <th className="p-2 text-right">Value</th>
                  <th className="p-2 text-right">Mortgage</th>
                  <th className="p-2 text-right">Equity</th>
                  <th className="p-2">Source</th>
                  <th className="p-2">Note</th>
                  <th className="p-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((snapshot) => editingId === snapshot.id ? (
                  <SnapshotEditRow key={snapshot.id} form={editForm} setForm={setEditForm} onSave={saveEdit} onCancel={() => { setEditingId(null); setEditForm(null) }} />
                ) : (
                  <tr key={snapshot.id} className="border-b border-border/40">
                    <td className="p-2 pl-3 tabular-nums">{snapshot.valuation_date}</td>
                    <td className="p-2 text-right tabular-nums">{formatCurrency(snapshot.estimated_value, property.currency)}</td>
                    <td className="p-2 text-right tabular-nums">{formatCurrency(snapshot.mortgage_balance, property.currency)}</td>
                    <td className={`p-2 text-right tabular-nums ${snapshot.equity >= 0 ? 'text-green' : 'text-red'}`}>{formatCurrency(snapshot.equity, property.currency)}</td>
                    <td className="p-2">
                      {snapshot.source_url ? <a href={snapshot.source_url} target="_blank" rel="noreferrer" className="text-accent hover:text-accent-hover">{snapshot.source_label}</a> : snapshot.source_label}
                    </td>
                    <td className="max-w-48 truncate p-2 text-text-muted" title={snapshot.note || ''}>{snapshot.note || '—'}</td>
                    <td className="p-2 pr-3 text-right whitespace-nowrap">
                      <button type="button" onClick={() => startEdit(snapshot)} className="mr-2 text-text-muted hover:text-accent">Edit</button>
                      <button type="button" onClick={() => remove(snapshot)} disabled={history.length <= 1} title={history.length <= 1 ? 'Keep at least one valuation' : 'Delete valuation'} className="text-text-muted hover:text-red disabled:cursor-not-allowed disabled:opacity-30">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function SnapshotEditRow({ form, setForm, onSave, onCancel }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  return (
    <tr className="border-b border-border bg-accent/5">
      <td className="p-2 pl-3"><input type="date" value={form.valuation_date} onChange={(event) => update('valuation_date', event.target.value)} className="w-full rounded border border-border bg-surface-3 px-2 py-1 text-xs" /></td>
      <td className="p-2"><input type="number" min="0.01" step="0.01" value={form.estimated_value} onChange={(event) => update('estimated_value', event.target.value)} className="w-full rounded border border-border bg-surface-3 px-2 py-1 text-right text-xs" /></td>
      <td className="p-2"><input type="number" min="0" step="0.01" value={form.mortgage_balance} onChange={(event) => update('mortgage_balance', event.target.value)} className="w-full rounded border border-border bg-surface-3 px-2 py-1 text-right text-xs" /></td>
      <td className="p-2" />
      <td className="p-2">
        <div className="space-y-1">
          <input type="text" value={form.source_label} maxLength={100} aria-label="Valuation source" onChange={(event) => update('source_label', event.target.value)} className="w-full rounded border border-border bg-surface-3 px-2 py-1 text-xs" />
          <input type="url" value={form.source_url} maxLength={500} aria-label="Source URL" placeholder="https://…" onChange={(event) => update('source_url', event.target.value)} className="w-full rounded border border-border bg-surface-3 px-2 py-1 text-xs" />
        </div>
      </td>
      <td className="p-2"><input type="text" value={form.note} maxLength={500} onChange={(event) => update('note', event.target.value)} className="w-full rounded border border-border bg-surface-3 px-2 py-1 text-xs" /></td>
      <td className="p-2 pr-3 text-right whitespace-nowrap">
        <button type="button" onClick={onSave} className="mr-2 text-green">Save</button>
        <button type="button" onClick={onCancel} className="text-text-muted hover:text-red">Cancel</button>
      </td>
    </tr>
  )
}

function HistoryTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 text-text-muted">{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ color: entry.color }}>{entry.name}: {formatCurrency(entry.value, currency)}</div>
      ))}
    </div>
  )
}

function compactMoney(value, currency) {
  const abs = Math.abs(value)
  const suffix = abs >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : abs >= 1_000 ? `${(value / 1_000).toFixed(0)}K` : value.toFixed(0)
  return `${currency} ${suffix}`
}

function MetricCard({ label, value, sub, tone }) {
  const color = tone === 'green' ? 'text-green' : tone === 'red' ? 'text-red' : 'text-text'
  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-surface-2 to-surface-3/50 p-4">
      <div className="mb-1 text-[10px] uppercase tracking-widest text-text-muted">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className={`mt-0.5 text-[11px] tabular-nums ${color}`}>{sub}</div>}
    </div>
  )
}

function TextField({ label, type = 'text', value, onChange, placeholder, required = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-text-muted">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} maxLength={type === 'url' ? 500 : 250} className="w-full rounded-lg border border-border bg-surface-3 px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted/50 focus:border-accent" />
    </label>
  )
}

function NumberField({ label, value, onChange, min, required = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-text-muted">{label}</span>
      <input type="number" step="0.01" min={min} value={value} onChange={(event) => onChange(event.target.value)} required={required} className="w-full rounded-lg border border-border bg-surface-3 px-3 py-2 text-sm text-text outline-none focus:border-accent" />
    </label>
  )
}

function DateField({ label, value, onChange, required = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-text-muted">{label}</span>
      <input type="date" max={torontoDate()} value={value} onChange={(event) => onChange(event.target.value)} required={required} className="w-full rounded-lg border border-border bg-surface-3 px-3 py-2 text-sm text-text outline-none focus:border-accent" />
    </label>
  )
}

function CurrencyField({ value, onChange, disabled = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-text-muted">Currency</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full rounded-lg border border-border bg-surface-3 px-3 py-2 text-sm text-text outline-none focus:border-accent disabled:opacity-60">
        {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
      </select>
    </label>
  )
}
