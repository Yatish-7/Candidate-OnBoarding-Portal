import { Avatar } from 'antd'

// Soft background + strong text color pairs for avatars
const COLORS = [
  ['#eef2ff', '#4338ca'],
  ['#ecfdf5', '#047857'],
  ['#fff7ed', '#c2410c'],
  ['#fdf2f8', '#be185d'],
  ['#f0f9ff', '#0369a1'],
  ['#f5f3ff', '#6d28d9'],
  ['#fefce8', '#a16207'],
]

// "Meera Iyer" → "MI"
function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

// The same name always gets the same color
function getColors(name = '') {
  const sum = [...name].reduce((total, char) => total + char.charCodeAt(0), 0)
  return COLORS[sum % COLORS.length]
}

// A round avatar with someone's initials, e.g. in the candidate table and the header
export default function NameAvatar({ name, size = 'default' }) {
  const [background, color] = getColors(name)
  return (
    <Avatar size={size} style={{ background, color, fontWeight: 600, flexShrink: 0 }}>
      {getInitials(name)}
    </Avatar>
  )
}
