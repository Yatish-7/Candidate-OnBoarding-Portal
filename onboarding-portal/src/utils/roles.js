// Friendly names for the role codes the backend sends (e.g. SALES_LEAD → "Sales Lead")
export const ROLE_LABELS = {
  RECRUITER: 'Recruiter',
  SALES_LEAD: 'Sales Lead',
  // Oversees several teams; approves/declines like a Sales Lead (either one is enough).
  SALES_MANAGER: 'Sales Manager',
  HR: 'HR',
  CONTRACTS: 'Contracts',
  PAYROLL: 'Payroll',
  ACCOUNTS: 'Accounts',
  // Manages users and teams only — no candidate access.
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
}

// Options for a role dropdown: [{ value: 'RECRUITER', label: 'Recruiter' }, ...]
export const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))

// Only these roles belong to a team
export const TEAM_ROLES = ['RECRUITER', 'SALES_LEAD']

// Roles that take part in the candidate workflow (everyone except Admin, who only
// manages users and teams). Used to gate the candidate pages/menu.
export const CANDIDATE_ROLES = [
  'RECRUITER',
  'SALES_LEAD',
  'SALES_MANAGER',
  'HR',
  'CONTRACTS',
  'PAYROLL',
  'ACCOUNTS',
  'SUPER_ADMIN',
]

// Where each role lands after login. Admin has no candidate access, so it starts
// on the Users page; the Super Admin on their dashboard; everyone else on Candidates.
export function homePathForRole(role) {
  if (role === 'SUPER_ADMIN') return '/admin'
  if (role === 'ADMIN') return '/admin/users'
  return '/candidates'
}
