/**
 * API client with 401 handling and token refresh retry.
 *
 * Features:
 * - Base URL from VITE_API_BASE_URL
 * - Automatic Authorization header when token exists
 * - On 401: attempt refresh once → retry original request → if still 401, clear auth
 * - Single-flight refresh lock to prevent multiple simultaneous refreshes
 * - X-Request-ID logging in dev mode
 */

import { useAuthStore } from '../features/auth'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

// Track if a refresh is in progress (single-flight lock)
let refreshPromise: Promise<string | null> | null = null

export class AuthError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message)
    this.name = 'AuthError'
  }
}

export class ApiRequestError extends Error {
  status: number
  code?: string
  details?: Record<string, unknown>

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.details = details
  }
}

interface RequestOptions {
  method: string
  headers?: Record<string, string>
  body?: string
  credentials?: RequestCredentials
  signal?: AbortSignal // Phase 6: Support request cancellation
}

function logRequestId(response: Response): void {
  if (import.meta.env.DEV) {
    const requestId = response.headers.get('X-Request-ID')
    if (requestId) {
      console.debug(`[API] X-Request-ID: ${requestId}`)
    }
  }
}

async function parseErrorResponse(response: Response): Promise<{ message: string; code?: string; details?: Record<string, unknown> }> {
  try {
    const data = await response.json()
    if (data.error) {
      return {
        message: data.error.message || 'Request failed',
        code: data.error.code,
        details: data.error.details,
      }
    }
    // Handle non-standard error format
    if (data.detail) {
      return { message: data.detail }
    }
    return { message: 'Request failed' }
  } catch {
    return { message: `HTTP ${response.status}: ${response.statusText}` }
  }
}

/**
 * Attempt to refresh the access token.
 * Uses single-flight pattern to prevent multiple simultaneous refreshes.
 */
async function refreshAccessToken(): Promise<string | null> {
  // If already refreshing, wait for that result
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Send HttpOnly refresh cookie
      })

      logRequestId(response)

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      if (data.access) {
        useAuthStore.getState().setAccessToken(data.access)
        return data.access
      }
      return null
    } catch {
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

/**
 * Execute a fetch request with optional retry on 401.
 */
async function request<T>(
  endpoint: string,
  options: RequestOptions,
  skipAuthRetry: boolean = false
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`

  // Build headers with Authorization if token exists
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  const accessToken = useAuthStore.getState().accessToken
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const response = await fetch(url, {
    ...options,
    headers,
    signal: options.signal, // Phase 6: Pass abort signal for cancellation
  })

  logRequestId(response)

  // Handle 401 - attempt refresh and retry once
  if (response.status === 401 && !skipAuthRetry) {
    const newToken = await refreshAccessToken()

    if (newToken) {
      // Retry with new token
      return request<T>(endpoint, options, true)
    } else {
      // Refresh failed - clear auth and throw
      useAuthStore.getState().clearAuth()
      throw new AuthError()
    }
  }

  // Handle other errors
  if (!response.ok) {
    const { message, code, details } = await parseErrorResponse(response)
    throw new ApiRequestError(message, response.status, code, details)
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

/**
 * API client methods
 */
export const apiClient = {
  baseUrl: API_BASE_URL,

  /**
   * GET request
   * Phase 6: Supports abort signal for request cancellation
   */
  get: async <T>(endpoint: string, signal?: AbortSignal): Promise<T> => {
    return request<T>(endpoint, { method: 'GET', signal })
  },

  /**
   * POST request
   */
  post: async <T>(endpoint: string, data?: unknown): Promise<T> => {
    return request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  /**
   * PUT request
   */
  put: async <T>(endpoint: string, data?: unknown): Promise<T> => {
    return request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  /**
   * PATCH request
   */
  patch: async <T>(endpoint: string, data?: unknown): Promise<T> => {
    return request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  /**
   * DELETE request
   */
  delete: async <T>(endpoint: string): Promise<T> => {
    return request<T>(endpoint, { method: 'DELETE' })
  },

  /**
   * POST request with credentials (for refresh/logout)
   */
  postWithCredentials: async <T>(endpoint: string, data?: unknown): Promise<T> => {
    return request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'include',
    })
  },
}

export default apiClient
