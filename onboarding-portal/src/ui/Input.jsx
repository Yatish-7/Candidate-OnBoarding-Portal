import { forwardRef, useState } from 'react'
import { EyeInvisibleOutlined, EyeOutlined, LockOutlined } from '@ant-design/icons'
import { cn } from './cn.js'

// Shared look for text inputs, selects and textareas.
export const controlBase =
  'w-full rounded-xl border bg-white text-ink placeholder:text-faint transition-colors ' +
  'outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 ' +
  'disabled:bg-slate-50 disabled:text-faint disabled:cursor-not-allowed'

function stateBorder(invalid) {
  return invalid ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-line'
}

// A text input. `prefix`/`suffix` render a small adornment inside the field.
export const Input = forwardRef(function Input(
  { invalid, className, prefix, suffix, size = 'md', ...rest },
  ref,
) {
  const height = size === 'lg' ? 'h-12 text-base' : size === 'sm' ? 'h-8 text-sm' : 'h-10 text-sm'
  if (prefix || suffix) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border bg-white px-3 transition-colors',
          'focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20',
          stateBorder(invalid),
          height,
          className,
        )}
      >
        {prefix && <span className="shrink-0 text-faint">{prefix}</span>}
        <input
          ref={ref}
          className="min-w-0 flex-1 bg-transparent text-ink placeholder:text-faint outline-none"
          {...rest}
        />
        {suffix && <span className="shrink-0 text-faint">{suffix}</span>}
      </div>
    )
  }
  return (
    <input
      ref={ref}
      className={cn(controlBase, stateBorder(invalid), 'px-3', height, className)}
      {...rest}
    />
  )
})

// A password box with a show/hide toggle and a lock icon.
export const PasswordInput = forwardRef(function PasswordInput({ invalid, className, size = 'md', ...rest }, ref) {
  const [show, setShow] = useState(false)
  const height = size === 'lg' ? 'h-12 text-base' : size === 'sm' ? 'h-8 text-sm' : 'h-10 text-sm'
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border bg-white px-3 transition-colors',
        'focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20',
        invalid ? 'border-danger focus-within:border-danger focus-within:ring-danger/20' : 'border-line',
        height,
        className,
      )}
    >
      <LockOutlined className="shrink-0 text-faint" />
      <input
        ref={ref}
        type={show ? 'text' : 'password'}
        className="min-w-0 flex-1 bg-transparent text-ink placeholder:text-faint outline-none"
        {...rest}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="shrink-0 text-faint transition-colors hover:text-ink"
        aria-label={show ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {show ? <EyeOutlined /> : <EyeInvisibleOutlined />}
      </button>
    </div>
  )
})

export const Textarea = forwardRef(function Textarea({ invalid, className, rows = 4, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(controlBase, stateBorder(invalid), 'px-3 py-2 text-sm leading-relaxed', className)}
      {...rest}
    />
  )
})
