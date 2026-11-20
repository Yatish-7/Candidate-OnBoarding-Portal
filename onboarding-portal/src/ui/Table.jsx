import { cn } from './cn.js'
import { CenterSpinner } from './Spinner.jsx'

// A clean data table. `columns` is [{ title, key, dataIndex, render, className, align }].
// `render(value, row)` customises a cell; otherwise row[dataIndex] is shown.
// On narrow screens the table scrolls sideways instead of squashing.
export default function Table({
  columns,
  data = [],
  rowKey = 'id',
  loading = false,
  onRowClick,
  empty = 'Nothing to show.',
  className,
}) {
  const keyOf = (row, i) => (typeof rowKey === 'function' ? rowKey(row) : (row[rowKey] ?? i))

  return (
    <div className={cn('overflow-x-auto rounded-xl border border-line', className)}>
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-slate-50 text-left">
            {columns.map((col) => (
              <th
                key={col.key ?? col.dataIndex}
                className={cn(
                  'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                  col.headerClassName,
                )}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length}>
                <CenterSpinner />
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-muted">
                {empty}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={keyOf(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-line last:border-0 transition-colors',
                  onRowClick ? 'cursor-pointer hover:bg-brand-soft' : 'hover:bg-slate-50/60',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key ?? col.dataIndex}
                    className={cn(
                      'px-4 py-3 align-middle text-ink',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.className,
                    )}
                  >
                    {col.render ? col.render(row[col.dataIndex], row) : row[col.dataIndex]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// Page controls for a table. `total` items, `pageSize` per page, `current` is 0-based.
export function Pagination({ current, pageSize, total, onChange, pageSizeOptions = [10, 20, 50], label = 'items' }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const from = current * pageSize + 1
  const to = Math.min(total, (current + 1) * pageSize)
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <span>
        {from}–{to} of {total} {label}
      </span>
      <div className="flex items-center gap-2">
        {onChange && pageSizeOptions && (
          <select
            value={pageSize}
            onChange={(e) => onChange(0, Number(e.target.value))}
            className="h-8 rounded-lg border border-line bg-white px-2 text-sm text-ink outline-none focus:border-brand"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={current === 0}
            onClick={() => onChange(current - 1, pageSize)}
            className="h-8 rounded-lg border border-line bg-white px-3 text-ink transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-2 tabular-nums">
            {current + 1} / {pages}
          </span>
          <button
            type="button"
            disabled={current + 1 >= pages}
            onClick={() => onChange(current + 1, pageSize)}
            className="h-8 rounded-lg border border-line bg-white px-3 text-ink transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
