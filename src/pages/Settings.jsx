import { useState } from 'react'
import { useApi, postApi, putApi, deleteApi } from '../hooks/useApi'
import {
  isBiometricAvailable, isBiometricEnabled,
  registerBiometric, disableBiometric,
} from '../components/BiometricLock'
import { useHousehold } from '../context/HouseholdContext'

export default function Settings() {
  const { data: settings, refetch } = useApi('/api/settings')
  const [bioEnabled, setBioEnabled] = useState(isBiometricEnabled)
  const [bioError, setBioError] = useState(null)
  const bioAvailable = isBiometricAvailable()

  const toggle = async (key) => {
    const current = settings?.[key] === 'true'
    await putApi('/api/settings', { [key]: String(!current) })
    refetch()
  }

  const handleBiometricToggle = async () => {
    setBioError(null)
    if (bioEnabled) {
      disableBiometric()
      setBioEnabled(false)
    } else {
      try {
        const ok = await registerBiometric()
        setBioEnabled(ok)
        if (!ok) setBioError('Registration failed')
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          setBioError('Cancelled by user')
        } else {
          setBioError(err.message)
        }
      }
    }
  }

  if (!settings) return null

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-text-muted mt-0.5">
          Portfolio behavior and security
        </p>
      </div>

      <div className="space-y-4">
        <HouseholdMembers />

        <div className="bg-surface-2 rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium mb-4">Security</h3>
          <ToggleRow
            label="Biometric lock"
            description={
              bioAvailable
                ? 'Require fingerprint, Face ID, or Windows Hello to open WhisperWealth. The app locks every time you open it.'
                : 'Biometric authentication is not available on this device or browser.'
            }
            enabled={bioEnabled}
            onToggle={handleBiometricToggle}
            disabled={!bioAvailable}
          />
          {bioError && (
            <p className="text-xs text-red mt-2">{bioError}</p>
          )}
        </div>

        <div className="bg-surface-2 rounded-xl border border-border p-5">
          <h3 className="text-sm font-medium mb-4">Sitting Cash</h3>
          <ToggleRow
            label="Compound interest"
            description="When enabled, projected interest income is calculated with monthly compounding. When disabled, uses simple interest."
            enabled={settings.cash_interest_compound === 'true'}
            onToggle={() => toggle('cash_interest_compound')}
          />
        </div>
      </div>
    </div>
  )
}

function HouseholdMembers() {
  const { data, refetch } = useApi('/api/household/members?include_archived=true')
  const { refetchMembers } = useHousehold()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#6366f1')
  const [error, setError] = useState(null)

  const refresh = () => { refetch(); refetchMembers() }
  const addMember = async (event) => {
    event.preventDefault()
    setError(null)
    try {
      await postApi('/api/household/members', { name, color })
      setName('')
      refresh()
    } catch (err) { setError(err.message) }
  }
  const startEdit = (member) => {
    setEditingId(member.id)
    setEditName(member.name)
    setEditColor(member.color)
  }
  const saveEdit = async () => {
    setError(null)
    try {
      await putApi(`/api/household/members/${editingId}`, { name: editName, color: editColor })
      setEditingId(null)
      refresh()
    } catch (err) { setError(err.message) }
  }
  const archive = async (id) => {
    try { await deleteApi(`/api/household/members/${id}`); refresh() } catch (err) { setError(err.message) }
  }
  const restore = async (id) => {
    try { await putApi(`/api/household/members/${id}`, { archived: false }); refresh() } catch (err) { setError(err.message) }
  }

  return (
    <div className="bg-surface-2 rounded-xl border border-border p-5">
      <h3 className="text-sm font-medium">Household members</h3>
      <p className="text-xs text-text-muted mt-1 mb-4">Assign entries to a person or Shared, then switch views from the top of the app.</p>
      {error && <div className="text-xs text-red bg-red/10 rounded-lg px-3 py-2 mb-3">{error}</div>}
      <div className="space-y-2 mb-4">
        {(data?.members || []).map((member) => (
          <div key={member.id} className="flex items-center gap-2 rounded-lg bg-surface-3/60 px-3 py-2">
            {editingId === member.id ? <>
              <input type="color" value={editColor} onChange={(event) => setEditColor(event.target.value)} className="w-8 h-8 bg-transparent" />
              <input value={editName} onChange={(event) => setEditName(event.target.value)} className="min-w-0 flex-1 bg-surface-2 border border-border rounded px-2 py-1 text-sm" />
              <button onClick={saveEdit} className="text-xs text-green">Save</button>
              <button onClick={() => setEditingId(null)} className="text-xs text-text-muted">Cancel</button>
            </> : <>
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: member.color }} />
              <span className="flex-1 text-sm">{member.name}</span>
              {member.is_primary && <span className="text-[10px] text-text-muted">Primary</span>}
              {member.archived ? (
                <button onClick={() => restore(member.id)} className="text-xs text-accent">Restore</button>
              ) : <>
                <button onClick={() => startEdit(member)} className="text-xs text-accent">Edit</button>
                {!member.is_primary && <button onClick={() => archive(member.id)} className="text-xs text-red">Archive</button>}
              </>}
            </>}
          </div>
        ))}
      </div>
      <form onSubmit={addMember} className="flex items-end gap-2">
        <div>
          <label className="block text-xs text-text-muted mb-1">Color</label>
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="w-10 h-9 bg-transparent" />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-text-muted mb-1">New member</label>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" required maxLength={50}
            className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent" />
        </div>
        <button type="submit" className="bg-accent hover:bg-accent-hover text-white rounded-lg px-4 py-2 text-sm">Add</button>
      </form>
    </div>
  )
}

function ToggleRow({ label, description, enabled, onToggle, disabled }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          disabled ? 'opacity-30 cursor-not-allowed' : ''
        } ${enabled ? 'bg-accent' : 'bg-surface-3'}`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
            enabled ? 'translate-x-5.5 ml-0.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
