/**
 * API types placeholder.
 * Phase 1: Empty file with structure comments.
 * Future phases will add types matching backend schema.
 */

// =============================================================================
// Auth Types (Phase 2)
// =============================================================================

export interface User {
  id: number
  username: string
  email: string
  roles: string[]
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  access: string
  user: User
}

export interface RefreshResponse {
  access: string
}

// =============================================================================
// Docker Types (Phase 3+)
// =============================================================================

// Placeholder - to be expanded based on backend API schema
export interface Container {
  id: string
  name: string
  image: string
  status: string
  state: string
  created: string
}

export interface Image {
  id: string
  name: string
  tag: string
  size: number
  created: string
}

export interface Volume {
  name: string
  driver: string
  mountpoint: string
  created: string
}

export interface Network {
  id: string
  name: string
  driver: string
  scope: string
}

// =============================================================================
// Audit Types (Phase 4+)
// =============================================================================

export interface AuditEvent {
  id: number
  timestamp: string
  user: string
  action: string
  resource: string
  status: 'success' | 'failed'
  details?: Record<string, unknown>
}

// =============================================================================
// API Error Types
// =============================================================================

export interface ApiError {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}
