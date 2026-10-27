import { Space, Steps, Tag } from 'antd'
import { formatDate } from '../utils/format.js'
import { WORKFLOW } from '../utils/status.js'

// How each stage status looks as a small tag
const STAGE_TAGS = {
  NOT_STARTED: { label: 'Not started', color: 'default' },
  PENDING: { label: 'Pending', color: 'gold' },
  APPROVED: { label: 'Approved', color: 'green' },
  DECLINED: { label: 'Declined', color: 'red' },
  SET: { label: 'Set', color: 'green' },
}

// antd Steps colors each step by a "status": wait (grey), process (blue), finish (green), error (red)
const STEP_STATUS = {
  NOT_STARTED: 'wait',
  PENDING: 'process',
  APPROVED: 'finish',
  SET: 'finish',
  DECLINED: 'error',
}

// Shows the whole workflow, one step after another:
// Sales Lead → HR → Contracts → Payroll → Accounts → Super Admin → Date of Joining
export default function StageProgress({ candidate }) {
  const { stages, dojDate } = candidate

  const items = WORKFLOW.map((step) => {
    const value = stages[step.key]
    const tag = STAGE_TAGS[value]
    return {
      title: step.label,
      status: STEP_STATUS[value],
      content: (
        <Space orientation="vertical" size={2}>
          <Tag color={tag.color}>{tag.label}</Tag>
          {step.key === 'doj' && dojDate && <span>{formatDate(dojDate)}</span>}
        </Space>
      ),
    }
  })

  // titlePlacement="vertical" puts each title under its icon, so 7 steps fit side by side.
  // On narrow screens antd stacks them vertically by itself.
  return <Steps size="small" titlePlacement="vertical" items={items} />
}
