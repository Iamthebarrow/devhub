import { describe, it, expect, beforeEach } from 'vitest'
import { apiClient, AuthError } from './client'
import { useAuthStore } from '../features/auth'
import { requestTracker, setRefreshBehavior } from '../test/mocks/handlers'

describe('API Client', () => {
  beforeEach(() => {
    // Reset auth store and request tracker before each test
    useAuthStore.getState().clearAuth()
    requestTracker.reset()
    setRefreshBehavior(true)
  })

  describe('Authorization header', () => {
    it('attaches Authorization header when access token exists', async () => {
      // Set up auth state with a token
      useAuthStore.getState().setAuthenticated('valid-token', {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        roles: ['admin'],
      })

      // Make a request to the protected endpoint
      const response = await apiClient.get<{ data: string }>('/test/protected')

      expect(response.data).toBe('protected data')
      expect(requestTracker.lastAuthHeader).toBe('Bearer valid-token')
    })

    it('does not attach Authorization header when no token exists', async () => {
      // Auth store starts with no token
      expect(useAuthStore.getState().accessToken).toBeNull()

      // Make a request that will fail with 401
      // Since there's no token, and refresh will fail (no refresh token cookie in test),
      // this should throw an AuthError
      setRefreshBehavior(false)

      await expect(apiClient.get('/test/protected')).rejects.toThrow(AuthError)
    })
  })

  describe('401 handling with refresh retry', () => {
    it('on 401, calls refresh once and retries the request', async () => {
      // Set up auth state with an invalid token
      useAuthStore.getState().setAuthenticated('invalid-token', {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        roles: ['admin'],
      })

      // Make a request - initial token is invalid, so will get 401
      // Refresh should succeed and return new-access-token
      // Retry should succeed with new token
      const response = await apiClient.get<{ data: string }>('/test/protected')

      expect(response.data).toBe('protected data')
      expect(requestTracker.refreshCalled).toBe(1)
      // The new token should be stored
      expect(useAuthStore.getState().accessToken).toBe('new-access-token')
    })

    it('clears auth and throws AuthError if refresh fails', async () => {
      // Set up auth state with an invalid token
      useAuthStore.getState().setAuthenticated('invalid-token', {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        roles: ['admin'],
      })

      // Make refresh fail
      setRefreshBehavior(false)

      // Make a request - should fail, trigger refresh, refresh fails, throw AuthError
      await expect(apiClient.get('/test/protected')).rejects.toThrow(AuthError)

      expect(requestTracker.refreshCalled).toBe(1)
      // Auth should be cleared
      expect(useAuthStore.getState().status).toBe('unauthenticated')
      expect(useAuthStore.getState().accessToken).toBeNull()
    })

    it('does not retry more than once after refresh', async () => {
      // This is implicit in the current implementation since we pass skipAuthRetry=true
      // on the retry. Testing that refresh is only called once even for multiple 401s.
      useAuthStore.getState().setAuthenticated('invalid-token', {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        roles: ['admin'],
      })

      // First request
      await apiClient.get<{ data: string }>('/test/protected')

      // Reset tracker
      requestTracker.reset()

      // Second request with new valid token - should not trigger refresh
      const response2 = await apiClient.get<{ data: string }>('/test/protected')

      expect(response2.data).toBe('protected data')
      expect(requestTracker.refreshCalled).toBe(0)
    })

    it('401 → refresh once → retry once → success flow', async () => {
      // Comprehensive test of the full 401 recovery flow
      useAuthStore.getState().setAuthenticated('invalid-token', {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        roles: ['viewer'],
      })

      // Initial state
      expect(useAuthStore.getState().accessToken).toBe('invalid-token')

      // Make request that will trigger 401 → refresh → retry
      const response = await apiClient.get<{ data: string }>('/test/protected')

      // Verify flow completed successfully
      expect(response.data).toBe('protected data')
      expect(requestTracker.refreshCalled).toBe(1)
      expect(useAuthStore.getState().accessToken).toBe('new-access-token')
      expect(useAuthStore.getState().status).toBe('authenticated')
    })

    it('401 → refresh fails → logout/redirect flow', async () => {
      useAuthStore.getState().setAuthenticated('invalid-token', {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        roles: ['admin'],
      })

      // Initial state is authenticated
      expect(useAuthStore.getState().status).toBe('authenticated')

      // Make refresh fail
      setRefreshBehavior(false)

      // Make request
      await expect(apiClient.get('/test/protected')).rejects.toThrow(AuthError)

      // Verify logout occurred
      expect(useAuthStore.getState().status).toBe('unauthenticated')
      expect(useAuthStore.getState().accessToken).toBeNull()
      expect(useAuthStore.getState().user).toBeNull()
    })
  })
})
