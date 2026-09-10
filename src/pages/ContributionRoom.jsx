import { useEffect, useMemo, useState } from 'react'
import { deleteApi, postApi, putApi, useApi } from '../hooks/useApi'
import { useHousehold } from '../context/HouseholdContext'
import { OwnerBadge } from '../components/OwnerSelect'
import ActionSheet from '../components/ActionSheet'
import RecordListSkeleton from '../components/RecordListSkeleton'
import { notify } from '../components/ToastViewport'
import { formatCurrency } from '../utils/currency'

const CONTROL = 'min-h-11 w-full rounded-lg border border-border bg-surface-3 px-3 text-sm text-text outline-none focus:border-accent'
const ACCOUNT_TYPES = [
  { value: 'TFSA', label: 'TFSA' },
  { value: 'RRSP', label: 'RRSP' },
  { value: 'FHSA', label: 'FHSA' },
  { value: 'OTHER', label: 'Other' },
]
const ENTRY_TYPES = [
  { value: 'contribution', label: 'Contribution', help: 'Reduces remaining room' },
  { value: 'withdrawal', label: 'Withdrawal', help: 'Recorded only; does not automatically restore room' },
  { value: 'adjustment', label: 'Room correction', help: 'Positive or negative correction to available room' },
]

const today = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())
const currentYear = () => Number(today().slice(0, 4))

function emptyRoom(ownerScope = '', year = currentYear()) {
  return {
    owner_scope: ownerScope, account_type: 'TFSA', label: 'TFSA', year: String(year),
    currency: 'CAD', opening_room: '', note: '',
  }
}

function emptyEntry(room) {
  const date = today()
  return {
    entry_type: 'contribution', amount: '',
    entry_date: date.startsWith(String(room.year)) ? date : `${room.year}-01-01`, note: '',
  }
}

export default function ContributionRoom() {
  const { scopedUrl, scope, members, defaultOwnerScope, primaryMemberId } = useHousehold()
  const { data, loading, error, refetch } = useApi(scopedUrl('/api/contribution-room'))
  const [year, setYear] = useState(String(currentYear()))
  const [roomForm, setRoomForm] = useState(null)
  const [editingRoom, setEditingRoom] = useState(null)
  const [entryRoom, setEntryRoom] = useState(null)
  const [editingEntry, setEditingEntry] = useState(null)
  const [saving, setSaving] = useState(false)

  const ownerScope = defaultOwnerScope?.startsWith('member:')
    ? defaultOwnerScope
    : primaryMemberId ? `member:${primaryMemberId}` : ''
  const items = data?.items || []
  const years = useMemo(() => [...new Set([currentYear(), ...items.map((item) => item.year)])].sort((a, b) => b - a), [items])
  const visibleItems = year === 'all' ? items : items.filter((item) => String(item.year) === year)

  useEffect(() => {
    if (roomForm && !roomForm.owner_scope && ownerScope) {
      setRoomForm((current) => current ? { ...current, owner_scope: ownerScope } : current)
    }
  }, [ownerScope, roomForm])

  const closeRoomForm = () => { setRoomForm(null); setEditingRoom(null) }
  const closeEntryForm = () => { setEntryRoom(null); setEditingEntry(null) }

  const saveRoom = async (event) => {
    event.preventDefault()
    setSaving(true)
    const payload = { ...roomForm, year: Number(roomForm.year), opening_room: Number(roomForm.opening_room) }
    try {
      if (editingRoom) await putApi(`/api/contribution-room/${editingRoom.id}`, payload)
      else await postApi('/api/contribution-room', payload)
      notify(editingRoom ? 'Contribution room updated' : 'Contribution room added')
      setYear(String(payload.year))
      closeRoomForm()
      refetch()
    } catch (err) {
      notify(err.message, { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const saveEntry = async (event) => {
    event.preventDefault()
    setSaving(true)
    const payload = { ...editingEntry, amount: Number(editingEntry.amount) }
    try {
      if (editingEntry.id) await putApi(`/api/contribution-room/${entryRoom.id}/entries/${editingEntry.id}`, payload)
      else await postApi(`/api/contribution-room/${entryRoom.id}/entries`, payload)
      notify(editingEntry.id ? 'Contribution activity updated' : 'Contribution activity added')
      closeEntryForm()
      refetch()
    } catch (err) {
      notify(err.message, { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const editRoom = (room) => {
    setEditingRoom(room)
    setRoomForm({
      owner_scope: room.owner_scope, account_type: room.account_type, label: room.label,
      year: String(room.year), currency: room.currency,
      opening_room: String(room.opening_room), note: room.note || '',
    })
  }

  const removeRoom = async (room) => {
    if (!window.confirm(`Delete ${room.label} and all of its activity?`)) return
    try {
      await deleteApi(`/api/contribution-room/${room.id}`)
      notify('Contribution room deleted', { tone: 'info' })
      refetch()
    } catch (err) {
      notify(err.message, { tone: 'error' })
    }
  }

  const openEntry = (room, entry = null) => {
    setEntryRoom(room)
    setEditingEntry(entry ? { ...entry, amount: String(entry.amount), note: entry.note || '' } : emptyEntry(room))
  }

  const removeEntry = async (room, entry) => {
    if (!window.confirm('Delete this contribution-room activity?')) return
    try {
      await deleteApi(`/api/contribution-room/${room.id}/entries/${entry.id}`)
      notify('Contribution activity deleted', { tone: 'info' })
      refetch()
    } catch (err) {
      notify(err.message, { tone: 'error' })
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Contribution Room</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-text-muted">Track registered-account room per person without guessing government limits.</p>
        </div>
        <button type="button" onClick={() => { setEditingRoom(null); setRoomForm(emptyRoom(ownerScope, year === 'all' ? currentYear() : Number(year))) }} disabled={!members.length} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">
          Add room tracker
        </button>
      </div>

      <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-xs leading-relaxed text-text-muted">
        Remaining room equals opening room plus corrections, minus contributions. Withdrawals are recorded but never restored automatically because account rules differ.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-text-muted">
          Tracking year
          <select value={year} onChange={(event) => setYear(event.target.value)} className="min-h-11 rounded-lg border border-border bg-surface-2 px-3 text-sm text-text outline-none focus:border-accent">
            {years.map((value) => <option key={value} value={value}>{value}</option>)}
            <option value="all">All years</option>
          </select>
        </label>
        {scope === 'shared' && <p className="text-xs text-text-muted">Contribution room is personal. Select a member or Combined household view.</p>}
      </div>

      {year !== 'all' && <ContributionSummary rooms={visibleItems} />}
      {error && <div role="alert" className="rounded-lg bg-red/10 px-3 py-2 text-xs text-red">{error}</div>}
      {loading ? (
        <RecordListSkeleton count={3} />
      ) : !visibleItems.length ? (
        <div className="rounded-xl border border-border bg-surface-2 p-8 text-center text-text-muted">
          <p className="text-sm font-medium text-text">No contribution-room trackers for {year === 'all' ? 'this view' : year}</p>
          <p className="mt-1 text-xs">Add the room amount from your own records, then log contributions as they happen.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleItems.map((room) => (
            <ContributionRoomCard key={room.id} room={room} onAddEntry={() => openEntry(room)} onEditRoom={() => editRoom(room)} onDeleteRoom={() => removeRoom(room)} onEditEntry={(entry) => openEntry(room, entry)} onDeleteEntry={(entry) => removeEntry(room, entry)} />
          ))}
        </div>
      )}

      <ActionSheet open={Boolean(roomForm)} onClose={closeRoomForm} title={editingRoom ? 'Edit contribution room' : 'Add contribution room'} description="Use the amount available before the entries you will record for this year." size="lg">
        {roomForm && <RoomForm form={roomForm} setForm={setRoomForm} members={members} onSubmit={saveRoom} saving={saving} onCancel={closeRoomForm} />}
      </ActionSheet>
      <ActionSheet open={Boolean(entryRoom && editingEntry)} onClose={closeEntryForm} title={editingEntry?.id ? 'Edit activity' : 'Add activity'} description={entryRoom ? `${entryRoom.label} · ${entryRoom.year}` : undefined} size="lg">
        {entryRoom && editingEntry && <EntryForm form={editingEntry} setForm={setEditingEntry} currency={entryRoom.currency} onSubmit={saveEntry} saving={saving} onCancel={closeEntryForm} />}
      </ActionSheet>
    </div>
  )
}

function ContributionSummary({ rooms }) {
  const totals = Object.values(rooms.reduce((all, room) => {
    if (!all[room.currency]) all[room.currency] = { currency: room.currency, available: 0, contributed: 0, remaining: 0, over: 0 }
    all[room.currency].available += room.available_room
    all[room.currency].contributed += room.contributed
    all[room.currency].remaining += room.remaining
    all[room.currency].over += room.over_contribution
    return all
  }, {}))
  if (!totals.length) return null
  return (
    <div className="space-y-3">
      {totals.map((total) => (
        <div key={total.currency} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryMetric label="Available room" value={formatCurrency(total.available, total.currency)} />
          <SummaryMetric label="Contributed" value={formatCurrency(total.contributed, total.currency)} />
          <SummaryMetric label="Remaining" value={formatCurrency(total.remaining, total.currency)} tone={total.remaining < 0 ? 'red' : 'green'} />
          <SummaryMetric label="Over contribution" value={formatCurrency(total.over, total.currency)} tone={total.over > 0 ? 'red' : undefined} />
        </div>
      ))}
    </div>
  )
}

function SummaryMetric({ label, value, tone }) {
  return <div className="rounded-xl border border-border bg-surface-2 p-4"><p className="text-xs text-text-muted">{label}</p><p className={`mt-1 text-lg font-semibold tabular-nums ${tone === 'green' ? 'text-green' : tone === 'red' ? 'text-red' : ''}`}>{value}</p></div>
}

export function ContributionRoomCard({ room, onAddEntry, onEditRoom, onDeleteRoom, onEditEntry, onDeleteEntry }) {
  const used = Math.max(0, Math.min(100, room.used_percent || 0))
  return (
    <article className={`overflow-hidden rounded-xl border bg-surface-2 ${room.over_contribution > 0 ? 'border-red/40' : 'border-border'}`}>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-accent/15 px-2 py-1 text-xs font-semibold text-accent-hover">{room.account_type}</span><h3 className="font-semibold">{room.label}</h3><OwnerBadge name={room.owner_name} color={room.owner_color} /></div>
            <p className="mt-1 text-xs text-text-muted">{room.year} · {room.currency}</p>
          </div>
          <div className="flex items-center gap-1"><button type="button" onClick={onEditRoom} className="icon-button px-2 text-xs" aria-label={`Edit ${room.label}`}>Edit</button><button type="button" onClick={onDeleteRoom} className="icon-button px-2 text-xs hover:!bg-red/10 hover:!text-red" aria-label={`Delete ${room.label}`}>Delete</button></div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div><p className="text-xs text-text-muted">Remaining room</p><p className={`mt-0.5 text-2xl font-semibold tabular-nums ${room.remaining < 0 ? 'text-red' : 'text-green'}`}>{formatCurrency(room.remaining, room.currency)}</p></div>
          <p className="text-right text-xs tabular-nums text-text-muted">{room.used_percent == null ? 'No available room' : `${room.used_percent.toFixed(1)}% used`}</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label={`${room.label} contribution room used`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(used)}><div className={`h-full rounded-full ${room.over_contribution > 0 ? 'bg-red' : 'bg-accent'}`} style={{ width: `${used}%` }} /></div>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-4 text-xs sm:grid-cols-4">
          <div><dt className="text-text-muted">Opening</dt><dd className="mt-1 font-medium tabular-nums">{formatCurrency(room.opening_room, room.currency)}</dd></div>
          <div><dt className="text-text-muted">Corrections</dt><dd className="mt-1 font-medium tabular-nums">{formatCurrency(room.adjustments, room.currency)}</dd></div>
          <div><dt className="text-text-muted">Contributed</dt><dd className="mt-1 font-medium tabular-nums">{formatCurrency(room.contributed, room.currency)}</dd></div>
          <div><dt className="text-text-muted">Withdrawn</dt><dd className="mt-1 font-medium tabular-nums">{formatCurrency(room.withdrawn, room.currency)}</dd></div>
        </dl>
        {room.note && <p className="mt-3 text-xs leading-relaxed text-text-muted">{room.note}</p>}

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3"><h4 className="text-xs font-medium uppercase tracking-wider text-text-muted">Activity</h4><button type="button" onClick={onAddEntry} className="min-h-11 rounded-lg bg-accent/15 px-3 text-xs font-medium text-accent-hover hover:bg-accent/25">Add activity</button></div>
        {!room.entries.length ? <p className="py-4 text-xs text-text-muted">No contributions or adjustments recorded.</p> : (
          <div className="mt-2 divide-y divide-border/50">
            {room.entries.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
                <EntryIcon type={entry.entry_type} />
                <div className="min-w-0 flex-1"><p className="text-sm font-medium capitalize">{entry.entry_type === 'adjustment' ? 'Room correction' : entry.entry_type}</p><p className="truncate text-xs text-text-muted">{entry.entry_date}{entry.note ? ` · ${entry.note}` : ''}</p></div>
                <p className={`shrink-0 text-sm font-semibold tabular-nums ${entry.entry_type === 'contribution' || (entry.entry_type === 'adjustment' && entry.amount < 0) ? 'text-red' : entry.entry_type === 'adjustment' ? 'text-green' : 'text-text-muted'}`}>{entry.entry_type === 'withdrawal' ? '↗ ' : entry.entry_type === 'contribution' || entry.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(entry.amount), room.currency)}</p>
                <div className="ml-auto flex shrink-0 sm:ml-0"><button type="button" onClick={() => onEditEntry(entry)} className="icon-button px-2 text-xs" aria-label={`Edit activity from ${entry.entry_date}`}>Edit</button><button type="button" onClick={() => onDeleteEntry(entry)} className="icon-button px-2 text-xs hover:!bg-red/10 hover:!text-red" aria-label={`Delete activity from ${entry.entry_date}`}>Delete</button></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

function EntryIcon({ type }) {
  const style = type === 'contribution' ? 'bg-red/10 text-red' : type === 'withdrawal' ? 'bg-green/10 text-green' : 'bg-accent/10 text-accent-hover'
  return <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${style}`}>{type === 'contribution' ? '↓' : type === 'withdrawal' ? '↑' : '±'}</span>
}

function RoomForm({ form, setForm, members, onSubmit, saving, onCancel }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const setType = (accountType) => setForm((current) => ({
    ...current, account_type: accountType,
    label: !current.label || ACCOUNT_TYPES.some((type) => type.value === current.label) ? accountType : current.label,
  }))
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Owner"><select required value={form.owner_scope} onChange={(event) => update('owner_scope', event.target.value)} className={CONTROL}>{!form.owner_scope && <option value="">Select a member</option>}{members.map((member) => <option key={member.id} value={member.scope}>{member.name}</option>)}</select></Field>
        <Field label="Account type"><select value={form.account_type} onChange={(event) => setType(event.target.value)} className={CONTROL}>{ACCOUNT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></Field>
        <Field label="Label"><input required maxLength={100} value={form.label} onChange={(event) => update('label', event.target.value)} placeholder="My TFSA" className={CONTROL} /></Field>
        <Field label="Tracking year"><input required type="number" min="1990" max={currentYear() + 1} value={form.year} onChange={(event) => update('year', event.target.value)} className={CONTROL} /></Field>
        <Field label="Currency"><select value={form.currency} onChange={(event) => update('currency', event.target.value)} className={CONTROL}><option value="CAD">CAD</option><option value="USD">USD</option></select></Field>
        <Field label="Opening room" help="Room available before this tracker's activity"><input required type="number" min="0" step="0.01" value={form.opening_room} onChange={(event) => update('opening_room', event.target.value)} placeholder="7000" className={CONTROL} /></Field>
      </div>
      <Field label="Note (optional)"><textarea maxLength={500} rows={3} value={form.note} onChange={(event) => update('note', event.target.value)} placeholder="Source or calculation notes" className={`${CONTROL} py-2`} /></Field>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}

function EntryForm({ form, setForm, currency, onSubmit, saving, onCancel }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const selectedType = ENTRY_TYPES.find((type) => type.value === form.entry_type)
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Activity type" help={selectedType?.help}><select value={form.entry_type} onChange={(event) => update('entry_type', event.target.value)} className={CONTROL}>{ENTRY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={`Amount (${currency})`} help={form.entry_type === 'adjustment' ? 'Use a negative number to reduce room' : undefined}><input required type="number" step="0.01" value={form.amount} onChange={(event) => update('amount', event.target.value)} placeholder="1000" className={CONTROL} /></Field>
        <Field label="Date"><input required type="date" max={today()} value={form.entry_date} onChange={(event) => update('entry_date', event.target.value)} className={CONTROL} /></Field>
      </div>
      <Field label="Note (optional)"><input maxLength={500} value={form.note} onChange={(event) => update('note', event.target.value)} placeholder="Deposit, CRA correction…" className={CONTROL} /></Field>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}

function Field({ label, help, children }) {
  return <label className="block"><span className="mb-1 block text-xs text-text-muted">{label}</span>{children}{help && <span className="mt-1 block text-[10px] leading-relaxed text-text-muted">{help}</span>}</label>
}

function FormActions({ saving, onCancel }) {
  return <div className="flex justify-end gap-2 border-t border-border pt-4"><button type="button" onClick={onCancel} className="min-h-11 rounded-lg px-4 text-sm text-text-muted hover:bg-surface-3 hover:text-text">Cancel</button><button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button></div>
}
