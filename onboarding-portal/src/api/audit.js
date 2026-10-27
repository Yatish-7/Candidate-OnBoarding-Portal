import client from './client.js'

// The audit log (Super Admin only). The backend returns snake_case SQL rows; we
// map them to the camelCase shape the page uses.

// Which table a log entry belongs to: value = backend key, label = what we show
export const AUDIT_ENTITIES = [
  { value: 'USER', label: 'Users' },
  { value: 'TEAM', label: 'Teams' },
  { value: 'CANDIDATE', label: 'Candidates' },
  { value: 'APPROVAL_ACTION', label: 'Approval actions' },
  { value: 'PASSWORD_RESET', label: 'Password resets' },
  { value: 'SESSION', label: 'Sign-in sessions' },
]

// Envers "revtype": 0 = created, 1 = updated, 2 = deleted
export const AUDIT_ACTIONS = [
  { value: 0, label: 'Created', color: 'green' },
  { value: 1, label: 'Updated', color: 'blue' },
  { value: 2, label: 'Deleted', color: 'red' },
]

function toEntry(row) {
  return {
    key: `${row.entity}-${row.entity_id}-${row.rev}`,
    rev: row.rev,
    at: row.ts, // epoch millis
    user: row.username,
    entity: row.entity,
    entityId: row.entity_id,
    action: row.revtype,
    label: row.label,
  }
}

// GET /api/audit → { content, totalElements, page, size }. Empty filters are left out.
export async function getAuditLog({ entity, action, user, q, from, to, page = 0, size = 20 }) {
  const params = { entity, action, user: user || undefined, q: q || undefined, from, to, page, size }
  const response = await client.get('/api/audit', { params })
  return { ...response.data, content: (response.data.content || []).map(toEntry) }
}

// GET /api/audit/{entity}/{id}/{rev} → { current, previous } snapshots of the record
export async function getAuditDetail(entity, entityId, rev) {
  const response = await client.get(`/api/audit/${entity}/${entityId}/${rev}`)
  return response.data
}
