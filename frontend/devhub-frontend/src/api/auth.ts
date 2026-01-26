/**
 * Auth API module.
 *
 * Handles authentication endpoints:
 * - login: POST /auth/login/
 * - refresh: POST /auth/refresh/ (with credentials)
 * - logout: POST /auth/logout/ (with credentials)
 * - me: GET /auth/me/
 */

import { API_BASE_URL } from './client'
import { LoginResponseSchema, RefreshResponseSchema, MeResponseSchema } from './zod'
import type { LoginRequest, LoginResponse, RefreshResponse, User } from './types'

export class AuthApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
    this.code = code
  }
}

/**
 * Login with username and password.
 * Returns access token and user info.
 * Refresh token is set as HttpOnly cookie by backend.
 */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Receive and store HttpOnly refresh cookie
    body: JSON.stringify(credentials),
  })

  if (!response.ok) {
    let message = 'Login failed'
    let code: string | undefined

    try {
      const data = await response.json()
      if (data.error?.message) {
        message = data.error.message
        code = data.error.code
      } else if (data.detail) {
        message = data.detail
      }
    } catch {
      // Use default message
    }

    throw new AuthApiError(message, response.status, code)
  }

  const data = await response.json()

  // Validate response shape with Zod
  const result = LoginResponseSchema.safeParse(data)
  if (!result.success) {
    console.error('[Auth] Invalid login response shape:', result.error)
    throw new AuthApiError('Invalid login response from server', 500, 'INVALID_RESPONSE')
  }

  return result.data
}

/**
 * Refresh access token using HttpOnly refresh cookie.
 * Returns new access token.
 */
export async function refresh(): Promise<RefreshResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Send HttpOnly refresh cookie
  })

  if (!response.ok) {
    let message = 'Token refresh failed'
    let code: string | undefined

    try {
      const data = await response.json()
      if (data.error?.message) {
        message = data.error.message
        code = data.error.code
      } else if (data.detail) {
        message = data.detail
      }
    } catch {
      // Use default message
    }

    throw new AuthApiError(message, response.status, code)
  }

  const data = await response.json()

  // Validate response shape with Zod
  const result = RefreshResponseSchema.safeParse(data)
  if (!result.success) {
    console.error('[Auth] Invalid refresh response shape:', result.error)
    throw new AuthApiError('Invalid refresh response from server', 500, 'INVALID_RESPONSE')
  }

  return result.data
}

/**
 * Logout - clears refresh token cookie.
 */
export async function logout(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/logout/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Send HttpOnly refresh cookie
  })

  // Ignore errors on logout - we're clearing local state anyway
  if (!response.ok && import.meta.env.DEV) {
    console.warn('[Auth] Logout request failed, but clearing local state anyway')
  }
}

/**
 * Get current user info.
 * Requires Authorization header (handled by API client).
 */
export async function me(accessToken: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/me/`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    let message = 'Failed to get user info'
    let code: string | undefined

    try {
      const data = await response.json()
      if (data.error?.message) {
        message = data.error.message
        code = data.error.code
      } else if (data.detail) {
        message = data.detail
      }
    } catch {
      // Use default message
    }

    throw new AuthApiError(message, response.status, code)
  }

  const data = await response.json()

  // Validate response shape with Zod
  const result = MeResponseSchema.safeParse(data)
  if (!result.success) {
    console.error('[Auth] Invalid me response shape:', result.error)
    throw new AuthApiError('Invalid user response from server', 500, 'INVALID_RESPONSE')
  }

  return result.data
}
