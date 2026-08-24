import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useApi } from '../hooks/useApi'

const HouseholdContext = createContext(null)
const SCOPE_KEY = 'folio-household-scope'
const OWNER_KEY = 'folio-last-owner'

export function HouseholdProvider({ children }) {
  const { data, refetch } = useApi('/api/household/members')
  const members = data?.members || []
  const [scope, setScopeState] = useState(() => localStorage.getItem(SCOPE_KEY) || 'household')

  const validOwnerScopes = useMemo(
    () => new Set(['shared', ...members.map((member) => member.scope)]),
    [members]
  )

  useEffect(() => {
    if (scope.startsWith('member:') && data && !members.some((member) => member.scope === scope)) {
      setScopeState('household')
      localStorage.setItem(SCOPE_KEY, 'household')
    }
  }, [data, members, scope])

  const setScope = useCallback((next) => {
    setScopeState(next)
    localStorage.setItem(SCOPE_KEY, next)
  }, [])

  const scopedUrl = useCallback((url) => {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}scope=${encodeURIComponent(scope)}`
  }, [scope])

  const rememberOwner = useCallback((ownerScope) => {
    if (ownerScope && ownerScope !== 'household') localStorage.setItem(OWNER_KEY, ownerScope)
  }, [])

  let defaultOwnerScope = scope !== 'household' ? scope : localStorage.getItem(OWNER_KEY)
  if (!validOwnerScopes.has(defaultOwnerScope)) {
    defaultOwnerScope = data?.primary_member_id ? `member:${data.primary_member_id}` : ''
  }

  const value = {
    scope, setScope, scopedUrl, members, shared: data?.shared,
    primaryMemberId: data?.primary_member_id, defaultOwnerScope,
    rememberOwner, refetchMembers: refetch,
  }

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export function useHousehold() {
  const value = useContext(HouseholdContext)
  if (!value) throw new Error('useHousehold must be used within HouseholdProvider')
  return value
}
