import { cn } from './cn.js'

// Label + control + hint/error, the way a form row should look.
// Wrap any input: <Field label="Email" required error={errors.email}><Input .../></Field>
export default function Field({ label, required, hint, error, htmlFor, className, children }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}
