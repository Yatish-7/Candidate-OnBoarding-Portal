import client from './client.js'

// The Spring Boot backend returns slightly different shapes than the frontend
// uses internally, so we normalise them here (in one place) and the rest of the
// app keeps working with { id, name, email, role, teamId, teamName, active }.
export function normalizeUser(raw) {
  if (!raw) return null
  return {
    id: raw.id ?? raw.userId,
    name: raw.name ?? raw.fullName,
    email: raw.email,
    role: raw.role,
    teamId: raw.teamId ?? raw.team?.id ?? null,
    teamName: raw.teamName ?? raw.team?.name ?? null,
    // Only sent for the signed-in user (/auth/me, login): who approves their team's candidates
    salesLeadName: raw.salesLeadName ?? null,
    // Recruiters only: their office, copied onto every candidate they submit
    location: raw.location ?? null,
    salesManagerName: raw.salesManagerName ?? null,
    active: raw.active ?? true,
    // true until the user replaces a password an admin set (the backend enforces it)
    mustChangePassword: raw.mustChangePassword ?? false,
    lastLoginAt: raw.lastLoginAt ?? null,
  }
}

// POST /api/auth/login → backend sends { token, idleTimeoutMinutes, userId, fullName, email, role, teamId, teamName }
// We return { token, idleTimeoutMinutes, user } so AuthProvider can use it directly.
export async function login(email, password) {
  const response = await client.post('/api/auth/login', { email, password })
  return {
    token: response.data.token,
    idleTimeoutMinutes: response.data.idleTimeoutMinutes,
    user: normalizeUser(response.data),
  }
}

// POST /api/auth/logout → ends this session on the server (the token stops working).
// Pass 'IDLE_TIMEOUT' when signing out automatically, so the audit log records why.
export async function logout(reason) {
  await client.post('/api/auth/logout', null, { params: { reason } })
}

// GET /api/auth/me → the backend User entity; normalise it to the frontend shape.
export async function getMe() {
  const response = await client.get('/api/auth/me')
  return normalizeUser(response.data)
}

// POST /api/auth/change-password → the signed-in user sets a new password.
export async function changePassword(currentPassword, newPassword) {
  const response = await client.post('/api/auth/change-password', { currentPassword, newPassword })
  return response.data
}

// POST /api/auth/forgot-password → the backend emails a reset link if the account
// exists. It always responds with a generic message (never reveals whether the
// email is registered), so we just return it.
export async function requestPasswordReset(email) {
  const response = await client.post('/api/auth/forgot-password', { email })
  return response.data
}

// POST /api/auth/reset-password → set a new password using the emailed token.
export async function resetPassword(token, newPassword) {
  const response = await client.post('/api/auth/reset-password', { token, newPassword })
  return response.data
}
