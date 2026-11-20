// The title row at the top of a page: big title, a short line under it, and buttons on the right.
export default function PageHeader({ title, subtitle, extra }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="hidden h-10 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-brand to-accent sm:block" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {extra}
    </div>
  )
}
