import { Tag, Timeline, Typography } from 'antd'
import {
  CalendarOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  EditOutlined,
  MailOutlined,
  MessageOutlined,
  SafetyCertificateFilled,
  SendOutlined,
} from '@ant-design/icons'
import { formatDateTime } from '../utils/format.js'
import { ROLE_LABELS } from '../utils/roles.js'
import { STAGE_LABELS } from '../utils/status.js'

// What each trail "action" means in plain words, and the icon + color of its dot
const ACTIONS = {
  SUBMITTED: { text: 'Submitted the candidate', icon: <SendOutlined />, color: '#4f46e5' },
  EDITED: { text: 'Edited the details', icon: <EditOutlined />, color: '#64748b' },
  RESUBMITTED: { text: 'Edited and resubmitted for review', icon: <SendOutlined />, color: '#4f46e5' },
  APPROVED: { text: 'Approved', icon: <CheckCircleFilled />, color: '#16a34a' },
  DECLINED: { text: 'Declined', icon: <CloseCircleFilled />, color: '#dc2626' },
  DOJ_SET: { text: 'Set the date of joining', icon: <CalendarOutlined />, color: '#16a34a' },
  DETAILS_EDITED: { text: 'Edited the details', icon: <EditOutlined />, color: '#d97706' },
  RATES_CHANGED: { text: 'Changed the rates', icon: <EditOutlined />, color: '#d97706' },
  PROJECT_END_RAISED: { text: 'Raised the project end date', icon: <CalendarOutlined />, color: '#0891b2' },
  PROJECT_END_APPROVED: { text: 'Approved the project end date', icon: <CheckCircleFilled />, color: '#16a34a' },
  PROJECT_END_DECLINED: { text: 'Declined the project end date', icon: <CloseCircleFilled />, color: '#dc2626' },
  PROJECT_END_SET: { text: 'Set the project end date', icon: <CalendarOutlined />, color: '#0891b2' },
  OVERRIDE_APPROVED: { text: 'Admin override: APPROVED', icon: <SafetyCertificateFilled />, color: '#16a34a' },
  OVERRIDE_REJECTED: { text: 'Admin override: REJECTED', icon: <SafetyCertificateFilled />, color: '#dc2626' },
  COMMENT: { text: 'Commented', icon: <MessageOutlined />, color: '#94a3b8' },
}

// The approval trail: who did what, at which stage, their comment, when, and who was emailed.
// Oldest at the top, newest at the bottom.
export default function ApprovalTimeline({ trail }) {
  const items = trail.map((entry) => {
    const action = ACTIONS[entry.action] ?? { text: entry.action, icon: null, color: '#4f46e5' }

    return {
      key: entry.id,
      icon: <span style={{ color: action.color, fontSize: 16 }}>{action.icon}</span>,
      content: (
        <div style={{ paddingBottom: 4 }}>
          <div>
            <Typography.Text strong>{entry.actorName}</Typography.Text>{' '}
            <Tag variant="filled">{ROLE_LABELS[entry.actorRole] ?? entry.actorRole}</Tag>
          </div>
          <div style={{ marginTop: 2 }}>
            {action.text}
            {entry.stage && (
              <Typography.Text type="secondary"> · {STAGE_LABELS[entry.stage] ?? entry.stage} stage</Typography.Text>
            )}
          </div>
          {entry.comment && (
            <div
              style={{
                margin: '6px 0',
                padding: '8px 12px',
                background: '#f8fafc',
                border: '1px solid #e8ecf3',
                borderRadius: 8,
              }}
            >
              {entry.comment}
            </div>
          )}
          {entry.emailsSentTo.length > 0 && (
            <div style={{ fontSize: 12, color: '#64748b' }}>
              <MailOutlined /> Email sent to {entry.emailsSentTo.join(', ')}
            </div>
          )}
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{formatDateTime(entry.createdAt)}</div>
        </div>
      ),
    }
  })

  return <Timeline items={items} />
}
