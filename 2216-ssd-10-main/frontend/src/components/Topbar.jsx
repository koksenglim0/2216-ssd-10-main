export default function Topbar({
  title,
  subtitle,
  searchPlaceholder = 'Search transactions, recipients...',
  rightSlot = null,
  collapsed = false,
  onToggleSidebar,
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-4 xl:flex-row xl:items-center">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="grid h-11 min-w-16 shrink-0 place-items-center rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-900/5 transition hover:bg-slate-50"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? 'Menu' : 'Hide'}
          </button>

          <div className="min-w-[10rem]">
            <h2 className="font-display text-2xl font-semibold text-slate-950">{title}</h2>
            {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
          </div>
        </div>

        <label className="w-full max-w-xl">
          <span className="sr-only">Search</span>
          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2.5 shadow-sm shadow-slate-900/5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Search</span>
            <input
              type="search"
              placeholder={searchPlaceholder}
              className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
        </label>
      </div>

      <div className="flex items-center justify-between gap-4 lg:justify-end">
        <div className="hidden items-center gap-3 pr-4 text-slate-500 lg:flex">
          <button type="button" className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-xs font-semibold shadow-sm shadow-slate-900/5">2FA</button>
        </div>

        {rightSlot}
      </div>
    </header>
  )
}
