import { cn } from './cn.js'

// A lightweight CSS tooltip: wraps its child and shows `title` on hover/focus.
// Good enough for the small hints we need (e.g. the exact time behind "2 days ago").
export default function Tooltip({ title, children, className }) {
  if (!title) return children
  return (
    <span className={cn('group relative inline-flex', className)} tabIndex={0}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
      >
        {title}
      </span>
    </span>
  )
}
