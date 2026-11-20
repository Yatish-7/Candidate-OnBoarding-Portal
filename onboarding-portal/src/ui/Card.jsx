import { cn } from './cn.js'

// A white panel with a soft shadow. Optional `title` / `extra` header row and
// `hover` lift for clickable cards.
export default function Card({ title, extra, children, className, bodyClassName, hover = false, ...rest }) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-line bg-white shadow-[var(--shadow-card)] transition-all duration-300',
        'hover:border-brand/15 hover:shadow-[var(--shadow-lift)]',
        hover && 'hover:-translate-y-0.5',
        className,
      )}
      {...rest}
    >
      {(title || extra) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          {typeof title === 'string' ? (
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <span className="h-4 w-1 rounded-full bg-gradient-to-b from-brand to-accent" />
              {title}
            </h2>
          ) : (
            title
          )}
          {extra}
        </div>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  )
}
