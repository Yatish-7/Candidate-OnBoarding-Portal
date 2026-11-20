import { cn } from './cn.js'

// A spinning ring. `size` in px.
export default function Spinner({ size = 24, className }) {
  return (
    <svg
      className={cn('oi-spin text-brand', className)}
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// Centered spinner that fills the viewport — for the first auth check / page loads.
export function FullscreenSpinner({ tip }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-surface/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        <Spinner size={34} />
        {tip && <p className="text-sm text-muted">{tip}</p>}
      </div>
    </div>
  )
}

// A spinner centered in whatever space it's given (a card, a panel).
export function CenterSpinner({ tip, className }) {
  return (
    <div className={cn('grid place-items-center py-16', className)}>
      <div className="flex flex-col items-center gap-3">
        <Spinner size={30} />
        {tip && <p className="text-sm text-muted">{tip}</p>}
      </div>
    </div>
  )
}
