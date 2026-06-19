import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { mainNav, utilityNav } from '../data/sitwalletData'

function linkClass({ isActive }, collapsed) {
  return [
    'group flex items-center gap-3 rounded-xl py-3 text-left transition',
    collapsed ? 'justify-center px-3' : 'px-4',
    isActive
      ? 'bg-[#0b2f5b] text-white shadow-lg shadow-[#0b2f5b]/15'
      : 'text-slate-700 hover:bg-slate-900/5 hover:text-slate-950',
  ].join(' ')
}

export default function Sidebar({ collapsed = false, onToggle }) {
  const { user } = useAuth()
  const visibleUtilityNav = utilityNav.filter((item) => !item.roles || item.roles.includes(user?.role))

  return (
    <aside className={[
      'sticky top-0 flex h-screen shrink-0 flex-col gap-6 overflow-y-auto border-r border-slate-200 bg-[#f4f6fa] py-6 transition-[width] duration-300 ease-out',
      collapsed ? 'w-24 px-2' : 'w-64 px-4',
    ].join(' ')}>
      <div className={collapsed ? 'flex flex-col items-center gap-3' : 'flex items-center gap-3 px-1'}>
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#0b2f5b] text-sm font-semibold text-white shadow-sm shadow-slate-900/10">SW</div>
        {!collapsed ? (
          <div>
            <h1 className="font-display text-xl tracking-tight text-slate-950">SITWallet</h1>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Secure Multi-Currency</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onToggle}
          className="mt-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '>>' : '<<'}
        </button>
      </div>

      <nav className="grid gap-2">
        {mainNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={collapsed ? item.label : undefined}
            aria-label={item.label}
            className={(state) => linkClass(state, collapsed)}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/70 text-sm font-semibold text-[#0b2f5b] transition group-hover:bg-white">
              {item.icon}
            </span>
            {!collapsed ? <span className="truncate text-sm font-medium">{item.label}</span> : null}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto grid gap-2">
        {visibleUtilityNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={collapsed ? item.label : undefined}
            aria-label={item.label}
            className={({ isActive }) => [
              'flex items-center gap-3 rounded-xl border border-slate-200 bg-white py-3 text-sm text-slate-700 transition hover:bg-slate-50',
              collapsed ? 'justify-center px-3' : 'px-4',
              isActive ? 'ring-2 ring-[#0b2f5b]/10' : '',
            ].join(' ')}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-700">
              {item.icon}
            </span>
            {!collapsed ? <span className="truncate">{item.label}</span> : null}
          </NavLink>
        ))}
      </div>
    </aside>
  )
}
