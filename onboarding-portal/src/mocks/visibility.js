// Which candidates each role may see (the "Sees" column in CLAUDE.md).
// The real backend enforces this; the mock backend copies it so mock mode behaves the same.
// A role sees a candidate once it reaches their step (their stage is no longer NOT_STARTED).
export function canSeeCandidate(user, candidate) {
  const { stages } = candidate

  switch (user.role) {
    case 'RECRUITER':
      return candidate.recruiterId === user.id
    case 'SALES_LEAD':
      return candidate.teamId === user.teamId
    case 'HR':
      return stages.hr !== 'NOT_STARTED'
    case 'CONTRACTS':
      return stages.contracts !== 'NOT_STARTED'
    case 'PAYROLL':
      return stages.payroll !== 'NOT_STARTED'
    case 'ACCOUNTS':
      return stages.accounts !== 'NOT_STARTED'
    case 'SUPER_ADMIN':
      return true
    default:
      return false
  }
}
