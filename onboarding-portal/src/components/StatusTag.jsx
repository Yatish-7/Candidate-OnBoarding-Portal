import { Tag } from 'antd'
import { getStatusKey, STATUSES } from '../utils/status.js'

// Colored tag with the candidate's overall status, e.g. "In HR / Contracts review"
export default function StatusTag({ candidate }) {
  const status = STATUSES[getStatusKey(candidate)]
  return <Tag color={status.color}>{status.label}</Tag>
}
