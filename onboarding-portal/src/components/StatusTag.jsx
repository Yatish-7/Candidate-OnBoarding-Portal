import Badge from '../ui/Badge.jsx'
import { getStatusKey, STATUSES } from '../utils/status.js'
import { tagColor } from '../utils/colors.js'

// Colored pill with the candidate's overall status, e.g. "In HR / Contracts review"
export default function StatusTag({ candidate }) {
  const status = STATUSES[getStatusKey(candidate)]
  return <Badge color={tagColor(status.color)}>{status.label}</Badge>
}
