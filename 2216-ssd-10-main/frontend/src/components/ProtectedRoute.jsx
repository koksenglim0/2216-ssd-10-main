import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export default function ProtectedRoute({ roles }) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#eef2f7] text-slate-600">
        Checking your secure session...
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/sign-in" replace state={{ from: location }} />
  }

  if (roles?.length && !roles.includes(auth.user?.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
