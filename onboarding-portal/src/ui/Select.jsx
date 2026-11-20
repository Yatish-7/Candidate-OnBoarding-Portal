import { cn } from './cn.js'
import { controlBase } from './Input.jsx'

// A styled wrapper around the native <select>: reliable, accessible and great on
// phones (the OS shows its own picker). `options` is [{ value, label, disabled }].
// Values keep their original type (numbers, booleans) through onChange; clearing
// sends `undefined` when `allowClear` is set.
export default function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Select',
  allowClear = false,
  disabled,
  invalid,
  size = 'md',
  className,
  id,
}) {
  const height = size === 'lg' ? 'h-12 text-base' : size === 'sm' ? 'h-8 text-sm' : 'h-10 text-sm'
  const current = value === undefined || value === null ? '' : String(value)

  function handleChange(e) {
    const raw = e.target.value
    if (raw === '') {
      onChange?.(undefined)
      return
    }
    const match = options.find((o) => String(o.value) === raw)
    onChange?.(match ? match.value : raw)
  }

  return (
    <div className={cn('relative', className)}>
      <select
        id={id}
        value={current}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          controlBase,
          invalid ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-line',
          'cursor-pointer appearance-none pl-3 pr-9',
          current === '' && 'text-faint',
          height,
        )}
      >
        <option value="" disabled={!allowClear}>
          {placeholder}
        </option>
        {allowClear && current !== '' && <option value="">— Clear —</option>}
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)} disabled={o.disabled} className="text-ink">
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-faint"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// A segmented set of options shown as buttons (replaces antd's Radio.Group).
export function RadioGroup({ value, onChange, options = [], disabled }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-slate-50 p-1">
      {options.map((o) => {
        const active = String(o.value) === String(value)
        return (
          <button
            key={String(o.value)}
            type="button"
            disabled={disabled}
            onClick={() => onChange?.(o.value)}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-white text-brand shadow-sm' : 'text-muted hover:text-ink',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
