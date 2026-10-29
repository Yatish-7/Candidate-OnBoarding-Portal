// Who may do what to a candidate. Each function answers one question with true/false.
// The page uses these to show or hide buttons; the real backend enforces the same rules.
//
// This frontend talks to the parallel-workflow backend:
//   Recruiter submits → Sales Lead OR Sales Manager approves (or declines, which ends it) → HR and Contracts review IN PARALLEL
//   → both approved → PAYROLL and ACCOUNTS review in parallel (they only see the candidate
//   after that) → all approved = done. Any of the four can decline (back to the Sales Lead,
//   who re-approves to re-route). The recruiter
//   supplies the DOJ at intake and the Sales Lead approves it. The Super Admin can
//   override (approve/reject) any candidate at any stage.

// After an admin override the normal workflow stops; only the Super Admin acts
function isOpen(candidate) {
  return !candidate.override
}

// The team's Sales Lead, or a Sales Manager. The server only sends a Sales Manager the
// candidates of the teams under them, so any candidate they can open is theirs to act on.
function isOwnTeamLead(user, candidate) {
  return (
    user.role === 'SALES_MANAGER' || (user.role === 'SALES_LEAD' && candidate.teamId === user.teamId)
  )
}

// Is it this role's turn? (their stage is PENDING and there's no override)
function isTurn(user, role, candidate, stageKey) {
  return isOpen(candidate) && user.role === role && candidate.stages[stageKey] === 'PENDING'
}

export function isDeclined(candidate) {
  const { hr, contracts, payroll, accounts } = candidate.stages
  return [hr, contracts, payroll, accounts].includes('DECLINED')
}

export function canCreateCandidate(user) {
  return user.role === 'RECRUITER'
}

// Sales Lead / Sales Manager: first approval, or re-approve a candidate HR/Contracts declined
// to re-route it. Nothing to do once the Sales Lead/Manager has declined it themselves.
export function canApproveSalesLead(user, candidate) {
  return (
    isOpen(candidate) &&
    isOwnTeamLead(user, candidate) &&
    (candidate.stages.salesLead === 'PENDING' || isDeclined(candidate))
  )
}

// Same people, same moments: they can also turn the candidate down (comment required).
export function canDeclineSalesLead(user, candidate) {
  return canApproveSalesLead(user, candidate)
}

// HR and Contracts review in parallel; each can approve or decline (decline needs a comment).
// HR may also REVISE its own decision (approve <-> decline) after making it — but only
// until the Date of Joining is approved (doj === 'SET'); after that HR is locked.
export function canReviewHr(user, candidate) {
  return (
    isOpen(candidate) && // no Super Admin override
    user.role === 'HR' &&
    candidate.stages.hr !== 'NOT_STARTED' && // Sales Lead has approved it into review
    candidate.stages.doj !== 'SET' // DOJ approved → HR decision locked
  )
}

export function canReviewContracts(user, candidate) {
  return isTurn(user, 'CONTRACTS', candidate, 'contracts')
}

// Payroll and Accounts each approve or decline once, after HR and Contracts have both approved
// (their stage is PENDING only then). There is no Super Admin "final approval" step.
export function canReviewPayroll(user, candidate) {
  return isTurn(user, 'PAYROLL', candidate, 'payroll')
}

export function canReviewAccounts(user, candidate) {
  return isTurn(user, 'ACCOUNTS', candidate, 'accounts')
}

export function canFinalApprove() {
  return false
}

// The recruiter supplies the DOJ at intake; the Sales Lead approves it, but only
// once the candidate itself has been approved.
// The DOJ needs TWO approvals: the Sales Lead / Sales Manager and HR (each approves once).
export function canApproveDoj(user, candidate) {
  if (!isOpen(candidate) || candidate.stages.doj !== 'PENDING' || candidate.stages.salesLead !== 'APPROVED') return false
  if (candidate.backendStatus === 'DROPPED_OUT') return false
  if (user.role === 'HR') return !candidate.dojHrApproved
  return isOwnTeamLead(user, candidate) && !candidate.dojLeadApproved
}

// Bill and pay rates can change mid-way: only the team's Sales Lead / Sales Manager and the
// Super Admin may, with a comment. Not for a declined candidate.
export function canChangeRates(user, candidate) {
  if (candidate.stages.salesLead === 'DECLINED' || candidate.override?.decision === 'REJECTED') return false
  return user.role === 'SUPER_ADMIN' || isOwnTeamLead(user, candidate)
}

// The Sales Lead / Sales Manager / Super Admin sets the project end date once the DOJ is approved (and may
// change it later). The server only shows a Sales Manager their own teams' candidates.
export function canSetProjectEnd(user, candidate) {
  if (candidate.stages.doj !== 'SET' || candidate.projectEndStatus === 'RAISED' || candidate.backendStatus === 'DROPPED_OUT') return false
  // Entering the date as an approver counts as their own approval (the date needs BOTH the Lead / Manager and HR).
  // The Super Admin's entry settles it (also after an override approval, but not on a rejected candidate)
  if (user.role === 'SUPER_ADMIN') return candidate.override?.decision !== 'REJECTED'
  if (user.role === 'HR') return isOpen(candidate)
  return isOpen(candidate) && isOwnTeamLead(user, candidate)
}

// The recruiter raises the project end date for their own candidate, once the DOJ is approved. They can
// raise it again after a decline or change a date still waiting for approval, but not after approval.
export function canRaiseProjectEnd(user, candidate) {
  return (
    user.role === 'RECRUITER' &&
    candidate.recruiterId === user.id &&
    candidate.stages.doj === 'SET' &&
    !candidate.override &&
    candidate.backendStatus !== 'DROPPED_OUT' &&
    candidate.projectEndStatus !== 'APPROVED'
  )
}

// A raised project end date needs BOTH the Lead / Manager and HR to approve (the Super Admin settles it alone);
// each of them may also decline it.
export function canDecideProjectEnd(user, candidate) {
  if (candidate.projectEndStatus !== 'RAISED') return false
  if (user.role === 'SUPER_ADMIN') return true
  if (user.role === 'HR') return isOpen(candidate) && !candidate.projectEndHrApproved
  return isOpen(candidate) && isOwnTeamLead(user, candidate) && !candidate.projectEndLeadApproved
}

// Drop out / back out: after the DOJ is approved, until the candidate has exited. The Lead / Manager, HR, Contracts,
// Payroll, Accounts and the Super Admin can record it (comment required).
export function canDropOut(user, candidate) {
  if (candidate.stages.doj !== 'SET' || candidate.backendStatus === 'DROPPED_OUT') return false
  if (candidate.projectEndStatus === 'APPROVED' || candidate.override?.decision === 'REJECTED') return false
  if (['SUPER_ADMIN', 'HR', 'CONTRACTS', 'PAYROLL', 'ACCOUNTS'].includes(user.role)) return true
  return isOwnTeamLead(user, candidate)
}

// Only HR can edit a candidate's details, at any time (everyone in the loop is emailed).
// Rates can also be changed by the Sales Lead / Manager / Super Admin (see canChangeRates).
export function canEdit(user) {
  return user.role === 'HR'
}

// The Super Admin can approve or reject any candidate at any stage, and change that
// decision later (every change is recorded in the trail).
export function canOverride(user) {
  return user.role === 'SUPER_ADMIN'
}

// The backend has no standalone comment endpoint yet.
export function canComment() {
  return false
}

// Old names, still imported by the dormant mock backend (src/mocks)
export const canApprovePayroll = canReviewPayroll
export const canApproveAccounts = canReviewAccounts
