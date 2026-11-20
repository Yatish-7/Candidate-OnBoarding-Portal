import { cn } from './cn.js'

// A round avatar with initials. `size` in px.
export default function Avatar({ initials, background, color, size = 36, className }) {
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center rounded-full font-semibold', className)}
      style={{ background, color, width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials}
    </span>
  )
}
