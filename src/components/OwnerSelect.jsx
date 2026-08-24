import { useEffect } from 'react'
import { useHousehold } from '../context/HouseholdContext'

export default function OwnerSelect({ value, onChange, className = '', includeLabel = false }) {
  const { members, defaultOwnerScope, rememberOwner } = useHousehold()
  const valid = value === 'shared' || members.some((member) => member.scope === value)

  useEffect(() => {
    if (!valid && defaultOwnerScope) onChange(defaultOwnerScope)
  }, [valid, defaultOwnerScope, onChange])

  const change = (event) => {
    onChange(event.target.value)
    rememberOwner(event.target.value)
  }

  return (
    <div className={className}>
      {includeLabel && <label className="block text-xs text-text-muted mb-1">Owner</label>}
      <select
        value={valid ? value : defaultOwnerScope || ''}
        onChange={change}
        className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-accent"
      >
        {!defaultOwnerScope && <option value="">Loading…</option>}
        <option value="shared">Shared</option>
        {members.map((member) => (
          <option key={member.id} value={member.scope}>{member.name}</option>
        ))}
      </select>
    </div>
  )
}

export function OwnerBadge({ name, color }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-muted whitespace-nowrap">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color || '#94a3b8' }} />
      {name || 'Shared'}
    </span>
  )
}
