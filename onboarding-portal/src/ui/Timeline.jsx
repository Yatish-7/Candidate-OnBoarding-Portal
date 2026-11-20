import { cn } from './cn.js'

// A vertical timeline. `items` is [{ key, icon, color, content }]. Oldest first.
export default function Timeline({ items, className }) {
  return (
    <ul className={cn('relative space-y-5', className)}>
      {items.map((item, i) => (
        <li key={item.key ?? i} className="relative flex gap-3">
          {/* the connecting line, drawn behind every dot except the last */}
          {i !== items.length - 1 && (
            <span className="absolute left-[11px] top-6 h-[calc(100%+4px)] w-px bg-line" aria-hidden="true" />
          )}
          <span
            className="z-[1] mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white text-sm ring-4 ring-white"
            style={{ color: item.color }}
          >
            {item.icon ?? <span className="size-2.5 rounded-full" style={{ background: item.color }} />}
          </span>
          <div className="min-w-0 flex-1 pb-1">{item.content}</div>
        </li>
      ))}
    </ul>
  )
}
