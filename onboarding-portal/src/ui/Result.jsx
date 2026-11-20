import { CloseCircleFilled, LockFilled, QuestionCircleFilled, WarningFilled } from '@ant-design/icons'
import { cn } from './cn.js'

// A centered "something to tell you" block: 403, 404, an error, or empty state.
const STATUS = {
  403: { Icon: LockFilled, color: 'text-warning' },
  404: { Icon: QuestionCircleFilled, color: 'text-brand' },
  500: { Icon: CloseCircleFilled, color: 'text-danger' },
  error: { Icon: WarningFilled, color: 'text-danger' },
  warning: { Icon: WarningFilled, color: 'text-warning' },
}

export default function Result({ status = 'info', title, subTitle, extra, icon, className }) {
  const { Icon, color } = STATUS[status] ?? { Icon: QuestionCircleFilled, color: 'text-brand' }
  return (
    <div className={cn('grid place-items-center px-4 py-16 text-center', className)}>
      <div className="max-w-md">
        <div className={cn('mb-4 text-5xl', color)}>{icon ?? <Icon />}</div>
        {title && <h2 className="text-xl font-semibold text-ink">{title}</h2>}
        {subTitle && <p className="mt-2 text-muted">{subTitle}</p>}
        {extra && <div className="mt-6 flex flex-wrap justify-center gap-2">{extra}</div>}
      </div>
    </div>
  )
}
