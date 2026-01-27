import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'

describe('Auth Store', () => {
  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    roles: ['admin'],
  }

  beforeEach(() => {
    // Reset store to initial state before each test
    useAuthStore.setState({
      status: 'unknown',
      accessToken: null,
      user: null,
    })
  })

  describe('initial state', () => {
    it('starts with unknown status', () => {
      const state = useAuthStore.getState()
      expect(state.status).toBe('unknown')
      expect(state.accessToken).toBeNull()
      expect(state.user).toBeNull()
    })
  })

  describe('setAuthenticated', () => {
    it('transitions to authenticated state with token and user', () => {
      useAuthStore.getState().setAuthenticated('test-token', mockUser)

      const state = useAuthStore.getState()
      expect(state.status).toBe('authenticated')
      expect(state.accessToken).toBe('test-token')
      expect(state.user).toEqual(mockUser)
    })
  })

  describe('setUnauthenticated', () => {
    it('transitions to unauthenticated state and clears data', () => {
      // First set authenticated
      useAuthStore.getState().setAuthenticated('test-token', mockUser)

      // Then set unauthenticated
      useAuthStore.getState().setUnauthenticated()

      const state = useAuthStore.getState()
      expect(state.status).toBe('unauthenticated')
      expect(state.accessToken).toBeNull()
      expect(state.user).toBeNull()
    })
  })

  describe('setAccessToken', () => {
    it('updates only the access token', () => {
      // First set authenticated
      useAuthStore.getState().setAuthenticated('old-token', mockUser)

      // Update just the token
      useAuthStore.getState().setAccessToken('new-token')

      const state = useAuthStore.getState()
      expect(state.status).toBe('authenticated')
      expect(state.accessToken).toBe('new-token')
      expect(state.user).toEqual(mockUser) // User unchanged
    })
  })

  describe('clearAuth', () => {
    it('clears auth state and sets unauthenticated', () => {
      // First set authenticated
      useAuthStore.getState().setAuthenticated('test-token', mockUser)

      // Clear auth
      useAuthStore.getState().clearAuth()

      const state = useAuthStore.getState()
      expect(state.status).toBe('unauthenticated')
      expect(state.accessToken).toBeNull()
      expect(state.user).toBeNull()
    })
  })

  describe('state transitions', () => {
    it('unknown → authenticated on successful refresh + me', () => {
      // Simulating boot flow: starts unknown, then becomes authenticated
      expect(useAuthStore.getState().status).toBe('unknown')

      // After successful refresh and me call
      useAuthStore.getState().setAuthenticated('access-token', mockUser)

      expect(useAuthStore.getState().status).toBe('authenticated')
    })

    it('unknown → unauthenticated on failed refresh', () => {
      // Simulating boot flow: starts unknown, refresh fails
      expect(useAuthStore.getState().status).toBe('unknown')

      // After failed refresh
      useAuthStore.getState().setUnauthenticated()

      expect(useAuthStore.getState().status).toBe('unauthenticated')
    })

    it('authenticated → unauthenticated on logout', () => {
      // Start authenticated
      useAuthStore.getState().setAuthenticated('test-token', mockUser)
      expect(useAuthStore.getState().status).toBe('authenticated')

      // Logout
      useAuthStore.getState().clearAuth()

      expect(useAuthStore.getState().status).toBe('unauthenticated')
    })
  })
})
