import dayjs from 'dayjs'

// antd's DatePicker works with dayjs objects, but the backend sends and expects "2026-10-23".
// These two helpers convert between the two whenever data goes into or out of the form.
const DATE_FIELDS = ['startDate', 'workAuthorizationExpDate', 'dojDate']

// Starting values for a brand-new candidate.
export const NEW_CANDIDATE_VALUES = {
  teamType: 'SALES',
  existingEmployee: false,
}

// Backend candidate → form values
export function toFormValues(candidate) {
  const values = { ...candidate }
  for (const field of DATE_FIELDS) {
    values[field] = candidate[field] ? dayjs(candidate[field]) : null
  }
  return values
}

// Form values → what we send to the backend
export function toApiValues(values) {
  const result = { ...values }
  for (const field of DATE_FIELDS) {
    result[field] = values[field] ? values[field].format('YYYY-MM-DD') : null
  }
  // The typed payroll company name only counts for "Other"
  if (result.payrollCompany !== 'Other') result.payrollCompanyOther = null
  // The "which one?" answers only count when the Yes/No above them is Yes
  if (!result.internalCompanyPlacement) result.placementCompany = null
  if (!result.sharedPlacement) result.sharedTeamId = null
  // Only H1 transfers have transfer details
  if (result.visaStatus !== 'H1 Transfer') {
    result.h1TransferDetails = ''
  }
  return result
}
