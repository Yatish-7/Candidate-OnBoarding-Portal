// A candidate moves through these stages in order, one after the other:
//   Sales Lead → HR → Contracts → Payroll → Accounts → Super Admin → DOJ (set by the recruiter)
// Each stage has its own status in candidate.stages, so there's no single "status" field.
// These helpers work out one display status for list tags.

// The stages in workflow order. "key" is the field in candidate.stages.
export const WORKFLOW = [
  { key: 'salesLead', stage: 'SALES_LEAD', label: 'Sales Lead' },
  { key: 'hr', stage: 'HR', label: 'HR' },
  { key: 'contracts', stage: 'CONTRACTS', label: 'Contracts' },
  { key: 'payroll', stage: 'PAYROLL', label: 'Payroll' },
  { key: 'accounts', stage: 'ACCOUNTS', label: 'Accounts' },
  { key: 'superAdmin', stage: 'SUPER_ADMIN', label: 'Super Admin' },
  { key: 'doj', stage: 'DOJ', label: 'Date of Joining' },
]

// Every display status: its label and antd Tag color.
// The keys (e.g. "PENDING_HR") are also what we send as ?status= when filtering the list.
// (Confirm these filter values with the backend developer.)
export const STATUSES = {
  PENDING_SALES_LEAD: { label: 'Pending Sales Lead', color: 'default' },
  PENDING_HR: { label: 'Pending HR', color: 'blue' },
  PENDING_CONTRACTS: { label: 'Pending Contracts', color: 'blue' },
  PENDING_PAYROLL_ACCOUNTS: { label: 'Pending Payroll & Accounts', color: 'geekblue' },
  PENDING_PAYROLL: { label: 'Pending Payroll', color: 'geekblue' },
  PENDING_ACCOUNTS: { label: 'Pending Accounts', color: 'geekblue' },
  PENDING_SUPER_ADMIN: { label: 'Pending Super Admin', color: 'purple' },
  DECLINED: { label: 'Declined', color: 'volcano' },
  AWAITING_DOJ: { label: 'Approved — awaiting DOJ', color: 'cyan' },
  JOINED: { label: 'Joined', color: 'green' },
  EXITED: { label: 'Exited', color: 'magenta' },
  DROPPED_OUT: { label: 'Dropped out / Backed out', color: 'default' },
  ADMIN_APPROVED: { label: 'Approved (Admin override)', color: 'green' },
  ADMIN_REJECTED: { label: 'Rejected (Admin override)', color: 'red' },
}

function isAnyDeclined(stages) {
  return [stages.hr, stages.contracts, stages.payroll, stages.accounts].includes('DECLINED')
}

// The order of these checks matters: the first one that matches wins.
// The server uses the SAME rules for the status filter and the dashboard counts
// (CandidateQueries.statusKey in the backend) — keep the two in step.
export function getStatusKey(candidate) {
  const { stages, override } = candidate

  if (override?.decision === 'REJECTED') return 'ADMIN_REJECTED'
  if (override?.decision === 'APPROVED') return 'ADMIN_APPROVED'
  if (candidate.backendStatus === 'DROPPED_OUT') return 'DROPPED_OUT'
  if (stages.salesLead === 'DECLINED') return 'DECLINED'
  if (isAnyDeclined(stages)) return 'DECLINED'
  // An approved project end date (the recruiter raises it; Lead / Manager / Super Admin approve) means the candidate has exited
  if (candidate.projectEndStatus === 'APPROVED') return 'EXITED'
  if (stages.doj === 'SET') return 'JOINED'
  // HR and Contracts have both approved: the candidate is approved, waiting to join.
  // (The recruiter gives a DOJ at intake, so "DOJ given" alone does NOT mean approved.)
  if (stages.superAdmin === 'APPROVED') return 'AWAITING_DOJ'
  if (stages.salesLead === 'PENDING') return 'PENDING_SALES_LEAD'
  if (stages.contracts === 'PENDING') return 'PENDING_CONTRACTS'
  if (stages.hr === 'PENDING') return 'PENDING_HR'
  if (stages.payroll === 'PENDING' || stages.accounts === 'PENDING') return 'PENDING_PAYROLL_ACCOUNTS'
  return 'PENDING_SALES_LEAD'
}

// Statuses that can't happen any more (Payroll and Accounts are one combined step, and
// there's no Super Admin approval step); kept above only so old labels still render.
const UNREACHABLE = ['PENDING_PAYROLL', 'PENDING_ACCOUNTS', 'PENDING_SUPER_ADMIN']

// Options for the status filter dropdown: [{ value: 'PENDING_HR', label: 'Pending HR' }, ...]
export const STATUS_OPTIONS = Object.entries(STATUSES)
  .filter(([key]) => !UNREACHABLE.includes(key))
  .map(([key, status]) => ({ value: key, label: status.label }))

// How the Super Admin dashboard groups the statuses into its 4 counters. The server
// counts them (/api/candidates/summary) with the same grouping (CandidateQueries).
export const SUMMARY_GROUPS = {
  pending: ['PENDING_SALES_LEAD', 'PENDING_HR', 'PENDING_CONTRACTS', 'PENDING_PAYROLL_ACCOUNTS'],
  approved: ['AWAITING_DOJ', 'ADMIN_APPROVED'],
  declined: ['DECLINED', 'ADMIN_REJECTED'],
  joined: ['JOINED'],
  exited: ['EXITED'],
  dropouts: ['DROPPED_OUT'],
}

// Stage names used in the approval trail (the "stage" field of each entry)
export const STAGE_LABELS = {
  RECRUITER: 'Recruiter',
  SALES_LEAD: 'Sales Lead',
  HR: 'HR',
  CONTRACTS: 'Contracts',
  PAYROLL: 'Payroll',
  ACCOUNTS: 'Accounts',
  SUPER_ADMIN: 'Super Admin',
  DOJ: 'DOJ',
  PROJECT_END: 'Project end',
  ADMIN: 'Admin override',
}

// Which stage the candidate is at right now. A new comment is tagged with this stage.
export function getCurrentStage(candidate) {
  const { stages, override } = candidate

  if (override) return 'ADMIN'
  // A decline sends it back to the Sales Lead (or the Sales Lead/Manager declined it)
  if (stages.salesLead === 'DECLINED') return 'SALES_LEAD'
  if (isAnyDeclined(stages)) return 'SALES_LEAD'
  // Otherwise: the first stage that is waiting (or DOJ once everything is done)
  const waiting = WORKFLOW.find((step) => stages[step.key] === 'PENDING')
  return waiting ? waiting.stage : 'DOJ'
}
