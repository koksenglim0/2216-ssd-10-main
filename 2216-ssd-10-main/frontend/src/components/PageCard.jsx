export default function PageCard({ title, eyebrow, children, action, className = '' }) {
  return (
    <article className={`min-w-0 rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5 ${className}`}>
      {(eyebrow || title || action) && (
        <div className="mb-4 flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0b2f5b]">{eyebrow}</p> : null}
            {title ? <h3 className="mt-2 font-display text-xl text-slate-900">{title}</h3> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </article>
  )
}
