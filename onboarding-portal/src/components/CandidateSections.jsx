import { Card, Descriptions, Space } from 'antd'
import { AuditOutlined, ShopOutlined, UserOutlined } from '@ant-design/icons'
import { discountedBillRate, formatDate, formatRate, formatVendorPercentage, maskSsn } from '../utils/format.js'
import { labelFor, PAY_CYCLE_OPTIONS, TEAM_TYPE_OPTIONS, YES_NO_OPTIONS } from '../utils/options.js'

// Descriptions shows label/value pairs in a grid: 2 columns on wide screens, 1 on phones
const COLUMNS = { xs: 1, sm: 1, md: 2 }

// Card title with an icon in front, e.g. 👤 Candidate & Recruiter
function SectionTitle({ icon, children }) {
  return (
    <Space>
      <span style={{ color: '#4f46e5' }}>{icon}</span>
      {children}
    </Space>
  )
}

// All the candidate's intake fields, grouped in the same sections as the form
export default function CandidateSections({ candidate: c }) {
  const candidateItems = [
    { label: 'Name', children: c.candidateName },
    { label: 'Personal email', children: c.candidatePersonalEmail },
    { label: 'Direct number', children: c.candidateDirectNumber },
    { label: 'Recruiter', children: c.recruiterName },
    { label: 'Sourcing recruiter', children: c.sourcingRecruiter },
    { label: 'Sourcing recruiter lead', children: c.sourcingRecruiterLead },
    { label: 'Recruiter location', children: c.recruiterLocation },
    { label: 'Sales Lead', children: c.salesLeadName },
    { label: 'Sales Manager', children: c.salesManagerName },
    { label: 'Team', children: c.teamName },
    { label: 'Team type', children: labelFor(TEAM_TYPE_OPTIONS, c.teamType) },
    { label: 'Placement entity', children: c.internalEntity || '—' },
    {
      label: 'Payroll company',
      children:
        c.payrollCompany === 'Other' ? `Other: ${c.payrollCompanyOther ?? '—'}` : c.payrollCompany || '—',
    },
  ]

  const clientItems = [
    { label: 'Client', children: c.clientName },
    { label: 'Client state', children: c.clientState },
    { label: 'Client location', children: c.clientLocation },
    { label: 'Reporting manager', children: c.clientReportingManager },
    { label: 'Manager email', children: c.reportingManagerEmail },
    { label: 'Manager contact', children: c.reportingManagerContact },
  ]

  const engagementItems = [
    { label: 'Vendor', children: c.vendor },
    { label: 'Job title', children: c.role },
    { label: 'Location', children: c.location },
    { label: 'Employment type', children: c.employmentType },
    {
      label: 'Placed with our company',
      children:
        c.internalCompanyPlacement == null
          ? '—'
          : c.internalCompanyPlacement
            ? `Yes: ${c.placementCompany ?? '—'}`
            : 'No',
    },
    {
      label: 'Shared placement',
      children:
        c.sharedPlacement == null ? '—' : c.sharedPlacement ? `Yes: ${c.sharedTeamName ?? '—'}` : 'No',
    },
    { label: 'CC company', children: c.ccCompany },
    { label: 'Bill rate', children: formatRate(c.billRate) },
    { label: 'Discount price', children: c.discountPrice ? formatRate(c.discountPrice) : '—' },
    { label: 'Discounted bill rate', children: c.discountPrice ? formatRate(discountedBillRate(c.billRate, c.discountPrice)) : '—' },
    { label: 'Pay rate', children: formatRate(c.payRate) },
    { label: 'Vendor percentage', children: formatVendorPercentage(c.payRate, c.billRate, c.discountPrice) },
    {
      label: 'Project end date',
      children: c.projectEndDate
        ? `${formatDate(c.projectEndDate)}${
            { RAISED: ' — waiting for approval', DECLINED: ' — declined', APPROVED: ' — approved (exited)' }[c.projectEndStatus] ?? ''
          }`
        : '—',
    },
    { label: 'Start date', children: formatDate(c.startDate) },
    { label: 'Pay cycle', children: labelFor(PAY_CYCLE_OPTIONS, c.payCycle) },
    // Only the last 4 digits of the SSN are ever shown
    { label: 'SSN', children: maskSsn(c.ssn) },
    { label: 'Visa status', children: c.visaStatus },
    // Only shown for H1 transfers
    ...(c.visaStatus === 'H1 Transfer'
      ? [{ label: 'H1 transfer details', children: c.h1TransferDetails || '—', span: 'filled' }]
      : []),
    { label: 'Work authorization expires', children: formatDate(c.workAuthorizationExpDate) },
    { label: 'Relocation expenses', children: c.relocationExpenses || '—' },
    { label: 'Existing employee', children: labelFor(YES_NO_OPTIONS, c.existingEmployee) },
    { label: 'Referral', children: c.referral || '—' },
    { label: 'Referral amount', children: c.referralAmount ? formatRate(c.referralAmount) : '—' },
    { label: 'Job description', children: c.jobDescription, span: 'filled' },
  ]

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Card title={<SectionTitle icon={<UserOutlined />}>Candidate & Recruiter</SectionTitle>} size="small">
        <Descriptions items={candidateItems} column={COLUMNS} size="small" />
      </Card>
      <Card title={<SectionTitle icon={<ShopOutlined />}>Client</SectionTitle>} size="small">
        <Descriptions items={clientItems} column={COLUMNS} size="small" />
      </Card>
      <Card title={<SectionTitle icon={<AuditOutlined />}>Engagement & Compliance</SectionTitle>} size="small">
        <Descriptions items={engagementItems} column={COLUMNS} size="small" />
      </Card>
    </Space>
  )
}
