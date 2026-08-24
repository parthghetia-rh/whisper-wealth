import { stmtAll, stmtGet } from '../db.js'

export const HOUSEHOLD_SCOPE = 'household'
export const SHARED_SCOPE = 'shared'

export function getPrimaryMember() {
  return stmtGet(
    'SELECT * FROM household_members WHERE is_primary = 1 ORDER BY id LIMIT 1'
  )
}

export function parseScope(value, { allowHousehold = true, activeOnly = false } = {}) {
  const key = String(value || (allowHousehold ? HOUSEHOLD_SCOPE : '')).trim().toLowerCase()
  if (allowHousehold && key === HOUSEHOLD_SCOPE) {
    return { key: HOUSEHOLD_SCOPE, type: 'household', memberId: null, name: 'Combined' }
  }
  if (key === SHARED_SCOPE) {
    return { key: SHARED_SCOPE, type: 'shared', memberId: null, name: 'Shared' }
  }
  const match = /^member:(\d+)$/.exec(key)
  if (!match) throw new Error('Invalid household scope')
  const member = stmtGet('SELECT * FROM household_members WHERE id = ?', [Number(match[1])])
  if (!member || (activeOnly && member.archived_at)) throw new Error('Household member not found')
  return { key: `member:${member.id}`, type: 'member', memberId: member.id, name: member.name, color: member.color }
}

export function readScope(req) {
  return parseScope(req.query.scope)
}

export function readOwner(body, fallbackMemberId = undefined) {
  if (typeof body.owner_scope === 'string' && body.owner_scope.trim()) {
    return parseScope(body.owner_scope, { allowHousehold: false, activeOnly: true })
  }
  if (fallbackMemberId === null) return parseScope(SHARED_SCOPE, { allowHousehold: false })
  const memberId = fallbackMemberId || getPrimaryMember()?.id
  if (!memberId) throw new Error('Primary household member not found')
  return parseScope(`member:${memberId}`, { allowHousehold: false, activeOnly: true })
}

export function scopeWhere(scope, column = 'member_id') {
  if (scope.type === 'household') return { sql: '1 = 1', params: [] }
  if (scope.type === 'shared') return { sql: `${column} IS NULL`, params: [] }
  return { sql: `${column} = ?`, params: [scope.memberId] }
}

export function ownerFields(row) {
  const memberId = row.member_id ?? null
  return {
    owner_scope: memberId == null ? SHARED_SCOPE : `member:${memberId}`,
    owner_name: memberId == null ? 'Shared' : (row.member_name || 'Unknown member'),
    owner_color: memberId == null ? '#94a3b8' : (row.member_color || '#6366f1'),
  }
}

export function ownedRows(table, scope, orderBy = 'r.id') {
  const where = scopeWhere(scope, 'r.member_id')
  return stmtAll(
    `SELECT r.*, m.name AS member_name, m.color AS member_color
     FROM ${table} r LEFT JOIN household_members m ON m.id = r.member_id
     WHERE ${where.sql} ORDER BY ${orderBy}`,
    where.params
  ).map((row) => ({ ...row, ...ownerFields(row) }))
}

export function listSnapshotScopes() {
  return [
    parseScope(HOUSEHOLD_SCOPE),
    parseScope(SHARED_SCOPE),
    ...stmtAll('SELECT id, name, color FROM household_members').map((member) => ({
      key: `member:${member.id}`,
      type: 'member',
      memberId: member.id,
      name: member.name,
      color: member.color,
    })),
  ]
}
