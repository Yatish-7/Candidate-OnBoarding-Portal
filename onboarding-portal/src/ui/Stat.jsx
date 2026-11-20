import { cn } from './cn.js'

// A single big number with a label (replaces antd's Statistic).
export default function Stat({ title, value, loading, className }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-sm text-muted">{title}</span>
      {loading ? (
        <span className="mt-1 h-8 w-16 animate-pulse rounded bg-slate-100" />
      ) : (
        <span className="text-3xl font-semibold tabular-nums text-ink">{value}</span>
      )}
    </div>
  )
}
