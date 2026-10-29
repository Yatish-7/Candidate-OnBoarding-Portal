import { useState } from 'react'
import { Alert, App as AntApp, Button, DatePicker, Form, InputNumber, Radio, Space, Typography } from 'antd'
import { CalendarOutlined, CheckOutlined, CloseOutlined, DollarOutlined, SafetyOutlined, UserDeleteOutlined } from '@ant-design/icons'
import * as api from '../api/candidates.js'
import { useAuth } from '../context/AuthContext.js'
import { formatDateTime } from '../utils/format.js'
import {
  canApproveDoj,
  canApproveSalesLead,
  canDeclineSalesLead,
  canOverride,
  canReviewAccounts,
  canReviewContracts,
  canReviewHr,
  canChangeRates,
  canDecideProjectEnd,
  canDropOut,
  canRaiseProjectEnd,
  canReviewPayroll,
  canSetProjectEnd,
} from '../utils/permissions.js'
import ActionModal from './ActionModal.jsx'

// A plain "Approve" action for one workflow step (optional comment).
function approveAction(key, label, title, allowed, run, success) {
  return {
    key,
    label,
    icon: <CheckOutlined />,
    type: 'primary',
    allowed,
    modal: { title, okText: 'Approve' },
    run,
    success,
  }
}

// A "Decline" action: the comment is required
function declineAction(key, label, title, allowed, run, success = 'Declined — sent back to the Sales Lead.') {
  return {
    key,
    label,
    icon: <CloseOutlined />,
    danger: true,
    allowed,
    modal: { title, okText: 'Decline', danger: true, commentRequired: true },
    run,
    success,
  }
}

// Builds the actions that this backend supports. "allowed" decides whether the button shows.
function getActions(user, candidate) {
  const id = candidate.id
  const currentOverride = candidate.override // null until the Super Admin overrides
  const isRecruiter = user.role === 'RECRUITER'

  return [
    approveAction('salesLeadApprove', 'Approve candidate', 'Approve candidate',
      canApproveSalesLead(user, candidate),
      (values) => api.approveSalesLead(id, values.comment),
      'Approved — now in HR & Contracts review.'),
    declineAction('salesLeadDecline', 'Decline candidate', 'Decline candidate',
      canDeclineSalesLead(user, candidate),
      (values) => api.declineSalesLead(id, values.comment),
      'Candidate declined.'),

    // HR and Contracts run in parallel: each can approve or decline independently.
    approveAction('hrApprove', 'Approve (HR)', 'HR approval', canReviewHr(user, candidate),
      (values) => api.approveHr(id, values.comment), 'HR approved.'),
    declineAction('hrDecline', 'Decline (HR)', 'Decline candidate (HR)', canReviewHr(user, candidate),
      (values) => api.declineHr(id, values.comment)),

    approveAction('contractsApprove', 'Approve (Contracts)', 'Contracts approval',
      canReviewContracts(user, candidate),
      (values) => api.approveContracts(id, values.comment), 'Contracts approved.'),
    declineAction('contractsDecline', 'Decline (Contracts)', 'Decline candidate (Contracts)',
      canReviewContracts(user, candidate),
      (values) => api.declineContracts(id, values.comment)),

    // Payroll and Accounts review in parallel once HR and Contracts have both approved.
    approveAction('payrollApprove', 'Approve (Payroll)', 'Payroll approval', canReviewPayroll(user, candidate),
      (values) => api.approvePayroll(id, values.comment), 'Payroll approved.'),
    declineAction('payrollDecline', 'Decline (Payroll)', 'Decline candidate (Payroll)',
      canReviewPayroll(user, candidate),
      (values) => api.declinePayroll(id, values.comment)),

    approveAction('accountsApprove', 'Approve (Accounts)', 'Accounts approval',
      canReviewAccounts(user, candidate),
      (values) => api.approveAccounts(id, values.comment), 'Accounts approved.'),
    declineAction('accountsDecline', 'Decline (Accounts)', 'Decline candidate (Accounts)',
      canReviewAccounts(user, candidate),
      (values) => api.declineAccounts(id, values.comment)),

    // The recruiter supplied the DOJ at intake; the Sales Lead approves it here.
    // The DOJ needs the Sales Lead / Manager AND HR to approve; each approves once.
    approveAction('approveDoj', 'Approve DOJ', 'Approve date of joining',
      canApproveDoj(user, candidate),
      (values) => api.approveDoj(id, values.comment),
      'Date of Joining approval saved. It is approved once the Sales Lead / Manager and HR have both approved.'),

    // Rates can change mid-way (Sales Lead / Manager / Super Admin); a comment is required and everyone is emailed.
    {
      key: 'changeRates',
      label: 'Change rates',
      icon: <DollarOutlined />,
      allowed: canChangeRates(user, candidate),
      modal: {
        title: 'Change bill / pay rate',
        okText: 'Save rates',
        commentRequired: true,
        initialValues: {
          billRate: candidate.billRate != null && candidate.billRate !== '' ? Number(candidate.billRate) : undefined,
          payRate: candidate.payRate != null && candidate.payRate !== '' ? Number(candidate.payRate) : undefined,
        },
        fields: (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              title="Everyone in the loop is emailed"
              description="HR, Contracts, Payroll, Accounts, the Super Admin, the Sales Lead / Manager and the recruiter. Say why the rate changed below."
            />
            <Form.Item name="billRate" label="Bill rate ($ / hr)">
              <InputNumber min={0} precision={2} prefix="$" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="payRate" label="Pay rate ($ / hr)">
              <InputNumber min={0} precision={2} prefix="$" style={{ width: '100%' }} />
            </Form.Item>
          </>
        ),
      },
      run: (values) => api.changeRates(id, { billRate: values.billRate, payRate: values.payRate }, values.comment),
      success: 'Rates changed — everyone has been emailed.',
    },

    // Project end date, only after the DOJ is approved: the recruiter raises it; the Lead / Manager AND HR must both
    // approve it (the Super Admin settles it alone); any of them can decline. Approved = exited.
    approveAction('approveProjectEnd', 'Approve project end date', 'Approve project end date',
      canDecideProjectEnd(user, candidate),
      (values) => api.approveProjectEnd(id, values.comment),
      'Project end date approval saved. It is approved once the Sales Lead / Manager and HR have both approved.'),
    declineAction('declineProjectEnd', 'Decline project end date', 'Decline project end date',
      canDecideProjectEnd(user, candidate),
      (values) => api.declineProjectEnd(id, values.comment),
      'Project end date declined — the recruiter has been told.'),
    {
      key: 'projectEnd',
      label: isRecruiter
        ? 'Raise project end date'
        : candidate.projectEndStatus === 'APPROVED' ? 'Change project end date' : 'Set project end date',
      icon: <CalendarOutlined />,
      allowed: canRaiseProjectEnd(user, candidate) || canSetProjectEnd(user, candidate),
      modal: {
        title: isRecruiter ? 'Raise project end date' : 'Set project end date',
        okText: isRecruiter ? 'Raise for approval' : 'Save',
        fields: (
          <Form.Item
            name="projectEndDate"
            label="Project end date"
            rules={[{ required: true, message: 'Choose the project end date' }]}
            extra={
              isRecruiter
                ? 'Your Sales Lead / Sales Manager is asked to approve it. The candidate shows as Exited once it is approved.'
                : 'Entering it here approves it: the candidate shows as Exited and HR, Contracts, Payroll, Accounts and the recruiter are emailed.'
            }
          >
            <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
          </Form.Item>
        ),
      },
      run: (values) => api.setProjectEnd(id, values.projectEndDate.format('YYYY-MM-DD'), values.comment),
      success: isRecruiter
        ? 'Project end date raised — waiting for approval.'
        : 'Project end date saved — the candidate is now Exited and the team has been emailed.',
    },

    // After joining, if the candidate leaves in the middle of the project: recorded with a reason; they move to
    // the Super Admin's Drop Outs / Back Outs card.
    {
      key: 'dropOut',
      label: 'Drop out / Back out',
      icon: <UserDeleteOutlined />,
      danger: true,
      allowed: canDropOut(user, candidate),
      modal: {
        title: 'Drop out / Back out',
        okText: 'Record drop out',
        danger: true,
        commentRequired: true,
        fields: (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title="The candidate left after joining"
            description="They are moved to Drop Outs / Back Outs and everyone in the loop is emailed. Give the reason below."
          />
        ),
      },
      run: (values) => api.dropOut(id, values.comment),
      success: 'Recorded — the candidate is now a drop out / back out and everyone has been emailed.',
    },

    {
      key: 'override',
      label: currentOverride ? 'Change override' : 'Admin override',
      icon: <SafetyOutlined />,
      danger: true,
      allowed: canOverride(user, candidate),
      modal: {
        title: currentOverride ? 'Change admin override' : 'Admin override',
        okText: currentOverride ? 'Change decision' : 'Confirm override',
        danger: true,
        commentRequired: true,
        fields: (
          <>
            {currentOverride ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                title={`Current decision: ${currentOverride.decision === 'APPROVED' ? 'Approved' : 'Rejected'}`}
                description={`Set by ${currentOverride.by ?? 'Super Admin'} on ${formatDateTime(currentOverride.at)}. The change is added to the approval trail; the earlier decision stays there too.`}
              />
            ) : (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
                title="This stops the approval workflow"
                description="It approves or rejects the candidate right away, at whatever stage it is in. You can change the decision later; every change is recorded in the approval trail."
              />
            )}
            <Form.Item
              name="decision"
              label={currentOverride ? 'New decision' : 'Decision'}
              rules={[
                { required: true, message: 'Choose Approve or Reject' },
                {
                  validator: (_, value) =>
                    value && value === currentOverride?.decision
                      ? Promise.reject(new Error('That is already the current decision'))
                      : Promise.resolve(),
                },
              ]}
            >
              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                options={[
                  { value: 'APPROVED', label: 'Approve' },
                  { value: 'REJECTED', label: 'Reject' },
                ]}
              />
            </Form.Item>
          </>
        ),
      },
      run: (values) => api.overrideCandidate(id, values.decision, values.comment),
      success: currentOverride ? 'Override changed.' : 'Override saved.',
    },
  ]
}

// The buttons on the candidate detail page. onChanged() reloads the candidate after an action.
export default function ActionButtons({ candidate, onChanged }) {
  const { user } = useAuth()
  const { message } = AntApp.useApp()
  const [openActionKey, setOpenActionKey] = useState(null)

  const actions = getActions(user, candidate).filter((action) => action.allowed)
  const openAction = actions.find((action) => action.key === openActionKey)

  if (actions.length === 0) {
    return <Typography.Text type="secondary">No actions for you at this stage.</Typography.Text>
  }

  // Called by the modal. If run() fails, the modal stays open and shows the error.
  async function handleSubmit(values) {
    await openAction.run(values)
    setOpenActionKey(null)
    message.success(openAction.success)
    onChanged()
  }

  return (
    <>
      <Space wrap>
        {actions.map((action) => (
          <Button
            key={action.key}
            type={action.type}
            danger={action.danger}
            icon={action.icon}
            onClick={() => setOpenActionKey(action.key)}
          >
            {action.label}
          </Button>
        ))}
      </Space>

      {openAction && (
        <ActionModal
          title={openAction.modal.title}
          okText={openAction.modal.okText}
          danger={openAction.modal.danger}
          commentRequired={openAction.modal.commentRequired}
          hideComment={openAction.modal.hideComment}
          initialValues={openAction.modal.initialValues}
          onCancel={() => setOpenActionKey(null)}
          onSubmit={handleSubmit}
        >
          {openAction.modal.fields}
        </ActionModal>
      )}
    </>
  )
}
