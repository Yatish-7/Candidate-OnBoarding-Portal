// Fake data used only in mock mode (VITE_USE_MOCKS=true).
// It lives in memory: the mock handlers change it, and a page refresh resets it.

import dayjs from 'dayjs'
import { ROLE_LABELS } from '../utils/roles.js'

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

// Every mock user logs in with this password
export const MOCK_PASSWORD = 'password'

// Same shape the backend returns: { id, name, email, role, teamId, teamName, active }.
// The Super Admin can add users to this list and edit them (see /api/users in handlers.js).
// Recruiters and Sales Leads belong to one of two teams (so team filtering can be tested);
// the other roles don't have a team.
export const MOCK_USERS = [
  { id: 1, name: 'Ravi Kumar', email: 'recruiter1@intellectt.test', role: 'RECRUITER', teamId: 1, teamName: 'Team Alpha', active: true },
  { id: 2, name: 'Priya Shah', email: 'recruiter2@intellectt.test', role: 'RECRUITER', teamId: 2, teamName: 'Team Beta', active: true },
  { id: 3, name: 'Anil Mehta', email: 'lead1@intellectt.test', role: 'SALES_LEAD', teamId: 1, teamName: 'Team Alpha', active: true },
  { id: 4, name: 'Sara Thomas', email: 'lead2@intellectt.test', role: 'SALES_LEAD', teamId: 2, teamName: 'Team Beta', active: true },
  { id: 5, name: 'Helen Rao', email: 'hr@intellectt.test', role: 'HR', teamId: null, teamName: null, active: true },
  { id: 6, name: 'Chris Paul', email: 'contracts@intellectt.test', role: 'CONTRACTS', teamId: null, teamName: null, active: true },
  { id: 7, name: 'Pooja Nair', email: 'payroll@intellectt.test', role: 'PAYROLL', teamId: null, teamName: null, active: true },
  { id: 8, name: 'Arjun Das', email: 'accounts@intellectt.test', role: 'ACCOUNTS', teamId: null, teamName: null, active: true },
  { id: 9, name: 'Admin User', email: 'admin@intellectt.test', role: 'SUPER_ADMIN', teamId: null, teamName: null, active: true },
]

// The two teams (the Super Admin can't add teams yet)
export const TEAMS = [
  { id: 1, name: 'Team Alpha' },
  { id: 2, name: 'Team Beta' },
]

// Options for antd <Select> dropdowns (login page + role switcher), e.g.
// "Anil Mehta — Sales Lead (Team Alpha)". It's a function, not a fixed list, so users the
// Super Admin adds show up too. Deactivated users are left out because they can't log in.
export function getMockUserOptions() {
  return MOCK_USERS.filter((user) => user.active).map((user) => ({
    value: user.email,
    label: `${user.name} — ${ROLE_LABELS[user.role]}${user.teamName ? ` (${user.teamName})` : ''}`,
  }))
}

export function findUser(id) {
  return MOCK_USERS.find((user) => user.id === id)
}

// The (active) Sales Lead of a team
export function findLead(teamId) {
  return MOCK_USERS.find((user) => user.role === 'SALES_LEAD' && user.teamId === teamId && user.active)
}

// Who does each workflow step in the mock data
const STEP_ACTORS = { hr: 5, contracts: 6, payroll: 7, accounts: 8, superAdmin: 9 }

// ---------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------

// Everyone in the approval chain (the recruiter is not part of it)
const APPROVAL_CHAIN = ['SALES_LEAD', 'HR', 'CONTRACTS', 'PAYROLL', 'ACCOUNTS', 'SUPER_ADMIN']

// Who the backend emails after someone does something. The frontend only DISPLAYS this.
//  - The recruiter's actions (submit, edit, set DOJ) → only the Sales Lead
//  - Anyone else's action (approve, decline, resubmit, override) → everyone in the chain
//    except the person who did it. The recruiter never gets these emails.
// Comments don't send email.
export function getEmailRecipients(actorRole) {
  if (actorRole === 'RECRUITER') {
    return [ROLE_LABELS.SALES_LEAD]
  }
  return APPROVAL_CHAIN.filter((role) => role !== actorRole).map((role) => ROLE_LABELS[role])
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

// The approval steps in order (the DOJ step comes after these)
const APPROVAL_STEPS = ['salesLead', 'hr', 'contracts', 'payroll', 'accounts', 'superAdmin']

// Stages for a candidate approved up to and including stepKey; the next step is PENDING.
// e.g. approvedThrough('hr') → salesLead and hr APPROVED, contracts PENDING, the rest NOT_STARTED
function approvedThrough(stepKey) {
  const lastIndex = APPROVAL_STEPS.indexOf(stepKey)
  const stages = {}
  APPROVAL_STEPS.forEach((key, index) => {
    if (index <= lastIndex) stages[key] = 'APPROVED'
    else if (index === lastIndex + 1) stages[key] = 'PENDING'
    else stages[key] = 'NOT_STARTED'
  })
  // After the Super Admin's final approval, the recruiter has to set the DOJ
  stages.doj = stepKey === 'superAdmin' ? 'PENDING' : 'NOT_STARTED'
  return stages
}

// Builds the approval trail from the candidate's stage statuses,
// so the seed trail always matches the status. Each event is a day after the previous one.
function buildTrail(candidate) {
  const recruiter = findUser(candidate.recruiterId)
  const lead = findLead(candidate.teamId)
  const { stages, override } = candidate

  const trail = []
  let time = dayjs(candidate.createdAt)

  function add(actor, action, stage, comment = '') {
    trail.push({
      id: trail.length + 1,
      actorName: actor.name,
      actorRole: actor.role,
      action,
      stage,
      comment,
      emailsSentTo: getEmailRecipients(actor.role),
      createdAt: time.format('YYYY-MM-DDTHH:mm:ss'),
    })
    time = time.add(1, 'day').add(2, 'hour')
  }

  add(recruiter, 'SUBMITTED', 'RECRUITER')
  for (const key of APPROVAL_STEPS) {
    const actor = key === 'salesLead' ? lead : findUser(STEP_ACTORS[key])
    const stage = { salesLead: 'SALES_LEAD', superAdmin: 'SUPER_ADMIN' }[key] ?? key.toUpperCase()
    if (stages[key] === 'APPROVED') add(actor, 'APPROVED', stage)
    if (stages[key] === 'DECLINED') add(actor, 'DECLINED', stage, candidate.declineComment)
  }
  if (stages.doj === 'SET') add(recruiter, 'DOJ_SET', 'DOJ', `DOJ: ${candidate.dojDate}`)
  if (override) {
    add(findUser(9), `OVERRIDE_${override.decision}`, 'ADMIN', override.comment)
  }
  return trail
}

// Fills in every intake field with a sensible default, so each seed candidate below
// only lists what makes it different. The mock backend also uses it to create new candidates.
export function makeCandidate(fields) {
  const recruiter = findUser(fields.recruiterId)
  const lead = findLead(recruiter.teamId)
  const emailName = fields.candidateName.toLowerCase().replace(' ', '.')

  const candidate = {
    // Candidate & Recruiter
    candidatePersonalEmail: `${emailName}@example.test`,
    candidateDirectNumber: `(555) 010-${1000 + fields.id}`,
    recruiterId: recruiter.id,
    recruiterName: recruiter.name,
    leadName: lead.name,
    teamId: recruiter.teamId,
    teamName: recruiter.teamName,
    teamType: 'SALES',
    // Client
    clientReportingManager: 'Jordan Lee',
    reportingManagerEmail: 'jordan.lee@client.test',
    reportingManagerContact: '(555) 020-1000',
    // Interviewers
    interviewers: [
      { name: 'Sam Carter', email: 'sam.carter@client.test', contact: '(555) 020-2001' },
      { name: 'Alex Morgan', email: 'alex.morgan@client.test', contact: '(555) 020-2002' },
    ],
    // Engagement & Compliance
    vendor: 'Direct',
    location: 'Dallas, TX',
    billRate: 85,
    payRate: 65,
    startDate: '2026-11-16',
    ccCompany: 'Intellectt Inc',
    referral: '',
    ssn: `900-55-${String(1000 + fields.id * 37).slice(-4)}`, // 900-series = never a real SSN
    visaStatus: 'H1B',
    h1TransferDetails: '',
    workAuthorizationExpDate: '2028-06-30',
    relocationExpenses: 'None',
    payCycle: 'BI_WEEKLY',
    existingEmployee: false,
    jobDescription: 'Build and maintain services for the client team. 5+ years of experience required.',
    // Workflow
    dojDate: null,
    override: null,
    createdAt: '2026-10-01T09:30:00',
    ...fields,
    stages: {
      salesLead: 'PENDING',
      hr: 'NOT_STARTED',
      contracts: 'NOT_STARTED',
      payroll: 'NOT_STARTED',
      accounts: 'NOT_STARTED',
      superAdmin: 'NOT_STARTED',
      doj: 'NOT_STARTED',
      ...fields.stages,
    },
  }

  candidate.trail = buildTrail(candidate)
  delete candidate.declineComment // only used to build the trail

  // "Last updated" = time of the latest trail entry
  const lastEntry = candidate.trail[candidate.trail.length - 1]
  candidate.updatedAt = lastEntry.createdAt
  if (candidate.override) {
    candidate.override = { ...candidate.override, by: 'Admin User', at: lastEntry.createdAt }
  }
  return candidate
}

// 12 candidates covering every state. Recruiter 1 = Team Alpha, recruiter 2 = Team Beta.
// The mock handlers change these objects and push new ones onto this list.
export const candidates = [
  makeCandidate({
    id: 1, candidateName: 'Meera Iyer', clientName: 'Northwind Health', role: 'Java Developer',
    recruiterId: 1, createdAt: '2026-10-21T10:00:00',
  }),
  makeCandidate({
    id: 2, candidateName: 'Daniel Brooks', clientName: 'Contoso Bank', role: 'Data Engineer',
    recruiterId: 2, createdAt: '2026-10-22T11:15:00', location: 'Charlotte, NC', visaStatus: 'US Citizen',
  }),
  makeCandidate({
    id: 3, candidateName: 'Kavya Reddy', clientName: 'Fabrikam Retail', role: 'React Developer',
    recruiterId: 1, createdAt: '2026-10-19T09:00:00', stages: approvedThrough('salesLead'),
  }),
  makeCandidate({
    id: 4, candidateName: 'Marcus Allen', clientName: 'Globex Logistics', role: 'DevOps Engineer',
    recruiterId: 2, createdAt: '2026-10-17T14:00:00', billRate: 95, payRate: 72, stages: approvedThrough('hr'),
  }),
  makeCandidate({
    id: 5, candidateName: 'Sneha Patel', clientName: 'Initech Software', role: 'QA Engineer',
    recruiterId: 1, createdAt: '2026-10-15T10:30:00', vendor: 'Prime Vendor LLC',
    stages: { ...approvedThrough('hr'), contracts: 'DECLINED' },
    declineComment: 'Vendor agreement is missing the signed MSA. Please re-upload.',
  }),
  makeCandidate({
    id: 6, candidateName: 'Ethan Clarke', clientName: 'Tailspin Airlines', role: 'Business Analyst',
    recruiterId: 2, createdAt: '2026-10-14T09:45:00', visaStatus: 'Green Card', stages: approvedThrough('contracts'),
  }),
  makeCandidate({
    id: 7, candidateName: 'Arun Prakash', clientName: 'Wingtip Insurance', role: 'Salesforce Developer',
    recruiterId: 1, createdAt: '2026-10-12T13:00:00', visaStatus: 'H1 Transfer',
    h1TransferDetails: 'Transfer from Litware Systems, receipt expected next week',
    stages: approvedThrough('payroll'),
  }),
  makeCandidate({
    id: 8, candidateName: 'Grace Kim', clientName: 'Litware Systems', role: 'Project Manager',
    recruiterId: 2, createdAt: '2026-10-10T10:00:00', existingEmployee: true, stages: approvedThrough('accounts'),
  }),
  makeCandidate({
    id: 9, candidateName: 'Rahul Verma', clientName: 'Adventure Works', role: 'Python Developer',
    recruiterId: 1, createdAt: '2026-10-08T09:00:00', stages: approvedThrough('superAdmin'),
  }),
  makeCandidate({
    id: 10, candidateName: 'Olivia Turner', clientName: 'Contoso Bank', role: 'Scrum Master',
    recruiterId: 2, createdAt: '2026-10-01T15:30:00', teamType: 'REQ', startDate: '2026-10-19',
    dojDate: '2026-10-19', stages: { ...approvedThrough('superAdmin'), doj: 'SET' },
  }),
  makeCandidate({
    id: 11, candidateName: 'Vikram Singh', clientName: 'Northwind Health', role: '.NET Developer',
    recruiterId: 1, createdAt: '2026-10-16T11:00:00', referral: 'Meera Iyer', stages: approvedThrough('salesLead'),
    override: { decision: 'APPROVED', comment: 'Client escalation — approved to meet the start date.' },
  }),
  makeCandidate({
    id: 12, candidateName: 'Hannah Lee', clientName: 'Contoso Bank', role: 'UI Designer',
    recruiterId: 2, createdAt: '2026-10-18T16:00:00',
    override: { decision: 'REJECTED', comment: 'Duplicate submission — candidate already placed through another vendor.' },
  }),
]

// ---------------------------------------------------------------------------
// Sample form data (mock mode only)
// ---------------------------------------------------------------------------

// Filled-in intake form values for the "Fill sample data" button on the New candidate page.
// The email gets a random number so you can submit it more than once.
export function makeSampleIntake() {
  const number = Math.floor(Math.random() * 9000) + 1000
  return {
    candidateName: `Sample Candidate ${number}`,
    candidatePersonalEmail: `sample.${number}@example.test`,
    candidateDirectNumber: '(555) 010-4321',
    teamType: 'SALES',
    clientName: 'Northwind Health',
    clientReportingManager: 'Jordan Lee',
    reportingManagerEmail: 'jordan.lee@client.test',
    reportingManagerContact: '(555) 020-1000',
    interviewers: [
      { name: 'Sam Carter', email: 'sam.carter@client.test', contact: '(555) 020-2001' },
      { name: 'Alex Morgan', email: 'alex.morgan@client.test', contact: '(555) 020-2002' },
    ],
    vendor: 'Direct',
    role: 'Full Stack Developer',
    location: 'Austin, TX',
    billRate: 90,
    payRate: 70,
    startDate: dayjs().add(3, 'week').format('YYYY-MM-DD'),
    ccCompany: 'Intellectt Inc',
    referral: '',
    ssn: '900-12-3456',
    visaStatus: 'H1B',
    h1TransferDetails: '',
    workAuthorizationExpDate: dayjs().add(2, 'year').format('YYYY-MM-DD'),
    relocationExpenses: 'None',
    payCycle: 'BI_WEEKLY',
    existingEmployee: false,
    jobDescription: 'Build React front ends and Spring Boot services for the client portal.',
  }
}
