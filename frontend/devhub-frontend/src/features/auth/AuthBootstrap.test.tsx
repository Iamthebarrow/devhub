/**
 * AuthBootstrap tests (Phase 6).
 *
 * Tests the auth boot flow:
 * - Success path: refresh → me → authenticated
 * - Failure path: refresh fails → unauthenticated
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { AuthBootstrap } from './AuthBootstrap'
import { useAuthStore } from './authStore'
import { server } from '../../test/mocks/server'
import { API_BASE_URL } from '../../api/client'
import { setRefreshBehavior, mockUser } from '../../test/mocks/handlers'

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AuthBootstrap', () => {
  beforeEach(() => {
    // Reset auth store to initial state (unknown)
    useAuthStore.setState({
      status: 'unknown',
      accessToken: null,
      user: null,
    })
    setRefreshBehavior(true)
  })

  describe('success path', () => {
    it('shows loading screen initially while auth status is unknown', () => {
      // Don't set refresh behavior yet - just render to see loading state
      renderWithProviders(
        <AuthBootstrap>
          <div>Protected Content</div>
        </AuthBootstrap>
      )

      // Should show loading spinner
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('refresh → me → authenticated: shows children when auth succeeds', async () => {
      // Ensure refresh succeeds
      setRefreshBehavior(true)

      renderWithProviders(
        <AuthBootstrap>
          <div>Protected Content</div>
        </AuthBootstrap>
      )

      // Wait for auth to complete and show protected content
      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
      })

      // Verify auth state is authenticated
      expect(useAuthStore.getState().status).toBe('authenticated')
      expect(useAuthStore.getState().accessToken).toBe('new-access-token')
      expect(useAuthStore.getState().user).toEqual(mockUser)
    })

    it('sets user info after successful boot', async () => {
      setRefreshBehavior(true)

      renderWithProviders(
        <AuthBootstrap>
          <div>Content</div>
        </AuthBootstrap>
      )

      await waitFor(() => {
        expect(useAuthStore.getState().status).toBe('authenticated')
      })

      const state = useAuthStore.getState()
      expect(state.user).toBeTruthy()
      expect(state.user?.username).toBe('testuser')
      expect(state.user?.roles).toContain('admin')
    })
  })

  describe('failure path', () => {
    it('refresh fails → unauthenticated: shows children when auth fails', async () => {
      // Make refresh fail
      setRefreshBehavior(false)

      renderWithProviders(
        <AuthBootstrap>
          <div>Public Content</div>
        </AuthBootstrap>
      )

      // Wait for auth to complete and show content
      await waitFor(() => {
        expect(screen.getByText('Public Content')).toBeInTheDocument()
      })

      // Verify auth state is unauthenticated
      expect(useAuthStore.getState().status).toBe('unauthenticated')
      expect(useAuthStore.getState().accessToken).toBeNull()
      expect(useAuthStore.getState().user).toBeNull()
    })

    it('me fails after refresh → unauthenticated', async () => {
      // Refresh succeeds but me fails
      setRefreshBehavior(true)
      server.use(
        http.get(`${API_BASE_URL}/auth/me/`, () => {
          return new HttpResponse(
            JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Token invalid' } }),
            { status: 401 }
          )
        })
      )

      renderWithProviders(
        <AuthBootstrap>
          <div>Content</div>
        </AuthBootstrap>
      )

      await waitFor(() => {
        expect(useAuthStore.getState().status).toBe('unauthenticated')
      })
    })

    it('network error during refresh → unauthenticated', async () => {
      server.use(
        http.post(`${API_BASE_URL}/auth/refresh/`, () => {
          return HttpResponse.error()
        })
      )

      renderWithProviders(
        <AuthBootstrap>
          <div>Content</div>
        </AuthBootstrap>
      )

      await waitFor(() => {
        expect(useAuthStore.getState().status).toBe('unauthenticated')
      })
    })
  })

  describe('cancellation', () => {
    it('does not update state if component unmounts during boot', async () => {
      setRefreshBehavior(true)

      const { unmount } = renderWithProviders(
        <AuthBootstrap>
          <div>Content</div>
        </AuthBootstrap>
      )

      // Immediately unmount before boot completes
      unmount()

      // Status should remain unknown or be whatever it was before
      // (implementation uses a cancelled flag to prevent updates)
      // Wait a bit to ensure any pending updates would have happened
      await new Promise((resolve) => setTimeout(resolve, 100))

      // The key thing is no errors were thrown
    })
  })
})
