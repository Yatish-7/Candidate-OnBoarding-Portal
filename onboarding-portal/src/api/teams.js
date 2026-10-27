import client from './client.js'
import { normalizeUser } from './auth.js'

// Team management (Super Admin). The backend returns rich team objects with a
// nested sales lead and member users; we normalise those users to the frontend
// shape and translate the "sales lead" the other way when creating/updating.
function normalizeTeam(t) {
  if (!t) return t
  return {
    id: t.id,
    name: t.name,
    salesLead: t.salesLead ? normalizeUser(t.salesLead) : null,
    salesManager: t.salesManager ? normalizeUser(t.salesManager) : null,
    members: (t.members || []).map(normalizeUser),
  }
}

export async function listTeams() {
  const response = await client.get('/api/teams')
  return (response.data || []).map(normalizeTeam)
}

export async function createTeam({ name, salesLeadId, salesManagerId }) {
  const body = { name }
  if (salesLeadId) body.salesLead = { id: salesLeadId }
  if (salesManagerId) body.salesManager = { id: salesManagerId }
  const response = await client.post('/api/teams', body)
  return normalizeTeam(response.data)
}

// Rename a team (and optionally reassign its lead)
export async function updateTeam(id, { name, salesLeadId, salesManagerId }) {
  const body = {}
  if (name != null) body.name = name
  if (salesLeadId) body.salesLead = { id: salesLeadId }
  if (salesManagerId) body.salesManager = { id: salesManagerId }
  const response = await client.put(`/api/teams/${id}`, body)
  return normalizeTeam(response.data)
}

export async function deleteTeam(id) {
  await client.delete(`/api/teams/${id}`)
}

export async function assignSalesLead(teamId, userId) {
  const response = await client.put(`/api/teams/${teamId}/sales-lead/${userId}`)
  return normalizeTeam(response.data)
}

// Put a Sales Manager over the team (a manager can have many teams), or take it away.
export async function assignSalesManager(teamId, userId) {
  const response = await client.put(`/api/teams/${teamId}/sales-manager/${userId}`)
  return normalizeTeam(response.data)
}

export async function removeSalesManager(teamId) {
  const response = await client.delete(`/api/teams/${teamId}/sales-manager`)
  return normalizeTeam(response.data)
}

// Every team's { id, name } for the "shared with which team" dropdown (any signed-in user)
export async function listTeamOptions() {
  const response = await client.get('/api/teams/options')
  return response.data || []
}

export async function addMember(teamId, userId) {
  const response = await client.post(`/api/teams/${teamId}/members/${userId}`)
  return normalizeTeam(response.data)
}

export async function removeMember(teamId, userId) {
  const response = await client.delete(`/api/teams/${teamId}/members/${userId}`)
  return normalizeTeam(response.data)
}
