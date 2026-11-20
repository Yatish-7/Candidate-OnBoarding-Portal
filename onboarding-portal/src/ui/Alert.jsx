import { cn } from './cn.js'
import { CheckCircleFilled, CloseCircleFilled, InfoCircleFilled, WarningFilled } from '@ant-design/icons'

// A coloured message box for in-page notices (not the toast).
const TONES = {
  info: { wrap: 'bg-brand-soft border-brand/20 text-ink', icon: 'text-brand', Icon: InfoCircleFilled },
  success: { wrap: 'bg-success-soft border-success/20 text-ink', icon: 'text-success', Icon: CheckCircleFilled },
  warning: { wrap: 'bg-warning-soft border-warning/20 text-ink', icon: 'text-warning', Icon: WarningFilled },
  error: { wrap: 'bg-danger-soft border-danger/20 text-ink', icon: 'text-danger', Icon: CloseCircleFilled },
}

export default function Alert({ tone = 'info', title, message, action, className }) {
  const { wrap, icon, Icon } = TONES[tone] ?? TONES.info
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', wrap, className)}>
      <Icon className={cn('mt-0.5 shrink-0 text-base', icon)} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {message && <div className={cn('text-sm', title ? 'mt-0.5 text-muted' : '')}>{message}</div>}
      </div>
      {action}
    </div>
  )
}
