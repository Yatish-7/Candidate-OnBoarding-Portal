import { cn } from '../ui/cn.js'

// A crisp atom mark drawn to match the Intellectt brand.
export function AtomMark({ className, style }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <circle cx="12" cy="12" r="2.1" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.4" opacity="0.95">
        <ellipse cx="12" cy="12" rx="9.5" ry="4" />
        <ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(120 12 12)" />
      </g>
    </svg>
  )
}

// The gradient atom badge used in the sidebar and on the public pages.
export function BrandBadge({ size = 44, className }) {
  return (
    <span
      style={{ width: size, height: size }}
      className={cn(
        'grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand to-accent shadow-[var(--shadow-brand)] ring-1 ring-white/20',
        className,
      )}
    >
      <AtomMark className="text-white" style={{ width: size * 0.55, height: size * 0.55 }} />
    </span>
  )
}
