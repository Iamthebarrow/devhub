/**
 * Audit API module (Phase 5).
 *
 * DEFAULT DECISION: Assumes endpoint exists at /api/v1/audit/events/
 * If backend returns 404, the UI will show a friendly "Audit coming soon" message.
 */

import { apiClient } from './client'
import { AuditEventsResponseSchema } from './zod'
import type { AuditEventsParams, AuditEventsResponse } from './types'

// =============================================================================
// Error Classes
// =============================================================================

export class AuditApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'AuditApiError'
    this.status = status
    this.code = code
  }
}

// =============================================================================
// Audit Endpoints
// =============================================================================

/**
 * List audit events.
 * GET /api/v1/audit/events/?action=&status=&actor=&from=&to=
 *
 * DEFAULT DECISION: If endpoint 404s, caller should handle gracefully.
 */
export async function listAuditEvents(params?: AuditEventsParams): Promise<AuditEventsResponse> {
  const searchParams = new URLSearchParams()

  if (params?.action) {
    searchParams.set('action', params.action)
  }
  if (params?.status) {
    searchParams.set('status', params.status)
  }
  if (params?.actor) {
    searchParams.set('actor', params.actor)
  }
  if (params?.from) {
    searchParams.set('from', params.from)
  }
  if (params?.to) {
    searchParams.set('to', params.to)
  }

  const queryString = searchParams.toString()
  // Note: Using different base path since audit is not under /docker/
  const endpoint = `/audit/events/${queryString ? `?${queryString}` : ''}`

  const data = await apiClient.get<unknown>(endpoint)

  const result = AuditEventsResponseSchema.safeParse(data)
  if (!result.success) {
    console.error('[Audit API] Invalid audit events response:', result.error)
    throw new AuditApiError('Invalid audit events response from server', 500, 'INVALID_RESPONSE')
  }

  return result.data as AuditEventsResponse
}
