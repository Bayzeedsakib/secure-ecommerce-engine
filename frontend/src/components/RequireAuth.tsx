import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/auth-context'
import type { Role } from '../types'

// Sends visitors to the login page and returns them here afterwards.
export function RequireAuth({ children, role }: { children: ReactNode; role?: Role }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (role && user.role !== role) {
    return (
      <div className="empty-state">
        <h1>Not allowed</h1>
        <p>You do not have permission to view this page.</p>
      </div>
    )
  }

  return children
}
