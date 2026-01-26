import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './authStore'

interface PublicRouteProps {
  children: React.ReactNode
}

/**
 * Route wrapper for public-only pages (like login).
 *
 * Redirects to / (or saved destination) if already authenticated.
 */
export function PublicRoute({ children }: PublicRouteProps) {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()

  if (status === 'authenticated') {
    // Redirect to home or saved destination
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'
    return <Navigate to={from} replace />
  }

  // Status is 'unauthenticated' (AuthBootstrap handles 'unknown')
  return <>{children}</>
}
