import client from './client.js'
import { normalizeUser } from './auth.js'

// User management (Super Admin). The backend User entity uses `fullName` and a
// nested `team`, so we normalise to the frontend shape { id, name, email, role,
// teamId, teamName, active } and translate the other way when creating.

// GET /api/users → normalised users
export async function getUsers() {
  const response = await client.get('/api/users')
  return (response.data || []).map(normalizeUser)
}

// GET /api/users/by-role/{role} → all users of a role (works for any caller, so a
// Sales Lead can list recruiters to add to their team).
export async function getUsersByRole(role) {
  const response = await client.get(`/api/users/by-role/${role}`)
  return (response.data || []).map(normalizeUser)
}

// POST /api/users { name, email, role, teamId } → the new user
// The admin sets the new user's temporary password (the backend enforces the password rules).
export async function createUser(data) {
  const body = {
    fullName: data.name,
    email: data.email,
    password: data.password,
    role: data.role,
    team: data.teamId ? { id: data.teamId } : null,
    location: data.location ?? null,
  }
  const response = await client.post('/api/users', body)
  return normalizeUser(response.data)
}

// PUT /api/users/{id} → edit a user (name, email, role, team) and activate/
// deactivate via the `active` flag. Translates to the backend's User shape.
export async function updateUser(id, data) {
  const body = {
    fullName: data.name,
    email: data.email,
    role: data.role,
    team: data.teamId ? { id: data.teamId } : null,
    location: data.location ?? null,
    active: data.active,
  }
  const response = await client.put(`/api/users/${id}`, body)
  return normalizeUser(response.data)
}

// Permanently remove a user (Super Admin only). The backend blocks this if they
// have submitted candidates (deactivate them instead).
export async function deleteUserPermanently(id) {
  await client.delete(`/api/users/${id}/permanent`)
}

// GET /api/teams → [{ id, name }] (backend returns richer team objects; we keep id+name)
export async function getTeams() {
  const response = await client.get('/api/teams')
  return (response.data || []).map((t) => ({ id: t.id, name: t.name }))
}
