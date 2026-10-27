// Choices for the dropdowns and radio buttons in the candidate form.
// "value" is what we send to the backend (uppercase enums), "label" is what the user sees.

export const TEAM_TYPE_OPTIONS = [
  { value: 'SALES', label: 'Sales' },
  { value: 'REQ', label: 'Req' },
  { value: 'BOTH', label: 'Sales & Req' },
]

// The placement entities a recruiter can place a candidate under.
export const INTERNAL_ENTITY_OPTIONS = [
  'novozen',
  'revereit',
  'premierlifesciences',
  'unitedpharmatechnologies',
  'kennedysoft',
  'shoolin-inc',
  'lumininc',
  'lumin-innovation',
  'kkrconsulting',
  'ubitz',
].map((entity) => ({ value: entity, label: entity }))

// The offices a recruiter can work from. Must match RECRUITER_LOCATIONS in the backend
// (CandidateServiceImpl): the server refuses anything else.
export const RECRUITER_LOCATION_OPTIONS = ['Hyderabad', 'Vijayawada', 'Banglore', 'Indore', 'Noida', 'USA'].map(
  (city) => ({ value: city, label: city }),
)

// Optional "payroll company": our ten entities, or Other (then the user types the name).
// Must match the backend check (CandidateServiceImpl.checkPayrollCompany).
export const PAYROLL_OTHER = 'Other'
export const PAYROLL_COMPANY_OPTIONS = [...INTERNAL_ENTITY_OPTIONS, { value: PAYROLL_OTHER, label: 'Other…' }]

export const EMPLOYMENT_TYPE_OPTIONS = ['W2', 'C2C', 'Full-time', 'Self'].map((type) => ({ value: type, label: type }))

// Our own companies a candidate can be placed with: the internal entities plus Intellectt and
// NewMEK. Must match PLACEMENT_COMPANIES in the backend (CandidateServiceImpl).
export const PLACEMENT_COMPANY_OPTIONS = [
  ...INTERNAL_ENTITY_OPTIONS,
  { value: 'Intellectt', label: 'Intellectt' },
  { value: 'NewMEK Software Solutions', label: 'NewMEK Software Solutions' },
]

export const VISA_STATUS_OPTIONS = [
  'US Citizen',
  'Green Card',
  'GC EAD',
  'H1B',
  'H1 Transfer',
  'H4 EAD',
  'L2 EAD',
  'OPT',
  'STEM OPT',
  'CPT',
  'TN',
].map((visa) => ({ value: visa, label: visa }))

// These never expire, so the work authorization expiry date isn't required for them
export const VISAS_WITHOUT_EXPIRY = ['US Citizen', 'Green Card']

export const PAY_CYCLE_OPTIONS = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BI_WEEKLY', label: 'Bi-weekly' },
  { value: 'SEMI_MONTHLY', label: 'Semi-monthly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'OTHER', label: 'Other' },
]

export const YES_NO_OPTIONS = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
]

// Finds the label for a value, e.g. labelFor(PAY_CYCLE_OPTIONS, 'BI_WEEKLY') → "Bi-weekly"
export function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label ?? value ?? '—'
}
