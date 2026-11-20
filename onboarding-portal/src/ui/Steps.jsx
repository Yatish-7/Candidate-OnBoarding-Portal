import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { cn } from './cn.js'

// A workflow progress strip. `items` is [{ title, status, content }] where status
// is 'wait' | 'process' | 'finish' | 'error'. Shows as responsive chips so the whole
// chain reads on a phone as well as a wide screen.
const DOT = {
  wait: 'bg-slate-100 text-slate-400 ring-slate-200',
  process: 'bg-brand text-white ring-brand/30 shadow-[0_0_0_4px_rgba(37,99,235,0.12)]',
  finish: 'bg-success text-white ring-success/30',
  error: 'bg-danger text-white ring-danger/30',
}

export default function Steps({ items }) {
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      {items.map((item, i) => (
        <li
          key={item.title}
          className={cn(
            'flex flex-col items-start gap-2 rounded-xl border border-line bg-white/60 p-3',
            item.status === 'process' && 'border-brand/30 bg-brand-soft/40',
          )}
        >
          <div className="flex items-center gap-2">
            <span className={cn('grid size-6 place-items-center rounded-full text-xs font-semibold ring-4', DOT[item.status])}>
              {item.status === 'finish' ? (
                <CheckOutlined className="text-[10px]" />
              ) : item.status === 'error' ? (
                <CloseOutlined className="text-[10px]" />
              ) : (
                i + 1
              )}
            </span>
            <span className="text-sm font-medium text-ink">{item.title}</span>
          </div>
          {item.content && <div className="pl-8 text-xs text-muted">{item.content}</div>}
        </li>
      ))}
    </ol>
  )
}
