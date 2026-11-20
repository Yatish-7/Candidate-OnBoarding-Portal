import { cn } from './cn.js'

// Label / value pairs in a responsive grid: one column on phones, two on wider
// screens. An item with `span: 'filled'` takes the whole row (e.g. job description).
export default function DescriptionList({ items, className }) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2', className)}>
      {items.map((item, i) => {
        const value = item.children
        const shown = value === null || value === undefined || value === '' ? '—' : value
        return (
          <div
            key={item.label ?? i}
            className={cn(
              'flex flex-col gap-0.5 border-b border-line/70 pb-2.5 last:border-0 sm:[&:nth-last-child(2)]:border-0',
              item.span === 'filled' && 'sm:col-span-2',
            )}
          >
            <dt className="text-xs font-medium uppercase tracking-wide text-faint">{item.label}</dt>
            <dd className="text-sm text-ink break-words">{shown}</dd>
          </div>
        )
      })}
    </dl>
  )
}
