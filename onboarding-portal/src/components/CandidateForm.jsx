import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import {
  App as AntApp,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
} from 'antd'
import { AuditOutlined, ExperimentOutlined, ShopOutlined, UserOutlined } from '@ant-design/icons'
import { listTeamOptions } from '../api/teams.js'
import { USE_MOCKS } from '../utils/env.js'
import { toApiValues, toFormValues } from '../utils/candidateForm.js'
import { getErrorMessage, showFieldErrors } from '../utils/errors.js'
import { discountedBillRate, formatRate, formatVendorPercentage } from '../utils/format.js'
import {
  INTERNAL_ENTITY_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  PAY_CYCLE_OPTIONS,
  PAYROLL_COMPANY_OPTIONS,
  PLACEMENT_COMPANY_OPTIONS,
  US_STATE_OPTIONS,
  TEAM_TYPE_OPTIONS,
  VISA_STATUS_OPTIONS,
  YES_NO_OPTIONS,
} from '../utils/options.js'

// ---------------------------------------------------------------------------
// Every field is mandatory EXCEPT: CC company, Date of joining, SSN, Client reporting
// manager, Manager email and Manager contact. The format rules (EMAIL, PHONE, SSN) only
// check those optional fields when they are filled in.
// ---------------------------------------------------------------------------
const required = (what) => ({ required: true, whitespace: true, message: `Enter ${what}` })
const chosen = (what) => ({ required: true, message: `Choose ${what}` })
// For number boxes (InputNumber): the "whitespace" check in required() fails on numbers, so it isn't used here
const entered = (what) => ({ required: true, message: `Enter ${what}` })
const EMAIL = { type: 'email', message: 'Enter a valid email, e.g. name@company.com' }
const PHONE = {
  pattern: /^(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
  message: 'Enter a valid US phone number, e.g. (555) 010-1234',
}
const SSN = { pattern: /^\d{3}-\d{2}-\d{4}$/, message: 'Use the format 123-45-6789' }

// Pay rate above bill rate shows a yellow WARNING but doesn't block saving.
const PAY_NOT_ABOVE_BILL = ({ getFieldValue }) => ({
  warningOnly: true,
  validator(_, payRate) {
    // compare with the discounted bill rate when there is a discount
    const billRate = discountedBillRate(getFieldValue('billRate'), getFieldValue('discountPrice')) ?? getFieldValue('billRate')
    if (payRate != null && billRate != null && payRate > billRate) {
      return Promise.reject(new Error('Pay rate is higher than the bill rate'))
    }
    return Promise.resolve()
  },
})

// The discount price comes off the bill rate, so it can't be more than the bill rate
const DISCOUNT_NOT_ABOVE_BILL = ({ getFieldValue }) => ({
  validator(_, discount) {
    const billRate = getFieldValue('billRate')
    if (discount != null && billRate != null && discount > billRate) {
      return Promise.reject(new Error("The discount can't be more than the bill rate"))
    }
    return Promise.resolve()
  },
})

// If both are filled, the work authorization must still be valid after the start date
const EXPIRY_AFTER_START = ({ getFieldValue }) => ({
  validator(_, expiry) {
    const start = getFieldValue('startDate')
    if (expiry && start && !expiry.isAfter(start, 'day')) {
      return Promise.reject(new Error('Must be after the start date'))
    }
    return Promise.resolve()
  },
})

const isPastDate = (date) => date && date.isBefore(dayjs(), 'day')

// Card title with an icon in front
function SectionTitle({ icon, children }) {
  return (
    <Space>
      <span style={{ color: '#4f46e5' }}>{icon}</span>
      {children}
    </Space>
  )
}

// Each field takes a full row on phones, half on tablets, a third on wide screens
const COL = { xs: 24, md: 12, xl: 8 }

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
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const { message } = AntApp.useApp()

  const visaStatus = Form.useWatch('visaStatus', form)
  const isC2C = Form.useWatch('employmentType', form) === 'C2C'
  const billRateValue = Form.useWatch('billRate', form)
  const payRateValue = Form.useWatch('payRate', form)
  const discountValue = Form.useWatch('discountPrice', form)
  const discounted = discountedBillRate(billRateValue, discountValue)
  const internalPlacement = Form.useWatch('internalCompanyPlacement', form)
  const sharedPlacement = Form.useWatch('sharedPlacement', form)
  const payrollCompany = Form.useWatch('payrollCompany', form)

  // Team names for the "shared with" dropdown (open to every signed-in user)
  const [teamOptions, setTeamOptions] = useState([])
  useEffect(() => {
    listTeamOptions()
      .then((teams) => setTeamOptions(teams.map((team) => ({ value: team.id, label: team.name }))))
      .catch(() => message.error('Could not load the team list'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fillSampleData() {
    // Loaded on demand so the made-up test data never ships in the production build
    const { makeSampleIntake } = await import('../mocks/data.js')
    form.setFieldsValue(toFormValues(makeSampleIntake()))
    form.validateFields().catch(() => {})
  }

  async function handleFinish(values) {
    setSubmitting(true)
    try {
      await onSubmit(toApiValues(values))
    } catch (error) {
      if (showFieldErrors(form, error)) {
        message.error('Please fix the highlighted fields')
      } else {
        message.error(getErrorMessage(error, 'Could not save the candidate'))
      }
      setSubmitting(false)
    }
  }

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={handleFinish}
      onFinishFailed={() => message.error('Please fix the highlighted fields')}
      scrollToFirstError
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        {/* Test helper: only in development or mock mode, never for real users */}
        {showSampleButton && (import.meta.env.DEV || USE_MOCKS) && (
          <Button type="dashed" icon={<ExperimentOutlined />} onClick={fillSampleData} style={{ alignSelf: 'flex-start' }}>
            Fill sample data
          </Button>
        )}

        {/* ----- Candidate & Recruiter ----- */}
        <Card title={<SectionTitle icon={<UserOutlined />}>Candidate & Recruiter</SectionTitle>} size="small">
          <Row gutter={16}>
            <Col {...COL}>
              <Form.Item name="candidateName" label="Candidate name" rules={[required('the candidate name')]}>
                <Input />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="candidatePersonalEmail" label="Personal email" rules={[required('the personal email'), EMAIL]}>
                <Input />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="candidateDirectNumber" label="Direct number" rules={[required('the direct number'), PHONE]} extra="No Google Voice numbers">
                <Input placeholder="(555) 010-1234" />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item label="Recruiter">
                <Input value={recruiterName} disabled />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="sourcingRecruiter" label="Sourcing recruiter (optional)">
                <Input />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="sourcingRecruiterLead" label="Sourcing recruiter lead (optional)">
                <Input />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item label="Recruiter location" extra="Set by an admin on your profile">
                <Input value={recruiterLocation ?? '—'} disabled />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item label="Team" extra="The Sales Lead and Sales Manager are set from the team">
                <Input value={teamName} disabled />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item label="Sales Lead">
                <Input value={salesLeadName ?? '—'} disabled />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item label="Sales Manager">
                <Input value={salesManagerName ?? '—'} disabled />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="teamType" label="Team type" rules={[chosen('a team type')]}>
                <Radio.Group options={TEAM_TYPE_OPTIONS} optionType="button" />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="internalEntity" label="Placement entity" rules={[chosen('a placement entity')]}>
                <Select options={INTERNAL_ENTITY_OPTIONS} placeholder="Select" showSearch />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="payrollCompany" label="Payroll company (optional)">
                <Select options={PAYROLL_COMPANY_OPTIONS} placeholder="Select" allowClear showSearch />
              </Form.Item>
            </Col>
            {payrollCompany === 'Other' && (
              <Col {...COL}>
                <Form.Item
                  name="payrollCompanyOther"
                  label="Payroll company name"
                  rules={[required('the payroll company name'), { max: 100, message: 'At most 100 characters' }]}
                >
                  <Input />
                </Form.Item>
              </Col>
            )}
          </Row>
        </Card>

        {/* ----- Client ----- */}
        <Card title={<SectionTitle icon={<ShopOutlined />}>Client</SectionTitle>} size="small">
          <Row gutter={16}>
            <Col {...COL}>
              <Form.Item name="clientName" label="Client name" rules={[required('the client name')]}>
                <Input />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="clientState" label="Client state" rules={[chosen('the client state')]}>
                <Select options={US_STATE_OPTIONS} placeholder="Select a state" showSearch optionFilterProp="label" />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="clientLocation" label="Client location" rules={[required('the client location')]}>
                <Input placeholder="City / work site" />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="clientReportingManager" label="Reporting manager (optional)">
                <Input />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="reportingManagerEmail" label="Manager email (optional)" rules={[EMAIL]}>
                <Input />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="reportingManagerContact" label="Manager contact (optional)" rules={[PHONE]}>
                <Input placeholder="(555) 010-1234" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ----- Engagement & Compliance ----- */}
        <Card title={<SectionTitle icon={<AuditOutlined />}>Engagement & Compliance</SectionTitle>} size="small">
          <Row gutter={16}>
            <Col {...COL}>
              <Form.Item name="vendor" label="Vendor" rules={[required('the vendor')]}>
                <Input />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="role" label="Job title" rules={[required('the job title')]}>
                <Input />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="location" label="Location" rules={[required('the location')]}>
                <Input placeholder="City, State" />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="employmentType" label="Employment type" rules={[chosen('an employment type')]}>
                <Select options={EMPLOYMENT_TYPE_OPTIONS} placeholder="Select" />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item
                name="internalCompanyPlacement"
                label="Internal company placement?"
                rules={[chosen('Yes or No')]}
              >
                <Radio.Group options={YES_NO_OPTIONS} />
              </Form.Item>
            </Col>
            {internalPlacement && (
              <Col {...COL}>
                <Form.Item name="placementCompany" label="To which company?" rules={[chosen('a company')]}>
                  <Select options={PLACEMENT_COMPANY_OPTIONS} placeholder="Select a company" showSearch />
                </Form.Item>
              </Col>
            )}
            <Col {...COL}>
              <Form.Item name="sharedPlacement" label="Shared placement?" rules={[chosen('Yes or No')]}>
                <Radio.Group options={YES_NO_OPTIONS} />
              </Form.Item>
            </Col>
            {sharedPlacement && (
              <Col {...COL}>
                <Form.Item name="sharedTeamId" label="Shared with which team?" rules={[chosen('a team')]}>
                  <Select
                    options={teamOptions}
                    placeholder="Select a team"
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>
              </Col>
            )}
            <Col {...COL}>
              <Form.Item name="billRate" label="Bill rate ($ / hr)" rules={[entered('the bill rate')]}>
                <InputNumber min={0} precision={2} prefix="$" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item
                name="discountPrice"
                label="Discount price ($ / hr) (optional)"
                dependencies={['billRate']}
                rules={[DISCOUNT_NOT_ABOVE_BILL]}
                extra="Discounted bill rate = bill rate − discount price"
              >
                <InputNumber min={0} precision={2} prefix="$" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            {discounted != null && (
              <Col {...COL}>
                <Form.Item label="Discounted bill rate" extra="The vendor percentage below uses this rate">
                  <Input value={formatRate(discounted)} disabled />
                </Form.Item>
              </Col>
            )}
            <Col {...COL}>
              <Form.Item
                name="payRate"
                label="Pay rate ($ / hr)"
                dependencies={['billRate', 'discountPrice']}
                rules={[entered('the pay rate'), PAY_NOT_ABOVE_BILL]}
              >
                <InputNumber min={0} precision={2} prefix="$" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item label="Vendor percentage" extra="Pay rate ÷ bill rate × 100 (discounted bill rate if there is a discount)">
                <Input value={formatVendorPercentage(payRateValue, billRateValue, discountValue)} disabled />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="startDate" label="Start date" rules={[chosen('the start date')]}>
                <DatePicker format="DD MMM YYYY" disabledDate={isPastDate} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="dojDate" label="Date of joining (optional)">
                <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item
                name="ccCompany"
                label={isC2C ? 'CC company' : 'CC company (optional)'}
                dependencies={['employmentType']}
                rules={isC2C ? [required('the CC company')] : []}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="referral" label="Referral (optional)">
                <Input />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="referralAmount" label="Referral amount (optional)">
                <InputNumber min={0} precision={2} prefix="$" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="ssn" label="SSN (optional)" rules={[SSN]}>
                <Input.Password placeholder="123-45-6789" autoComplete="off" />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="visaStatus" label="Visa status" rules={[chosen('the visa status')]}>
                <Select options={VISA_STATUS_OPTIONS} placeholder="Select" />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item
                name="workAuthorizationExpDate"
                label="Work authorization expiry (optional)"
                dependencies={['startDate']}
                rules={[EXPIRY_AFTER_START]}
                extra="Can be left empty: HR can fill it in later"
              >
                <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="relocationExpenses" label="Relocation expenses" rules={[required('the relocation expenses')]}>
                <Input placeholder="e.g. None, or $2,000 one-time" />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="payCycle" label="Pay cycle" rules={[chosen('the pay cycle')]}>
                <Select options={PAY_CYCLE_OPTIONS} placeholder="Select" />
              </Form.Item>
            </Col>
            <Col {...COL}>
              <Form.Item name="existingEmployee" label="Existing employee?" rules={[chosen('Yes or No')]}>
                <Radio.Group options={YES_NO_OPTIONS} />
              </Form.Item>
            </Col>

            {/* Only shown when "H1 Transfer" is selected */}
            {visaStatus === 'H1 Transfer' && (
              <Col xs={24}>
                <Form.Item
                  name="h1TransferDetails"
                  label="H1 transfer details"
                  extra="Current employer, receipt number, and where the transfer stands"
                  rules={[required('the H1 transfer details')]}
                >
                  <Input.TextArea rows={2} />
                </Form.Item>
              </Col>
            )}

            <Col xs={24}>
              <Form.Item name="jobDescription" label="Job description" rules={[required('the job description')]}>
                <Input.TextArea rows={4} maxLength={4000} showCount />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Buttons in their own bar, aligned right */}
        <Card size="small">
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={onCancel}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {submitText}
            </Button>
          </div>
        </Card>
      </Space>
    </Form>
  )
}
