// Maps the colour names used in status.js (originally Ant Design tag colours) to
// hex values our Tailwind Badge can render. Keeps status.js unchanged.
const TAG_COLORS = {
  default: '#64748b',
  blue: '#2563eb',
  geekblue: '#4f46e5',
  purple: '#7c3aed',
  volcano: '#ea580c',
  cyan: '#0891b2',
  green: '#16a34a',
  magenta: '#c026d3',
  red: '#dc2626',
  gold: '#d97706',
  orange: '#ea580c',
}

export function tagColor(name) {
  return TAG_COLORS[name] ?? TAG_COLORS.default
}
