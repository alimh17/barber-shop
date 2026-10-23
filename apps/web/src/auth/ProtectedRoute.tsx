import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth-context'
import type { UserRole } from './types'
export function ProtectedRoute({ allowedRoles, children }: { allowedRoles: UserRole[]; children?: ReactNode }) {
  const { session, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <div className="page-loader"><span className="spinner" /><p>در حال بازیابی نشست…</p></div>
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  if (!allowedRoles.includes(session.user.role)) {
    return location.pathname === '/dashboard'
      ? <main className="not-found"><strong>۴۰۳</strong><h1>دسترسی به این بخش مجاز نیست</h1></main>
      : <Navigate to="/dashboard" replace />
  }
  return children ?? <Outlet />
}
