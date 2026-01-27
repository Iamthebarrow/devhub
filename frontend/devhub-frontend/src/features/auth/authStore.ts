import { create } from 'zustand'
import type { User } from '../../api/types'

export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated'

interface AuthState {
  status: AuthStatus
  accessToken: string | null
  user: User | null
}

interface AuthActions {
  setAuthenticated: (accessToken: string, user: User) => void
  setUnauthenticated: () => void
  setAccessToken: (accessToken: string) => void
  clearAuth: () => void
}

type AuthStore = AuthState & AuthActions

const initialState: AuthState = {
  status: 'unknown',
  accessToken: null,
  user: null,
}

export const useAuthStore = create<AuthStore>()((set) => ({
  ...initialState,

  setAuthenticated: (accessToken, user) =>
    set({
      status: 'authenticated',
      accessToken,
      user,
    }),

  setUnauthenticated: () =>
    set({
      status: 'unauthenticated',
      accessToken: null,
      user: null,
    }),

  setAccessToken: (accessToken) =>
    set({
      accessToken,
    }),

  clearAuth: () =>
    set({
      status: 'unauthenticated',
      accessToken: null,
      user: null,
    }),
}))

// Selectors for convenience
export const selectAuthStatus = (state: AuthStore) => state.status
export const selectAccessToken = (state: AuthStore) => state.accessToken
export const selectUser = (state: AuthStore) => state.user
export const selectIsAuthenticated = (state: AuthStore) => state.status === 'authenticated'
export const selectUserRoles = (state: AuthStore) => state.user?.roles ?? []

// =============================================================================
// Role-based Access Helpers (Phase 4)
// =============================================================================

// Roles that can perform container lifecycle actions (start/stop/restart)
const OPERATOR_ROLES = ['operator', 'admin']

/**
 * Check if user has permission to operate containers (start/stop/restart).
 * Returns true if user has 'operator' or 'admin' role.
 */
export const selectCanOperateContainers = (state: AuthStore): boolean => {
  const roles = state.user?.roles ?? []
  return roles.some((role) => OPERATOR_ROLES.includes(role.toLowerCase()))
}

/**
 * Hook to check if current user can operate containers.
 * Convenience hook wrapping the selector.
 */
export function useCanOperateContainers(): boolean {
  return useAuthStore(selectCanOperateContainers)
}

// =============================================================================
// Role-based Access Helpers (Phase 5)
// =============================================================================

/**
 * Check if user has permission to pull images.
 * Returns true if user has 'operator' or 'admin' role.
 */
export const selectCanPullImages = (state: AuthStore): boolean => {
  const roles = state.user?.roles ?? []
  return roles.some((role) => OPERATOR_ROLES.includes(role.toLowerCase()))
}

/**
 * Hook to check if current user can pull images.
 */
export function useCanPullImages(): boolean {
  return useAuthStore(selectCanPullImages)
}

/**
 * Check if user is admin.
 * Returns true if user has 'admin' role.
 * Used for admin-only features like removing images.
 */
export const selectIsAdmin = (state: AuthStore): boolean => {
  const roles = state.user?.roles ?? []
  return roles.some((role) => role.toLowerCase() === 'admin')
}

/**
 * Hook to check if current user is admin.
 */
export function useIsAdmin(): boolean {
  return useAuthStore(selectIsAdmin)
}

/**
 * Check if user can view audit logs.
 * Returns true if user has 'operator' or 'admin' role.
 */
export const selectCanViewAudit = (state: AuthStore): boolean => {
  const roles = state.user?.roles ?? []
  return roles.some((role) => OPERATOR_ROLES.includes(role.toLowerCase()))
}

/**
 * Hook to check if current user can view audit logs.
 */
export function useCanViewAudit(): boolean {
  return useAuthStore(selectCanViewAudit)
}
