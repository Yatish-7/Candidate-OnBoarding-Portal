import client from './client.js'

// ---------------------------------------------------------------------------
// The Spring Boot backend uses a different candidate shape than the frontend:
//   backend:  status + hrDecision + contractsDecision + dojStatus (+ dojDate)
//   frontend: a per-stage `stages` object + `override`
// We translate between the two here so the pages/components stay unchanged.
// NOTE: the backend runs HR and Contracts in PARALLEL (not the long sequential
// chain the mock used); Payroll/Accounts are view-only and the Super Admin only
// overrides. We map that onto the stage shape as closely as we can.
// ---------------------------------------------------------------------------

function stageFrom(decision) {
  if (decision === 'APPROVED') return 'APPROVED'
  if (decision === 'DECLINED') return 'DECLINED'
  return 'PENDING'
}

// backend candidate → frontend candidate
export function toFrontendCandidate(b) {
  if (!b) return b
  const salesLeadDeclined = b.status === 'SALES_LEAD_DECLINED'
  const salesLeadApproved = b.status !== 'PENDING_SALES_LEAD_APPROVAL' && !salesLeadDeclined

  const hrAndContractsApproved = b.hrDecision === 'APPROVED' && b.contractsDecision === 'APPROVED'

  const stages = {
    salesLead: salesLeadDeclined
      ? 'DECLINED'
      : b.status === 'PENDING_SALES_LEAD_APPROVAL'
        ? 'PENDING'
        : 'APPROVED',
    hr: salesLeadApproved ? stageFrom(b.hrDecision) : 'NOT_STARTED',
    contracts: salesLeadApproved ? stageFrom(b.contractsDecision) : 'NOT_STARTED',
    // Payroll and Accounts decide in parallel, but only once HR AND Contracts have both approved.
    payroll: hrAndContractsApproved ? stageFrom(b.payrollDecision) : 'NOT_STARTED',
    accounts: hrAndContractsApproved ? stageFrom(b.accountsDecision) : 'NOT_STARTED',
    // The backend has no Super Admin approval step; COMPLETED = HR, Contracts, Payroll and Accounts all approved.
    superAdmin: b.status === 'COMPLETED' ? 'APPROVED' : 'NOT_STARTED',
    // DOJ: recruiter supplies the date at intake (RAISED), Sales Lead approves (APPROVED).
    doj: b.dojStatus === 'APPROVED' ? 'SET' : b.dojStatus === 'RAISED' ? 'PENDING' : 'NOT_STARTED',
  }

  let override = null
  if (b.status === 'OVERRIDE_APPROVED') {
    override = { decision: 'APPROVED', comment: null, at: b.updatedAt }
  } else if (b.status === 'OVERRIDE_REJECTED') {
    override = { decision: 'REJECTED', comment: b.lastDeclineReason, at: b.updatedAt }
  }

  return {
    ...b,
    role: b.jobRole,
    ssn: b.ssnMasked, // the API only ever sends ***-**-1234, never the full SSN
    leadName: b.leadOrTeamName,
    teamId: b.team?.id ?? null,
    teamName: b.team?.name ?? null,
    sharedTeamId: b.sharedWithTeam?.id ?? null,
    sharedTeamName: b.sharedWithTeam?.name ?? null,
    recruiterId: b.submittedBy?.id ?? null,
    recruiterName: b.recruiterName ?? b.submittedBy?.fullName ?? '',
    interviewers: b.interviewers ?? [],
    stages,
    override,
    backendStatus: b.status,
  }
}

// frontend form data → backend candidate body
export function toBackendCandidate(d) {
  return {
    candidateName: d.candidateName,
    candidatePersonalEmail: d.candidatePersonalEmail,
    candidateDirectNumber: d.candidateDirectNumber,
    recruiterName: d.recruiterName,
    sourcingRecruiter: d.sourcingRecruiter,
    sourcingRecruiterLead: d.sourcingRecruiterLead,
    // (the recruiter's location is set by the server from their profile)
    teamType: d.teamType,
    referralAmount: d.referralAmount != null ? String(d.referralAmount) : null,
    leadOrTeamName: d.leadName ?? d.teamName,
    internalEntity: d.internalEntity,
    clientName: d.clientName,
    clientReportingManager: d.clientReportingManager,
    reportingManagerEmail: d.reportingManagerEmail,
    reportingManagerContact: d.reportingManagerContact,
    vendor: d.vendor,
    jobRole: d.role,
    location: d.location,
    clientState: d.clientState,
    clientLocation: d.clientLocation,
    employmentType: d.employmentType,
    payrollCompany: d.payrollCompany,
    payrollCompanyOther: d.payrollCompanyOther,
    internalCompanyPlacement: d.internalCompanyPlacement,
    placementCompany: d.placementCompany,
    sharedPlacement: d.sharedPlacement,
    sharedWithTeam: d.sharedTeamId ? { id: d.sharedTeamId } : null,
    billRate: d.billRate != null ? String(d.billRate) : null,
    payRate: d.payRate != null ? String(d.payRate) : null,
    discountPrice: d.discountPrice != null ? String(d.discountPrice) : null,
    startDate: d.startDate,
    ccCompany: d.ccCompany,
    referral: d.referral,
    ssnNo: d.ssn,
    visaStatus: d.visaStatus,
    workAuthorizationExpDate: d.workAuthorizationExpDate,
    relocationExpenses: d.relocationExpenses,
    payCycle: d.payCycle,
    existingEmployee: d.existingEmployee,
    jobDescription: d.jobDescription,
    dojDate: d.dojDate,
  }
}

const ACTION_MAP = {
  SUBMIT: 'SUBMITTED',
  APPROVE: 'APPROVED',
  DECLINE: 'DECLINED',
  APPROVE_DOJ: 'DOJ_SET',
  SET_PROJECT_END: 'PROJECT_END_SET',
  RAISE_PROJECT_END: 'PROJECT_END_RAISED',
  DROP_OUT: 'DROPPED_OUT',
  APPROVE_PROJECT_END: 'PROJECT_END_APPROVED',
  DECLINE_PROJECT_END: 'PROJECT_END_DECLINED',
  RATE_CHANGE: 'RATES_CHANGED',
  EDIT: 'DETAILS_EDITED',
  OVERRIDE_APPROVE: 'OVERRIDE_APPROVED',
  OVERRIDE_DECLINE: 'OVERRIDE_REJECTED',
}

function mapTrail(actions) {
  return (actions || []).map((a) => ({
    id: a.id,
    actorName: a.actor?.fullName ?? 'System',
    actorRole: a.actorRole,
    action: ACTION_MAP[a.actionType] ?? a.actionType,
    stage: a.stage,
    comment: a.comment,
    emailsSentTo: [],
    createdAt: a.createdAt,
  }))
}

// GET /api/candidates?search=&status=&page=&size= → one page, already searched,
// filtered and paged by the server: { content, totalElements, totalPages, number, size }.
// (status is a display-status key such as "PENDING_HR"; see utils/status.js)
// The Super Admin's extra filters (date range, recruiter, team, ...) as query params; blank ones are left out
export function filterParams(filters = {}) {
  const params = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params[key] = value
  }
  return params
}

export async function getCandidates({ search = '', status = '', dojToday = false, page = 0, size = 10, filters = {} }) {
  const params = { ...filterParams(filters), page, size }
  if (dojToday) params.dojToday = true // only candidates whose Date of Joining is today
  if (search) params.search = search
  if (status) params.status = status
  const response = await client.get('/api/candidates', { params })
  return { ...response.data, content: (response.data.content || []).map(toFrontendCandidate) }
}

// GET /api/candidates/{id} plus its trail, merged into one object.
export async function getCandidate(id) {
  const [cRes, tRes] = await Promise.all([
    client.get(`/api/candidates/${id}`),
    client.get(`/api/candidates/${id}/trail`).catch(() => ({ data: [] })),
  ])
  const candidate = toFrontendCandidate(cRes.data)
  candidate.trail = mapTrail(tRes.data)

  // Fill in who/when/why of an override from its trail entry (for the banner).
  if (candidate.override) {
    const entry = [...candidate.trail]
      .reverse()
      .find((t) => t.action === 'OVERRIDE_APPROVED' || t.action === 'OVERRIDE_REJECTED')
    if (entry) {
      candidate.override.by = entry.actorName
      candidate.override.comment = entry.comment
      candidate.override.at = entry.createdAt
    }
  }
  return candidate
}

export async function createCandidate(data) {
  const response = await client.post('/api/candidates', toBackendCandidate(data))
  return toFrontendCandidate(response.data)
}

// HR edits the details (any time). The whole form is sent; a blank SSN keeps the stored one.
// The server emails everyone in the loop and records the changes on the trail.
export async function updateCandidate(id, data) {
  const response = await client.put(`/api/candidates/${id}`, toBackendCandidate(data))
  return toFrontendCandidate(response.data)
}

// ---- Workflow actions (comment goes as a query param on the backend) ----
function qp(comment) {
  return comment ? `?comment=${encodeURIComponent(comment)}` : ''
}
async function post(id, path, comment) {
  const response = await client.post(`/api/candidates/${id}/${path}${qp(comment)}`)
  return toFrontendCandidate(response.data)
}
function notSupported(what) {
  return () => Promise.reject(new Error(`${what} is not part of this backend's workflow.`))
}

export const approveSalesLead = (id, comment) => post(id, 'sales-lead/approve', comment)
// Sales Lead or Sales Manager (either one is enough); the comment is required.
export const declineSalesLead = (id, comment) => post(id, 'sales-lead/decline', comment)
export const approveHr = (id, comment) => post(id, 'hr/approve', comment)
export const declineHr = (id, comment) => post(id, 'hr/decline', comment)
export const approveContracts = (id, comment) => post(id, 'contracts/approve', comment)
export const declineContracts = (id, comment) => post(id, 'contracts/decline', comment)
// Payroll and Accounts approve or decline once HR and Contracts have both approved (decline needs a comment).
export const approvePayroll = (id, comment) => post(id, 'payroll/approve', comment)
export const declinePayroll = (id, comment) => post(id, 'payroll/decline', comment)
export const approveAccounts = (id, comment) => post(id, 'accounts/approve', comment)
export const declineAccounts = (id, comment) => post(id, 'accounts/decline', comment)
// Backend: Super Admin uses override, not a final approval.
export const approveSuperAdmin = notSupported('Super Admin final approval')
// The Sales Lead approves the recruiter-supplied DOJ (there is no later "set DOJ").
export const approveDoj = (id, comment) => post(id, 'doj/approve', comment)
// Sales Lead / Sales Manager / Super Admin change the bill and/or pay rate (comment required).
export async function changeRates(id, { billRate, payRate }, comment) {
  const params = { comment }
  if (billRate != null) params.billRate = String(billRate)
  if (payRate != null) params.payRate = String(payRate)
  const response = await client.post(`/api/candidates/${id}/rates`, null, { params })
  return toFrontendCandidate(response.data)
}

// The Sales Lead / Sales Manager sets the project end date once the DOJ is approved.
export async function setProjectEnd(id, date, comment) {
  const response = await client.post(`/api/candidates/${id}/project-end`, null, { params: { date, comment } })
  return toFrontendCandidate(response.data)
}
// The Lead / Manager / Super Admin approve or decline the date the recruiter raised (decline needs a comment).
export const approveProjectEnd = (id, comment) => post(id, 'project-end/approve', comment)
export const declineProjectEnd = (id, comment) => post(id, 'project-end/decline', comment)
// After the DOJ is approved, the Lead / Manager / HR / Contracts / Payroll / Accounts / Super Admin can record that the
// candidate dropped out / backed out (comment required).
export const dropOut = (id, comment) => post(id, 'drop-out', comment)
export const setDoj = notSupported('Setting the DOJ after approval')
export const overrideCandidate = (id, decision, comment) =>
  post(id, decision === 'REJECTED' ? 'override/decline' : 'override/approve', comment)
export const addComment = notSupported('Standalone comments')
