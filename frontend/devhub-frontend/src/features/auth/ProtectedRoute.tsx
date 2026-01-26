import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * Route wrapper that requires authentication.
 *
 * Redirects to /login if not authenticated.
 * Preserves the intended destination in location state for post-login redirect.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()

  if (status === 'unauthenticated') {
    // Redirect to login, preserving intended destination
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Status is 'authenticated' (AuthBootstrap handles 'unknown')
  return <>{children}</>
}
