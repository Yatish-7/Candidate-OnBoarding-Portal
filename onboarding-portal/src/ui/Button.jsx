import { Link } from 'react-router-dom'
import { cn } from './cn.js'

// One button, many looks. Pass `variant`, `size`, `loading`, `icon`, `block`.
// Give it `to="/path"` to render a react-router link that looks like a button,
// or `href` for a normal anchor. Otherwise it's a <button>.

const VARIANTS = {
  primary:
    'bg-gradient-to-br from-brand to-accent text-white shadow-[0_6px_16px_-6px_rgba(37,99,235,0.5)] hover:shadow-[var(--shadow-brand)] hover:brightness-[1.06] active:brightness-95 disabled:opacity-60 disabled:shadow-none',
  default:
    'bg-white text-ink border border-line hover:border-brand hover:text-brand disabled:text-faint',
  danger:
    'bg-danger text-white hover:brightness-95 active:brightness-90 disabled:opacity-60',
  'danger-ghost':
    'bg-white text-danger border border-danger/30 hover:bg-danger-soft disabled:opacity-60',
  ghost:
    'bg-transparent text-ink border border-transparent hover:bg-black/5',
  text: 'bg-transparent text-muted hover:text-ink hover:bg-black/5 border border-transparent',
  link: 'bg-transparent text-brand hover:text-brand-hover border-0 px-0 shadow-none',
}

const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2 rounded-xl',
}

function Spinner() {
  return (
    <svg className="oi-spin size-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export default function Button({
  variant = 'default',
  size = 'md',
  loading = false,
  icon,
  block = false,
  className,
  children,
  to,
  href,
  type = 'button',
  disabled,
  ...rest
}) {
  const classes = cn(
    'inline-flex items-center justify-center font-medium whitespace-nowrap select-none',
    'transition-[transform,background,border-color,color,box-shadow] duration-150',
    'outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1',
    'disabled:cursor-not-allowed active:translate-y-0 active:scale-[0.98]',
    variant !== 'text' && variant !== 'link' && !disabled && !loading && 'hover:-translate-y-px',
    SIZES[size],
    VARIANTS[variant],
    block && 'w-full',
    className,
  )
  const content = (
    <>
      {loading ? <Spinner /> : icon}
      {children}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {content}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {content}
      </a>
    )
  }
  return (
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {content}
    </button>
  )
}
