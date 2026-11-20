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
import Timeline from '../ui/Timeline.jsx'
import Badge from '../ui/Badge.jsx'
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
  DOJ_SET: { text: 'Approved the date of joining', icon: <CalendarOutlined />, color: '#16a34a' },
  DETAILS_EDITED: { text: 'Edited the details', icon: <EditOutlined />, color: '#d97706' },
  DROPPED_OUT: { text: 'Recorded a drop out / back out', icon: <CloseCircleFilled />, color: '#64748b' },
  RATES_CHANGED: { text: 'Changed the rates', icon: <EditOutlined />, color: '#d97706' },
  PROJECT_END_RAISED: { text: 'Raised the project end date', icon: <CalendarOutlined />, color: '#0891b2' },
  PROJECT_END_APPROVED: { text: 'Approved the project end date', icon: <CheckCircleFilled />, color: '#16a34a' },
  PROJECT_END_DECLINED: { text: 'Declined the project end date', icon: <CloseCircleFilled />, color: '#dc2626' },
  PROJECT_END_SET: { text: 'Set the project end date', icon: <CalendarOutlined />, color: '#0891b2' },
  OVERRIDE_APPROVED: { text: 'Admin override: APPROVED', icon: <SafetyCertificateFilled />, color: '#16a34a' },
  OVERRIDE_REJECTED: { text: 'Admin override: REJECTED', icon: <SafetyCertificateFilled />, color: '#dc2626' },
  COMMENT: { text: 'Commented', icon: <MessageOutlined />, color: '#94a3b8' },
}

// Splits an edit / rate-change comment ("Pay rate 80 → 90; Visa Status: H1B → GC. reason") into
// {label, oldValue, newValue} rows plus any leftover text, so the old value can be shown next to the new one.
function parseChanges(action, comment) {
  let changesText = comment
  let reason = ''
  if (action === 'RATES_CHANGED') {
    const at = comment.indexOf('. ')
    if (at > 0) {
      changesText = comment.slice(0, at)
      reason = comment.slice(at + 2)
    }
  }
  const rows = []
  const others = []
  for (const part of changesText.split('; ')) {
    const arrow = part.indexOf(' → ')
    if (arrow < 0) {
      others.push(part)
      continue
    }
    const left = part.slice(0, arrow)
    const colon = left.indexOf(': ')
    const space = left.search(/ \S+$/)
    const cut = colon >= 0 ? colon : space
    rows.push({
      label: cut >= 0 ? left.slice(0, cut) : '',
      oldValue: cut >= 0 ? left.slice(cut + (colon >= 0 ? 2 : 1)) : left,
      newValue: part.slice(arrow + 3),
    })
  }
  return { rows, others, reason }
}

// "Pay rate: 80 (old, struck through) → 90" for each changed field
function ChangeList({ action, comment }) {
  const { rows, others, reason } = parseChanges(action, comment)
  return (
    <div className="my-1.5 rounded-lg border border-amber-200 bg-warning-soft px-3 py-2 text-sm">
      {rows.map((r, i) => (
        <div key={i}>
          <span className="font-semibold text-ink">{r.label}: </span>
          <span className="text-muted line-through">{r.oldValue}</span> →{' '}
          <span className="font-semibold text-ink">{r.newValue}</span>
        </div>
      ))}
      {others.map((t, i) => (
        <div key={`o${i}`}>{t}</div>
      ))}
      {reason && <div className="mt-1 text-muted">Reason: {reason}</div>}
    </div>
  )
}

// The approval trail: who did what, at which stage, their comment, when, and who was emailed.
// Oldest at the top, newest at the bottom.
export default function ApprovalTimeline({ trail }) {
  const items = trail.map((entry) => {
    const action = ACTIONS[entry.action] ?? { text: entry.action, icon: null, color: '#4f46e5' }
    return {
      key: entry.id,
      color: action.color,
      icon: action.icon ? <span style={{ color: action.color }}>{action.icon}</span> : undefined,
      content: (
        <div className="pb-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{entry.actorName}</span>
            <Badge tone="neutral">{ROLE_LABELS[entry.actorRole] ?? entry.actorRole}</Badge>
          </div>
          <div className="mt-0.5 text-ink">
            {action.text}
            {entry.stage && <span className="text-muted"> · {STAGE_LABELS[entry.stage] ?? entry.stage} stage</span>}
          </div>
          {entry.comment && (entry.action === 'DETAILS_EDITED' || entry.action === 'RATES_CHANGED') && (
            <ChangeList action={entry.action} comment={entry.comment} />
          )}
          {entry.comment && entry.action !== 'DETAILS_EDITED' && entry.action !== 'RATES_CHANGED' && (
            <div className="my-1.5 rounded-lg border border-line bg-slate-50 px-3 py-2">{entry.comment}</div>
          )}
          {entry.emailsSentTo.length > 0 && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
              <MailOutlined /> Email sent to {entry.emailsSentTo.join(', ')}
            </div>
          )}
          <div className="mt-1 text-xs text-faint">{formatDateTime(entry.createdAt)}</div>
        </div>
      ),
    }
  })

  return <Timeline items={items} />
}

// Everyone who can open the candidate sees this: each edit / rate change, who made it, when, and old → new
export function ChangeHistory({ trail }) {
  const changes = trail.filter((e) => e.action === 'DETAILS_EDITED' || e.action === 'RATES_CHANGED')
  if (changes.length === 0) {
    return <p className="text-sm text-muted">No changes yet. Edits and rate changes will be listed here.</p>
  }
  return (
    <div className="space-y-3">
      {[...changes].reverse().map((entry) => (
        <div key={entry.id}>
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="font-semibold text-ink">{entry.action === 'RATES_CHANGED' ? 'Rates changed' : 'Details edited'}</span>
            <span className="text-muted">by</span>
            <span className="font-semibold text-ink">{entry.actorName}</span>
            <Badge tone="neutral">{ROLE_LABELS[entry.actorRole] ?? entry.actorRole}</Badge>
          </div>
          <div className="text-xs text-faint">{formatDateTime(entry.createdAt)}</div>
          {entry.comment && <ChangeList action={entry.action} comment={entry.comment} />}
        </div>
      ))}
    </div>
  )
}
