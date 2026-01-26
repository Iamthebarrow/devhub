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
