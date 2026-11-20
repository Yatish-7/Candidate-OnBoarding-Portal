import { cn } from './cn.js'

// A small status pill. `tone` picks the colour, or pass `color` for a custom hex
// (used by the status tags, which carry their own colour).
const TONES = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-soft text-brand ring-brand/20',
  success: 'bg-success-soft text-success ring-success/20',
  warning: 'bg-warning-soft text-warning ring-warning/20',
  danger: 'bg-danger-soft text-danger ring-danger/20',
  purple: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200',
}

export default function Badge({ tone = 'neutral', color, children, className }) {
  const style = color
    ? { backgroundColor: `${color}1a`, color, boxShadow: `inset 0 0 0 1px ${color}33` }
    : undefined
  return (
    <span
      style={style}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        !color && 'ring-1 ring-inset',
        !color && TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
