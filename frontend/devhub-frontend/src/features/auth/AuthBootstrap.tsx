import { useEffect } from 'react'
import { useAuthStore } from './authStore'
import { refresh, me } from '../../api/auth'

/**
 * Auth bootstrap component.
 *
 * On mount:
 * 1. Attempt to refresh access token (uses HttpOnly cookie)
 * 2. If refresh succeeds, fetch user info with /auth/me/
 * 3. Set auth state accordingly
 *
 * Renders children only after boot is complete (status !== 'unknown')
 */
export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const { status, setAuthenticated, setUnauthenticated } = useAuthStore()

  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        // Step 1: Attempt refresh to get access token
        const refreshResponse = await refresh()

        if (cancelled) return

        // Step 2: Fetch user info
        const user = await me(refreshResponse.access)

        if (cancelled) return

        // Step 3: Set authenticated state
        setAuthenticated(refreshResponse.access, user)
      } catch (error) {
        if (cancelled) return

        // Refresh or me failed - user is not authenticated
        if (import.meta.env.DEV) {
          console.debug('[Auth] Boot failed, setting unauthenticated:', error)
        }
        setUnauthenticated()
      }
    }

    boot()

    return () => {
      cancelled = true
    }
  }, [setAuthenticated, setUnauthenticated])

  // Show loading screen while auth status is unknown
  if (status === 'unknown') {
    return <AuthLoadingScreen />
  }

  return <>{children}</>
}

function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  )
}
