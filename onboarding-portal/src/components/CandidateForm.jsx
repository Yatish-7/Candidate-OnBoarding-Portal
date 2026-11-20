import { useEffect, useMemo, useState } from 'react'
import { AuditOutlined, ExperimentOutlined, ShopOutlined, UserOutlined } from '@ant-design/icons'
import Card from '../ui/Card.jsx'
import Button from '../ui/Button.jsx'
import Field from '../ui/Field.jsx'
import Select, { RadioGroup } from '../ui/Select.jsx'
import { Input, Textarea } from '../ui/Input.jsx'
import { useToast } from '../ui/feedback.jsx'
import { listTeamOptions } from '../api/teams.js'
import { USE_MOCKS } from '../utils/env.js'
import { toApiValues, toFormValues } from '../utils/candidateForm.js'
import { fieldErrorMap, getErrorMessage } from '../utils/errors.js'
import { discountedBillRate, formatRate, formatVendorPercentage } from '../utils/format.js'
import {
  EMPLOYMENT_TYPE_OPTIONS,
  INTERNAL_ENTITY_OPTIONS,
  PAY_CYCLE_OPTIONS,
  PAYROLL_COMPANY_OPTIONS,
  PLACEMENT_COMPANY_OPTIONS,
  TEAM_TYPE_OPTIONS,
  US_STATE_OPTIONS,
  VISA_STATUS_OPTIONS,
  YES_NO_OPTIONS,
} from '../utils/options.js'

// The fields the form owns (so we never send unrelated candidate data back on edit).
const FORM_FIELDS = [
  'candidateName', 'candidatePersonalEmail', 'candidateDirectNumber', 'sourcingRecruiter', 'sourcingRecruiterLead',
  'teamType', 'internalEntity', 'payrollCompany', 'payrollCompanyOther', 'clientName', 'clientState', 'clientLocation',
  'clientReportingManager', 'reportingManagerEmail', 'reportingManagerContact', 'vendor', 'role', 'location',
  'employmentType', 'internalCompanyPlacement', 'placementCompany', 'sharedPlacement', 'sharedTeamId', 'billRate',
  'discountPrice', 'payRate', 'startDate', 'dojDate', 'ccCompany', 'referral', 'referralAmount', 'ssn', 'visaStatus',
  'workAuthorizationExpDate', 'relocationExpenses', 'payCycle', 'existingEmployee', 'h1TransferDetails', 'jobDescription',
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/
const SSN_RE = /^\d{3}-\d{2}-\d{4}$/

const toNum = (v) => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

// Keep only the fields the form owns, dropping nulls (so inputs start empty) while
// preserving explicit false (e.g. existingEmployee) and empty-string dates.
function pickFormValues(source) {
  const out = {}
  for (const key of FORM_FIELDS) {
    if (key in source && source[key] !== null) out[key] = source[key]
  }
  return out
}

// --- Field components (module scope so inputs never remount / lose focus while typing) ---
// `form` is { v, set, errors }.
function TextField({ form, name, label, required, hint, placeholder, type = 'text', prefix }) {
  const err = form.errors[name]
  return (
    <Field label={label} required={required} hint={err ? undefined : hint} error={err} htmlFor={`cf-${name}`}>
      <Input id={`cf-${name}`} type={type} prefix={prefix} placeholder={placeholder} value={form.v[name] ?? ''} invalid={!!err} onChange={(e) => form.set(name, e.target.value)} />
    </Field>
  )
}
function RateField({ form, name, label, required, hint }) {
  const err = form.errors[name]
  return (
    <Field label={label} required={required} hint={err ? undefined : hint} error={err} htmlFor={`cf-${name}`}>
      <Input id={`cf-${name}`} inputMode="decimal" prefix="$" value={form.v[name] ?? ''} invalid={!!err} onChange={(e) => form.set(name, e.target.value)} />
    </Field>
  )
}
function SelectField({ form, name, label, required, hint, options, placeholder = 'Select', allowClear }) {
  const err = form.errors[name]
  return (
    <Field label={label} required={required} hint={err ? undefined : hint} error={err} htmlFor={`cf-${name}`}>
      <Select id={`cf-${name}`} options={options} placeholder={placeholder} allowClear={allowClear} value={form.v[name]} invalid={!!err} onChange={(val) => form.set(name, val)} />
    </Field>
  )
}
function RadioField({ form, name, label, required, options }) {
  return (
    <Field label={label} required={required} error={form.errors[name]} htmlFor={`cf-${name}`}>
      <div id={`cf-${name}`}>
        <RadioGroup options={options} value={form.v[name]} onChange={(val) => form.set(name, val)} />
      </div>
    </Field>
  )
}
function DisabledField({ label, value, hint }) {
  return (
    <Field label={label} hint={hint}>
      <Input value={value ?? '—'} disabled readOnly />
    </Field>
  )
}

// Card title with an icon in front
function SectionTitle({ icon, children }) {
  return (
    <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
      <span className="text-brand">{icon}</span>
      {children}
    </h2>
  )
}

export default function CandidateForm({
  initialValues,
  recruiterName,
  recruiterLocation,
  teamName,
  salesLeadName,
  salesManagerName,
  submitText,
  onSubmit,
  onCancel,
  showSampleButton = false,
}) {
  const toast = useToast()
  const [values, setValues] = useState(() => pickFormValues(toFormValues(initialValues ?? {})))
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [teamOptions, setTeamOptions] = useState([])

  useEffect(() => {
    listTeamOptions()
      .then((teams) => setTeamOptions(teams.map((team) => ({ value: team.id, label: team.name }))))
      .catch(() => toast.error('Could not load the team list'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const v = values
  const isC2C = v.employmentType === 'C2C'
  const discounted = discountedBillRate(v.billRate, v.discountPrice)
  const payAboveBill = useMemo(() => {
    const bill = toNum(discounted) ?? toNum(v.billRate)
    const pay = toNum(v.payRate)
    return bill != null && pay != null && pay > bill
  }, [v.billRate, v.payRate, discounted])

  function set(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e))
  }
  const form = { v, set, errors }

  function validate() {
    const e = {}
    const req = (name, label) => {
      if (!String(v[name] ?? '').trim()) e[name] = `Enter ${label}`
    }
    const chosen = (name, label) => {
      if (v[name] === undefined || v[name] === '' || v[name] === null) e[name] = `Choose ${label}`
    }
    req('candidateName', 'the candidate name')
    if (!String(v.candidatePersonalEmail ?? '').trim()) e.candidatePersonalEmail = 'Enter the personal email'
    else if (!EMAIL_RE.test(v.candidatePersonalEmail)) e.candidatePersonalEmail = 'Enter a valid email, e.g. name@company.com'
    if (!String(v.candidateDirectNumber ?? '').trim()) e.candidateDirectNumber = 'Enter the direct number'
    else if (!PHONE_RE.test(v.candidateDirectNumber)) e.candidateDirectNumber = 'Enter a valid US phone number, e.g. (555) 010-1234'
    chosen('teamType', 'a team type')
    chosen('internalEntity', 'a placement entity')
    if (v.payrollCompany === 'Other') req('payrollCompanyOther', 'the payroll company name')
    req('clientName', 'the client name')
    chosen('clientState', 'the client state')
    req('clientLocation', 'the client location')
    if (v.reportingManagerEmail && !EMAIL_RE.test(v.reportingManagerEmail)) e.reportingManagerEmail = 'Enter a valid email'
    if (v.reportingManagerContact && !PHONE_RE.test(v.reportingManagerContact)) e.reportingManagerContact = 'Enter a valid US phone number'
    req('vendor', 'the vendor')
    req('role', 'the job title')
    req('location', 'the location')
    chosen('employmentType', 'an employment type')
    if (v.internalCompanyPlacement === undefined) e.internalCompanyPlacement = 'Choose Yes or No'
    else if (v.internalCompanyPlacement && !v.placementCompany) e.placementCompany = 'Choose a company'
    if (v.sharedPlacement === undefined) e.sharedPlacement = 'Choose Yes or No'
    else if (v.sharedPlacement && !v.sharedTeamId) e.sharedTeamId = 'Choose a team'
    if (toNum(v.billRate) === null) e.billRate = 'Enter the bill rate'
    if (toNum(v.discountPrice) !== null && toNum(v.billRate) !== null && toNum(v.discountPrice) > toNum(v.billRate))
      e.discountPrice = "The discount can't be more than the bill rate"
    if (toNum(v.payRate) === null) e.payRate = 'Enter the pay rate'
    chosen('startDate', 'the start date')
    if (isC2C) req('ccCompany', 'the CC company')
    if (v.ssn && !SSN_RE.test(v.ssn)) e.ssn = 'Use the format 123-45-6789'
    chosen('visaStatus', 'the visa status')
    if (v.workAuthorizationExpDate && v.startDate && v.workAuthorizationExpDate <= v.startDate)
      e.workAuthorizationExpDate = 'Must be after the start date'
    req('relocationExpenses', 'the relocation expenses')
    chosen('payCycle', 'the pay cycle')
    if (v.existingEmployee === undefined) e.existingEmployee = 'Choose Yes or No'
    if (v.visaStatus === 'H1 Transfer') req('h1TransferDetails', 'the H1 transfer details')
    req('jobDescription', 'the job description')
    return e
  }

  async function fillSampleData() {
    const { makeSampleIntake } = await import('../mocks/data.js')
    setValues(pickFormValues(toFormValues(makeSampleIntake())))
    setErrors({})
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) {
      toast.error('Please fix the highlighted fields')
      const first = FORM_FIELDS.find((f) => found[f])
      document.getElementById(`cf-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setSubmitting(true)
    try {
      await onSubmit(toApiValues(values))
    } catch (error) {
      const map = fieldErrorMap(error)
      if (map) {
        setErrors(map)
        toast.error('Please fix the highlighted fields')
      } else {
        toast.error(getErrorMessage(error, 'Could not save the candidate'))
      }
      setSubmitting(false)
    }
  }

  const grid = 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {showSampleButton && (import.meta.env.DEV || USE_MOCKS) && (
        <Button variant="default" icon={<ExperimentOutlined />} onClick={fillSampleData} className="border-dashed" type="button">
          Fill sample data
        </Button>
      )}

      {/* ----- Candidate & Recruiter ----- */}
      <Card title={<SectionTitle icon={<UserOutlined />}>Candidate &amp; Recruiter</SectionTitle>}>
        <div className={grid}>
          <TextField form={form} name="candidateName" label="Candidate name" required />
          <TextField form={form} name="candidatePersonalEmail" label="Personal email" required />
          <TextField form={form} name="candidateDirectNumber" label="Direct number" required placeholder="(555) 010-1234" hint="No Google Voice numbers" />
          <DisabledField label="Recruiter" value={recruiterName} />
          <TextField form={form} name="sourcingRecruiter" label="Sourcing recruiter (optional)" />
          <TextField form={form} name="sourcingRecruiterLead" label="Sourcing recruiter lead (optional)" />
          <DisabledField label="Recruiter location" value={recruiterLocation} hint="Set by an admin on your profile" />
          <DisabledField label="Team" value={teamName} hint="The Sales Lead and Sales Manager are set from the team" />
          <DisabledField label="Sales Lead" value={salesLeadName} />
          <DisabledField label="Sales Manager" value={salesManagerName} />
          <RadioField form={form} name="teamType" label="Team type" required options={TEAM_TYPE_OPTIONS} />
          <SelectField form={form} name="internalEntity" label="Placement entity" required options={INTERNAL_ENTITY_OPTIONS} />
          <SelectField form={form} name="payrollCompany" label="Payroll company (optional)" options={PAYROLL_COMPANY_OPTIONS} allowClear />
          {v.payrollCompany === 'Other' && <TextField form={form} name="payrollCompanyOther" label="Payroll company name" required />}
        </div>
      </Card>

      {/* ----- Client ----- */}
      <Card title={<SectionTitle icon={<ShopOutlined />}>Client</SectionTitle>}>
        <div className={grid}>
          <TextField form={form} name="clientName" label="Client name" required />
          <SelectField form={form} name="clientState" label="Client state" required options={US_STATE_OPTIONS} placeholder="Select a state" />
          <TextField form={form} name="clientLocation" label="Client location" required placeholder="City / work site" />
          <TextField form={form} name="clientReportingManager" label="Reporting manager (optional)" />
          <TextField form={form} name="reportingManagerEmail" label="Manager email (optional)" />
          <TextField form={form} name="reportingManagerContact" label="Manager contact (optional)" placeholder="(555) 010-1234" />
        </div>
      </Card>

      {/* ----- Engagement & Compliance ----- */}
      <Card title={<SectionTitle icon={<AuditOutlined />}>Engagement &amp; Compliance</SectionTitle>}>
        <div className={grid}>
          <TextField form={form} name="vendor" label="Vendor" required />
          <TextField form={form} name="role" label="Job title" required />
          <TextField form={form} name="location" label="Location" required placeholder="City, State" />
          <SelectField form={form} name="employmentType" label="Employment type" required options={EMPLOYMENT_TYPE_OPTIONS} />
          <RadioField form={form} name="internalCompanyPlacement" label="Internal company placement?" required options={YES_NO_OPTIONS} />
          {v.internalCompanyPlacement && <SelectField form={form} name="placementCompany" label="To which company?" required options={PLACEMENT_COMPANY_OPTIONS} placeholder="Select a company" />}
          <RadioField form={form} name="sharedPlacement" label="Shared placement?" required options={YES_NO_OPTIONS} />
          {v.sharedPlacement && <SelectField form={form} name="sharedTeamId" label="Shared with which team?" required options={teamOptions} placeholder="Select a team" />}
          <RateField form={form} name="billRate" label="Bill rate ($ / hr)" required />
          <RateField form={form} name="discountPrice" label="Discount price ($ / hr) (optional)" hint="Discounted bill rate = bill rate − discount price" />
          {discounted != null && <DisabledField label="Discounted bill rate" value={formatRate(discounted)} hint="The vendor percentage below uses this rate" />}
          <Field label="Pay rate ($ / hr)" required error={errors.payRate} hint={payAboveBill && !errors.payRate ? 'Pay rate is higher than the bill rate' : undefined} htmlFor="cf-payRate">
            <Input id="cf-payRate" inputMode="decimal" prefix="$" value={v.payRate ?? ''} invalid={!!errors.payRate} onChange={(e) => set('payRate', e.target.value)} />
          </Field>
          <DisabledField label="Vendor percentage" value={formatVendorPercentage(v.payRate, v.billRate, v.discountPrice)} hint="Pay ÷ bill × 100 (discounted bill rate if there is a discount)" />
          <TextField form={form} name="startDate" label="Start date" required type="date" />
          <TextField form={form} name="dojDate" label="Date of joining (optional)" type="date" />
          <TextField form={form} name="ccCompany" label={isC2C ? 'CC company' : 'CC company (optional)'} required={isC2C} />
          <TextField form={form} name="referral" label="Referral (optional)" />
          <RateField form={form} name="referralAmount" label="Referral amount (optional)" />
          <TextField form={form} name="ssn" label="SSN (optional)" placeholder="123-45-6789" />
          <SelectField form={form} name="visaStatus" label="Visa status" required options={VISA_STATUS_OPTIONS} />
          <TextField form={form} name="workAuthorizationExpDate" label="Work authorization expiry (optional)" type="date" hint="Can be left empty: HR can fill it in later" />
          <TextField form={form} name="relocationExpenses" label="Relocation expenses" required placeholder="e.g. None, or $2,000 one-time" />
          <SelectField form={form} name="payCycle" label="Pay cycle" required options={PAY_CYCLE_OPTIONS} />
          <RadioField form={form} name="existingEmployee" label="Existing employee?" required options={YES_NO_OPTIONS} />
          {v.visaStatus === 'H1 Transfer' && (
            <Field className="md:col-span-2 xl:col-span-3" label="H1 transfer details" required error={errors.h1TransferDetails} hint="Current employer, receipt number, and where the transfer stands" htmlFor="cf-h1TransferDetails">
              <Textarea id="cf-h1TransferDetails" rows={2} value={v.h1TransferDetails ?? ''} invalid={!!errors.h1TransferDetails} onChange={(e) => set('h1TransferDetails', e.target.value)} />
            </Field>
          )}
          <Field className="md:col-span-2 xl:col-span-3" label="Job description" required error={errors.jobDescription} htmlFor="cf-jobDescription">
            <Textarea id="cf-jobDescription" rows={4} maxLength={4000} value={v.jobDescription ?? ''} invalid={!!errors.jobDescription} onChange={(e) => set('jobDescription', e.target.value)} />
            <p className="mt-1 text-right text-xs text-muted">{(v.jobDescription ?? '').length}/4000</p>
          </Field>
        </div>
      </Card>

      <Card bodyClassName="p-4">
        <div className="flex justify-end gap-2">
          <Button variant="default" onClick={onCancel} type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={submitting}>
            {submitText}
          </Button>
        </div>
      </Card>
    </form>
  )
}
