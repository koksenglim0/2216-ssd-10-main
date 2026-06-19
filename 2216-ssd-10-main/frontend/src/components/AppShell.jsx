import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppShell({ title, subtitle, searchPlaceholder }) {
  const location = useLocation()
  const { user, logout } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 64em)')

    const syncSidebar = () => {
      setSidebarCollapsed(!mediaQuery.matches)
    }

    syncSidebar()
    mediaQuery.addEventListener('change', syncSidebar)

    return () => mediaQuery.removeEventListener('change', syncSidebar)
  }, [])

  const routeTitleMap = {
    '/dashboard': 'Dashboard',
    '/send-money': 'Send Money',
    '/exchange': 'Exchange',
    '/history': 'History',
    '/add-funds': 'Add Funds',
    '/transfer-success': 'Transfer Success',
    '/admin': 'Admin Portal',
  }

  const routeSubtitleMap = {
    '/dashboard': 'Multi-currency overview',
    '/send-money': 'Review and route your transfer',
    '/exchange': 'Swap currencies instantly',
    '/history': 'View and manage your activity',
    '/add-funds': 'Load funds into your wallet',
    '/transfer-success': 'Transaction receipt',
    '/admin': 'Platform oversight and controls',
  }

  return (
    <div className={[
      'min-h-screen overflow-x-hidden bg-[#eef2f7] transition-[grid-template-columns] duration-300 ease-out',
      sidebarCollapsed ? 'grid grid-cols-[6rem_minmax(0,1fr)]' : 'grid grid-cols-[16rem_minmax(0,1fr)]',
    ].join(' ')}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} />
      <main className="flex min-w-0 max-w-full flex-col gap-6 overflow-hidden p-4 sm:p-6 lg:p-8">
        <Topbar
          title={routeTitleMap[location.pathname] ?? title}
          subtitle={routeSubtitleMap[location.pathname] ?? subtitle}
          searchPlaceholder={searchPlaceholder}
          collapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
          rightSlot={
            user ? (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm shadow-slate-900/5">
                <div className="text-right leading-tight">
                  <p className="text-sm font-semibold text-slate-900">{user.fullName}</p>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{user.role} / {user.primaryCurrency}</p>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Sign out
                </button>
              </div>
            ) : null
          }
        />
        <Outlet />
      </main>
    </div>
  )
}
