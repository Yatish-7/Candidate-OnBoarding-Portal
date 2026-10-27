// Fake backend. Each handler says: "when the app calls this URL, answer with this".
// They follow the API contract in CLAUDE.md, so switching to the real backend needs no app changes.
// Handlers really change the in-memory data in data.js, so the whole workflow can be clicked through.

import dayjs from 'dayjs'
import { delay, http, HttpResponse } from 'msw'
import {
  canApproveAccounts,
  canApprovePayroll,
  canApproveSalesLead,
  canComment,
  canCreateCandidate,
  canEdit,
  canFinalApprove,
  canOverride,
  canReviewContracts,
  canReviewHr,
  // The parallel-workflow permissions renamed this to canApproveDoj; the dormant
  // mock still calls it canSetDoj internally.
  canApproveDoj as canSetDoj,
  isDeclined,
} from '../utils/permissions.js'
import { getStatusKey, SUMMARY_GROUPS } from '../utils/status.js'
import { ROLE_LABELS, TEAM_ROLES } from '../utils/roles.js'
import { candidates, getEmailRecipients, makeCandidate, MOCK_PASSWORD, MOCK_USERS, TEAMS } from './data.js'
import { canSeeCandidate } from './visibility.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Mock tokens look like "mock-token-3", where 3 is the user's id.
// (The real backend will send a JWT instead; the app treats both as an opaque string.)
// A deactivated user counts as not logged in, so they're sent back to the login page.
function getUserFromRequest(request) {
  const header = request.headers.get('Authorization') ?? ''
  const id = Number(header.replace('Bearer mock-token-', ''))
  return MOCK_USERS.find((user) => user.id === id && user.active) ?? null
}

// Same error shape we asked the backend to use
function errorResponse(status, message, errors = []) {
  return HttpResponse.json({ status, message, errors }, { status })
}

function validationError(errors) {
  return errorResponse(400, 'Validation failed', errors)
}

function now() {
  return dayjs().format('YYYY-MM-DDTHH:mm:ss')
}

// Finds the candidate in the URL and checks the caller may see it.
// Returns { user, candidate } or { error } (a ready-made error response).
function loadCandidate(request, id) {
  const user = getUserFromRequest(request)
  if (!user) {
    return { error: errorResponse(401, 'Not logged in') }
  }
  const candidate = candidates.find((c) => c.id === Number(id))
  // "Not found" also when they can't see it, so we don't reveal that it exists
  if (!candidate || !canSeeCandidate(user, candidate)) {
    return { error: errorResponse(404, 'Candidate not found') }
  }
  return { user, candidate }
}

// Adds an entry to the approval trail and bumps "last updated".
// Every entry except comments records who got emailed (see getEmailRecipients in data.js).
function addTrailEntry(candidate, user, action, stage, { comment = '', sendsEmail = true } = {}) {
  const time = now()
  candidate.trail.push({
    id: candidate.trail.length + 1,
    actorName: user.name,
    actorRole: user.role,
    action,
    stage,
    comment: comment ?? '',
    emailsSentTo: sendsEmail ? getEmailRecipients(user.role) : [],
    createdAt: time,
  })
  candidate.updatedAt = time
}

// The fields the intake form sends (create and edit)
const INTAKE_FIELDS = [
  'candidateName', 'candidatePersonalEmail', 'candidateDirectNumber', 'teamType',
  'clientName', 'clientReportingManager', 'reportingManagerEmail', 'reportingManagerContact',
  'interviewers',
  'vendor', 'role', 'location', 'billRate', 'payRate', 'startDate', 'ccCompany', 'referral',
  'ssn', 'visaStatus', 'h1TransferDetails', 'workAuthorizationExpDate', 'relocationExpenses',
  'payCycle', 'existingEmployee', 'jobDescription',
]

// Keeps only the intake fields from the request body (ignores anything else sent)
function pickIntakeFields(body) {
  return Object.fromEntries(INTAKE_FIELDS.filter((field) => field in body).map((field) => [field, body[field]]))
}

// A small version of what the backend should check. The form checks much more before sending.
// It also rejects a duplicate personal email, so you can see a backend field error appear in the form.
function validateIntake(body, candidateId = null) {
  const errors = []
  const required = [
    'candidateName', 'candidatePersonalEmail', 'candidateDirectNumber', 'clientName',
    'reportingManagerEmail', 'role', 'billRate', 'payRate', 'startDate', 'ssn', 'visaStatus',
  ]
  for (const field of required) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      errors.push({ field, message: 'This field is required' })
    }
  }

  const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value ?? '')
  if (body.candidatePersonalEmail && !isEmail(body.candidatePersonalEmail)) {
    errors.push({ field: 'candidatePersonalEmail', message: 'Invalid email' })
  }
  ;(body.interviewers ?? []).forEach((interviewer, index) => {
    if (!isEmail(interviewer.email)) {
      errors.push({ field: `interviewers[${index}].email`, message: 'Invalid email' })
    }
  })

  const duplicate = candidates.find(
    (c) =>
      c.id !== candidateId &&
      c.candidatePersonalEmail.toLowerCase() === (body.candidatePersonalEmail ?? '').toLowerCase(),
  )
  if (duplicate) {
    errors.push({ field: 'candidatePersonalEmail', message: 'A candidate with this email already exists' })
  }
  return errors
}

// Builds a handler for POST /api/candidates/:id/<path>.
//   isAllowed(user, candidate) → may this user do it right now?
//   apply(candidate, user, body) → change the candidate; may return an error response instead
// Every action answers with the updated candidate.
function candidateAction(path, isAllowed, apply) {
  return http.post(`/api/candidates/:id/${path}`, async ({ request, params }) => {
    await delay(300)
    const { user, candidate, error } = loadCandidate(request, params.id)
    if (error) {
      return error
    }
    if (!isAllowed(user, candidate)) {
      return errorResponse(403, 'You are not allowed to do this at the current stage')
    }
    const body = await request.json().catch(() => ({}))
    const problem = apply(candidate, user, body)
    if (problem) {
      return problem
    }
    return HttpResponse.json(candidate)
  })
}

// An approval: mark this step APPROVED and make the next step PENDING
function approveAndMoveOn(path, isAllowed, stageKey, stageName, nextStageKey) {
  return candidateAction(path, isAllowed, (candidate, user, body) => {
    candidate.stages[stageKey] = 'APPROVED'
    candidate.stages[nextStageKey] = 'PENDING'
    addTrailEntry(candidate, user, 'APPROVED', stageName, { comment: body.comment })
  })
}

// A decline (HR or Contracts only): needs a comment, sends it back to the Sales Lead
function decline(path, isAllowed, stageKey, stageName) {
  return candidateAction(path, isAllowed, (candidate, user, body) => {
    const problem = requireComment(body)
    if (problem) return problem
    candidate.stages[stageKey] = 'DECLINED'
    addTrailEntry(candidate, user, 'DECLINED', stageName, { comment: body.comment })
  })
}

// Only the Super Admin may manage users. Returns { admin } or { error }.
function requireSuperAdmin(request) {
  const user = getUserFromRequest(request)
  if (!user) {
    return { error: errorResponse(401, 'Not logged in') }
  }
  if (user.role !== 'SUPER_ADMIN') {
    return { error: errorResponse(403, 'Only the Super Admin can manage users') }
  }
  return { admin: user }
}

// Checks a user from the Add/Edit user form. existingUser is null when adding.
// Returns a list of field errors (empty = all good).
function validateUser(body, existingUser, admin) {
  const errors = []
  if (!body.name?.trim()) {
    errors.push({ field: 'name', message: 'Name is required' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email ?? '')) {
    errors.push({ field: 'email', message: 'Enter a valid email' })
  } else if (
    MOCK_USERS.some((u) => u.id !== existingUser?.id && u.email.toLowerCase() === body.email.toLowerCase())
  ) {
    errors.push({ field: 'email', message: 'A user with this email already exists' })
  }
  if (!ROLE_LABELS[body.role]) {
    errors.push({ field: 'role', message: 'Choose a role' })
  }

  // Recruiters and Sales Leads need a team
  if (TEAM_ROLES.includes(body.role)) {
    const team = TEAMS.find((t) => t.id === body.teamId)
    if (!team) {
      errors.push({ field: 'teamId', message: 'Choose a team' })
    }
    // DEFAULT: one active Sales Lead per team, so it's always clear who approves
    const otherLead = MOCK_USERS.find(
      (u) => u.id !== existingUser?.id && u.active && u.role === 'SALES_LEAD' && u.teamId === body.teamId,
    )
    if (team && body.role === 'SALES_LEAD' && body.active !== false && otherLead) {
      errors.push({ field: 'teamId', message: `${team.name} already has a Sales Lead (${otherLead.name})` })
    }
  }

  // The Super Admin can't lock themselves out
  if (existingUser && existingUser.id === admin.id) {
    if (body.role !== 'SUPER_ADMIN') {
      errors.push({ field: 'role', message: "You can't change your own role" })
    }
    if (body.active === false) {
      errors.push({ field: 'active', message: "You can't deactivate your own account" })
    }
  }
  return errors
}

// Turns form values into a stored user (adds teamName; teams only for Recruiter / Sales Lead)
function toUser(body) {
  const team = TEAM_ROLES.includes(body.role) ? TEAMS.find((t) => t.id === body.teamId) : null
  return {
    name: body.name.trim(),
    email: body.email.trim(),
    role: body.role,
    teamId: team?.id ?? null,
    teamName: team?.name ?? null,
  }
}

// For actions where a comment is mandatory (decline, override)
function requireComment(body) {
  if (!body.comment?.trim()) {
    return validationError([{ field: 'comment', message: 'A comment is required' }])
  }
  return null
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const handlers = [
  // ----- Auth -----

  http.post('/api/auth/login', async ({ request }) => {
    await delay(300) // pretend the network takes a moment
    const { email, password } = await request.json()
    const user = MOCK_USERS.find((u) => u.email.toLowerCase() === email?.toLowerCase())

    if (!user || password !== MOCK_PASSWORD) {
      return errorResponse(401, 'Invalid email or password')
    }
    if (!user.active) {
      return errorResponse(403, 'This account has been deactivated. Contact your Super Admin.')
    }
    return HttpResponse.json({ token: `mock-token-${user.id}`, user })
  }),

  http.get('/api/auth/me', async ({ request }) => {
    await delay(150)
    const user = getUserFromRequest(request)
    if (!user) {
      return errorResponse(401, 'Not logged in')
    }
    return HttpResponse.json(user)
  }),

  // ----- Candidate list -----

  // GET /api/candidates?search=&status=&page=0&size=10 → a Spring "Page" object
  http.get('/api/candidates', async ({ request }) => {
    await delay(300)
    const user = getUserFromRequest(request)
    if (!user) {
      return errorResponse(401, 'Not logged in')
    }

    // Read the ?search=...&status=... part of the URL
    const params = new URL(request.url).searchParams
    const search = (params.get('search') ?? '').trim().toLowerCase()
    const status = params.get('status') ?? ''
    const page = Number(params.get('page') ?? 0) // Spring pages start at 0
    const size = Number(params.get('size') ?? 10)

    let results = candidates.filter((candidate) => canSeeCandidate(user, candidate))

    if (search) {
      results = results.filter((c) =>
        [c.candidateName, c.clientName, c.role, c.recruiterName].some((value) =>
          value.toLowerCase().includes(search),
        ),
      )
    }
    if (status) {
      results = results.filter((c) => getStatusKey(c) === status)
    }

    // Most recently updated first
    results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    // Cut out just the requested page, and leave out the trail (the list doesn't need it)
    const content = results
      .slice(page * size, (page + 1) * size)
      .map(({ trail: _trail, ...candidate }) => candidate)

    return HttpResponse.json({
      content,
      totalElements: results.length,
      totalPages: Math.ceil(results.length / size),
      number: page,
      size,
    })
  }),

  // ----- One candidate -----

  http.get('/api/candidates/:id', async ({ request, params }) => {
    await delay(250)
    const { candidate, error } = loadCandidate(request, params.id)
    return error ?? HttpResponse.json(candidate)
  }),

  // POST /api/candidates → create (Recruiter only). Emails the Sales Lead.
  http.post('/api/candidates', async ({ request }) => {
    await delay(400)
    const user = getUserFromRequest(request)
    if (!user) {
      return errorResponse(401, 'Not logged in')
    }
    if (!canCreateCandidate(user)) {
      return errorResponse(403, 'Only recruiters can submit candidates')
    }

    const body = await request.json()
    const errors = validateIntake(body)
    if (errors.length > 0) {
      return validationError(errors)
    }

    // makeCandidate fills in recruiter, team, stages and the "Submitted" trail entry
    const candidate = makeCandidate({
      ...pickIntakeFields(body),
      id: Math.max(...candidates.map((c) => c.id)) + 1,
      recruiterId: user.id,
      createdAt: now(),
    })
    candidates.push(candidate)
    return HttpResponse.json(candidate, { status: 201 })
  }),

  // PUT /api/candidates/{id} → recruiter edit (before Sales Lead approval),
  // or Sales Lead edit + resubmit after a decline
  http.put('/api/candidates/:id', async ({ request, params }) => {
    await delay(400)
    const { user, candidate, error } = loadCandidate(request, params.id)
    if (error) {
      return error
    }
    if (!canEdit(user, candidate)) {
      return errorResponse(403, 'You can no longer edit this candidate')
    }

    const body = await request.json()
    const errors = validateIntake(body, candidate.id)
    if (errors.length > 0) {
      return validationError(errors)
    }
    Object.assign(candidate, pickIntakeFields(body))

    if (isDeclined(candidate)) {
      // DEFAULT: resubmitting starts the reviews again from HR
      Object.assign(candidate.stages, {
        hr: 'PENDING',
        contracts: 'NOT_STARTED',
        payroll: 'NOT_STARTED',
        accounts: 'NOT_STARTED',
        superAdmin: 'NOT_STARTED',
        doj: 'NOT_STARTED',
      })
      addTrailEntry(candidate, user, 'RESUBMITTED', 'SALES_LEAD')
    } else {
      addTrailEntry(candidate, user, 'EDITED', 'RECRUITER')
    }
    return HttpResponse.json(candidate)
  }),

  // ----- Workflow actions (in order) -----

  approveAndMoveOn('sales-lead/approve', canApproveSalesLead, 'salesLead', 'SALES_LEAD', 'hr'),
  approveAndMoveOn('hr/approve', canReviewHr, 'hr', 'HR', 'contracts'),
  decline('hr/decline', canReviewHr, 'hr', 'HR'),
  approveAndMoveOn('contracts/approve', canReviewContracts, 'contracts', 'CONTRACTS', 'payroll'),
  decline('contracts/decline', canReviewContracts, 'contracts', 'CONTRACTS'),
  approveAndMoveOn('payroll/approve', canApprovePayroll, 'payroll', 'PAYROLL', 'accounts'),
  approveAndMoveOn('accounts/approve', canApproveAccounts, 'accounts', 'ACCOUNTS', 'superAdmin'),
  // The Super Admin's final approval hands it back to the recruiter to set the DOJ
  approveAndMoveOn('super-admin/approve', canFinalApprove, 'superAdmin', 'SUPER_ADMIN', 'doj'),

  // The recruiter sets the date of joining → the candidate is Joined
  candidateAction('doj/set', canSetDoj, (candidate, user, body) => {
    if (!body.dojDate) {
      return validationError([{ field: 'dojDate', message: 'Date of joining is required' }])
    }
    candidate.dojDate = body.dojDate
    candidate.stages.doj = 'SET'
    addTrailEntry(candidate, user, 'DOJ_SET', 'DOJ', { comment: `DOJ: ${body.dojDate}` })
  }),

  // The Super Admin can approve or reject at any stage, and change that decision later.
  // Each override (and each change) adds its own trail entry, so the history is kept.
  candidateAction('override', canOverride, (candidate, user, body) => {
    if (body.decision !== 'APPROVED' && body.decision !== 'REJECTED') {
      return validationError([{ field: 'decision', message: 'Choose Approve or Reject' }])
    }
    if (candidate.override?.decision === body.decision) {
      return validationError([{ field: 'decision', message: 'That is already the current decision' }])
    }
    const problem = requireComment(body)
    if (problem) return problem
    candidate.override = { decision: body.decision, by: user.name, at: now(), comment: body.comment }
    addTrailEntry(candidate, user, `OVERRIDE_${body.decision}`, 'ADMIN', { comment: body.comment })
  }),

  // Comments don't send email
  candidateAction('comments', canComment, (candidate, user, body) => {
    if (!body.text?.trim()) {
      return validationError([{ field: 'text', message: 'Write a comment first' }])
    }
    addTrailEntry(candidate, user, 'COMMENT', body.stage, { comment: body.text, sendsEmail: false })
  }),

  // ----- Users and teams (Super Admin) -----

  http.get('/api/teams', async ({ request }) => {
    await delay(150)
    const { error } = requireSuperAdmin(request)
    return error ?? HttpResponse.json(TEAMS)
  }),

  http.get('/api/users', async ({ request }) => {
    await delay(250)
    const { error } = requireSuperAdmin(request)
    return error ?? HttpResponse.json(MOCK_USERS)
  }),

  // POST /api/users { name, email, role, teamId } → the new user (active)
  http.post('/api/users', async ({ request }) => {
    await delay(300)
    const { admin, error } = requireSuperAdmin(request)
    if (error) {
      return error
    }
    const body = await request.json()
    const errors = validateUser(body, null, admin)
    if (errors.length > 0) {
      return validationError(errors)
    }
    const user = { id: Math.max(...MOCK_USERS.map((u) => u.id)) + 1, ...toUser(body), active: true }
    MOCK_USERS.push(user)
    return HttpResponse.json(user, { status: 201 })
  }),

  // PUT /api/users/{id} { name, email, role, teamId, active } → the updated user
  http.put('/api/users/:id', async ({ request, params }) => {
    await delay(300)
    const { admin, error } = requireSuperAdmin(request)
    if (error) {
      return error
    }
    const user = MOCK_USERS.find((u) => u.id === Number(params.id))
    if (!user) {
      return errorResponse(404, 'User not found')
    }
    const body = await request.json()
    const errors = validateUser(body, user, admin)
    if (errors.length > 0) {
      return validationError(errors)
    }
    Object.assign(user, toUser(body), { active: body.active !== false })
    return HttpResponse.json(user)
  }),

  // ----- Dashboard -----

  http.get('/api/dashboard/summary', async ({ request }) => {
    await delay(250)
    const user = getUserFromRequest(request)
    if (!user) {
      return errorResponse(401, 'Not logged in')
    }
    if (user.role !== 'SUPER_ADMIN') {
      return errorResponse(403, 'Only the Super Admin can see the dashboard')
    }

    // Count candidates per group, e.g. { pending: 8, approved: 2, declined: 2, joined: 1 }
    const summary = {}
    for (const [group, statusKeys] of Object.entries(SUMMARY_GROUPS)) {
      summary[group] = candidates.filter((c) => statusKeys.includes(getStatusKey(c))).length
    }
    return HttpResponse.json(summary)
  }),
]
