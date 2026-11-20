import { useState } from 'react'
import { CalendarOutlined, CheckOutlined, CloseOutlined, DollarOutlined, SafetyOutlined, UserDeleteOutlined } from '@ant-design/icons'
import * as api from '../api/candidates.js'
import Button from '../ui/Button.jsx'
import Alert from '../ui/Alert.jsx'
import Field from '../ui/Field.jsx'
import { Input } from '../ui/Input.jsx'
import { RadioGroup } from '../ui/Select.jsx'
import { useToast } from '../ui/feedback.jsx'
import { useAuth } from '../context/AuthContext.js'
import { formatDateTime } from '../utils/format.js'
import {
  canApproveDoj,
  canApproveSalesLead,
  canChangeRates,
  canDecideProjectEnd,
  canDeclineSalesLead,
  canDropOut,
  canOverride,
  canRaiseProjectEnd,
  canReviewAccounts,
  canReviewContracts,
  canReviewHr,
  canReviewPayroll,
  canSetProjectEnd,
} from '../utils/permissions.js'
import ActionModal from './ActionModal.jsx'

// A plain "Approve" action for one workflow step (optional comment).
function approveAction(key, label, title, allowed, run, success) {
  return { key, label, icon: <CheckOutlined />, type: 'primary', allowed, modal: { title, okText: 'Approve' }, run, success }
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

// A rate box inside the change-rates modal
function RateInput({ form, name, label }) {
  return (
    <Field label={label} error={form.errors[name]}>
      <Input inputMode="decimal" prefix="$" value={form.values[name] ?? ''} invalid={!!form.errors[name]} onChange={(e) => form.set(name, e.target.value)} />
    </Field>
  )
}

// Builds the actions that this backend supports. "allowed" decides whether the button shows.
function getActions(user, candidate) {
  const id = candidate.id
  const currentOverride = candidate.override // null until the Super Admin overrides
  const isRecruiter = user.role === 'RECRUITER'

  return [
    approveAction('salesLeadApprove', 'Approve candidate', 'Approve candidate', canApproveSalesLead(user, candidate),
      (values) => api.approveSalesLead(id, values.comment), 'Approved — now in HR & Contracts review.'),
    declineAction('salesLeadDecline', 'Decline candidate', 'Decline candidate', canDeclineSalesLead(user, candidate),
      (values) => api.declineSalesLead(id, values.comment), 'Candidate declined.'),

    approveAction('hrApprove', 'Approve (HR)', 'HR approval', canReviewHr(user, candidate),
      (values) => api.approveHr(id, values.comment), 'HR approved.'),
    declineAction('hrDecline', 'Decline (HR)', 'Decline candidate (HR)', canReviewHr(user, candidate),
      (values) => api.declineHr(id, values.comment)),

    approveAction('contractsApprove', 'Approve (Contracts)', 'Contracts approval', canReviewContracts(user, candidate),
      (values) => api.approveContracts(id, values.comment), 'Contracts approved.'),
    declineAction('contractsDecline', 'Decline (Contracts)', 'Decline candidate (Contracts)', canReviewContracts(user, candidate),
      (values) => api.declineContracts(id, values.comment)),

    approveAction('payrollApprove', 'Approve (Payroll)', 'Payroll approval', canReviewPayroll(user, candidate),
      (values) => api.approvePayroll(id, values.comment), 'Payroll approved.'),
    declineAction('payrollDecline', 'Decline (Payroll)', 'Decline candidate (Payroll)', canReviewPayroll(user, candidate),
      (values) => api.declinePayroll(id, values.comment)),

    approveAction('accountsApprove', 'Approve (Accounts)', 'Accounts approval', canReviewAccounts(user, candidate),
      (values) => api.approveAccounts(id, values.comment), 'Accounts approved.'),
    declineAction('accountsDecline', 'Decline (Accounts)', 'Decline candidate (Accounts)', canReviewAccounts(user, candidate),
      (values) => api.declineAccounts(id, values.comment)),

    approveAction('approveDoj', 'Approve DOJ', 'Approve date of joining', canApproveDoj(user, candidate),
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
          billRate: candidate.billRate != null ? String(candidate.billRate) : '',
          payRate: candidate.payRate != null ? String(candidate.payRate) : '',
        },
        fields: (form) => (
          <>
            <Alert
              tone="info"
              title="Everyone in the loop is emailed"
              message="HR, Contracts, Payroll, Accounts, the Super Admin, the Sales Lead / Manager and the recruiter. Say why the rate changed below."
            />
            <RateInput form={form} name="billRate" label="Bill rate ($ / hr)" />
            <RateInput form={form} name="payRate" label="Pay rate ($ / hr)" />
          </>
        ),
      },
      run: (values) => api.changeRates(id, { billRate: values.billRate, payRate: values.payRate }, values.comment),
      success: 'Rates changed — everyone has been emailed.',
    },

    approveAction('approveProjectEnd', 'Approve project end date', 'Approve project end date', canDecideProjectEnd(user, candidate),
      (values) => api.approveProjectEnd(id, values.comment),
      'Project end date approval saved. It is approved once the Sales Lead / Manager and HR have both approved.'),
    declineAction('declineProjectEnd', 'Decline project end date', 'Decline project end date', canDecideProjectEnd(user, candidate),
      (values) => api.declineProjectEnd(id, values.comment), 'Project end date declined — the recruiter has been told.'),
    {
      key: 'projectEnd',
      label: isRecruiter
        ? 'Raise project end date'
        : candidate.projectEndStatus === 'APPROVED'
          ? 'Change project end date'
          : 'Set project end date',
      icon: <CalendarOutlined />,
      allowed: canRaiseProjectEnd(user, candidate) || canSetProjectEnd(user, candidate),
      modal: {
        title: isRecruiter ? 'Raise project end date' : 'Set project end date',
        okText: isRecruiter ? 'Raise for approval' : 'Save',
        validate: (values) => (values.projectEndDate ? {} : { projectEndDate: 'Choose the project end date' }),
        fields: (form) => (
          <Field
            label="Project end date"
            required
            error={form.errors.projectEndDate}
            hint={
              isRecruiter
                ? 'Your Sales Lead / Sales Manager is asked to approve it. The candidate shows as Exited once it is approved.'
                : 'Entering it here approves it: the candidate shows as Exited and HR, Contracts, Payroll, Accounts and the recruiter are emailed.'
            }
          >
            <Input type="date" value={form.values.projectEndDate ?? ''} invalid={!!form.errors.projectEndDate} onChange={(e) => form.set('projectEndDate', e.target.value)} />
          </Field>
        ),
      },
      run: (values) => api.setProjectEnd(id, values.projectEndDate, values.comment),
      success: isRecruiter
        ? 'Project end date raised — waiting for approval.'
        : 'Project end date saved — the candidate is now Exited and the team has been emailed.',
    },

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
        fields: () => (
          <Alert
            tone="warning"
            title="The candidate left after joining"
            message="They are moved to Drop Outs / Back Outs and everyone in the loop is emailed. Give the reason below."
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
        validate: (values) => {
          if (!values.decision) return { decision: 'Choose Approve or Reject' }
          if (values.decision === currentOverride?.decision) return { decision: 'That is already the current decision' }
          return {}
        },
        fields: (form) => (
          <>
            {currentOverride ? (
              <Alert
                tone="warning"
                title={`Current decision: ${currentOverride.decision === 'APPROVED' ? 'Approved' : 'Rejected'}`}
                message={`Set by ${currentOverride.by ?? 'Super Admin'} on ${formatDateTime(currentOverride.at)}. The change is added to the approval trail; the earlier decision stays there too.`}
              />
            ) : (
              <Alert
                tone="error"
                title="This stops the approval workflow"
                message="It approves or rejects the candidate right away, at whatever stage it is in. You can change the decision later; every change is recorded in the approval trail."
              />
            )}
            <Field label={currentOverride ? 'New decision' : 'Decision'} required error={form.errors.decision}>
              <RadioGroup
                value={form.values.decision}
                onChange={(val) => form.set('decision', val)}
                options={[
                  { value: 'APPROVED', label: 'Approve' },
                  { value: 'REJECTED', label: 'Reject' },
                ]}
              />
            </Field>
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
  const toast = useToast()
  const [openActionKey, setOpenActionKey] = useState(null)

  const actions = getActions(user, candidate).filter((action) => action.allowed)
  const openAction = actions.find((action) => action.key === openActionKey)

  if (actions.length === 0) {
    return <p className="text-sm text-muted">No actions for you at this stage.</p>
  }

  async function handleSubmit(values) {
    await openAction.run(values)
    setOpenActionKey(null)
    toast.success(openAction.success)
    onChanged()
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.key}
            variant={action.danger ? 'danger-ghost' : action.type === 'primary' ? 'primary' : 'default'}
            icon={action.icon}
            onClick={() => setOpenActionKey(action.key)}
          >
            {action.label}
          </Button>
        ))}
      </div>

      {openAction && (
        <ActionModal
          title={openAction.modal.title}
          okText={openAction.modal.okText}
          danger={openAction.modal.danger}
          commentRequired={openAction.modal.commentRequired}
          hideComment={openAction.modal.hideComment}
          initialValues={openAction.modal.initialValues}
          validate={openAction.modal.validate}
          onCancel={() => setOpenActionKey(null)}
          onSubmit={handleSubmit}
        >
          {openAction.modal.fields}
        </ActionModal>
      )}
    </>
  )
}
