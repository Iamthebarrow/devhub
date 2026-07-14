/**
 * Audit API module (Phase 2: Industry-standard MVP).
 *
 * DEFAULT DECISION: Endpoint is GET /api/v1/audit/events/
 * If backend returns 404, the UI shows a friendly "Audit not available" message.
 */

import { apiClient, ApiRequestError } from './client'
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
 * List audit events with pagination and filters.
 * GET /api/v1/audit/events/?action=&status=&actor=&from=&to=&search=&page=&page_size=
 *
 * Throws AuditApiError on validation failure.
 * Throws ApiRequestError on HTTP errors (including 404).
 * Caller should check error.status === 404 to show "not available" UI.
 */
export async function listAuditEvents(params?: AuditEventsParams): Promise<AuditEventsResponse> {
  const searchParams = new URLSearchParams()

  if (params?.action) searchParams.set('action', params.action)
  if (params?.status) searchParams.set('status', params.status)
  if (params?.actor) searchParams.set('actor', params.actor)
  if (params?.from) searchParams.set('from', params.from)
  if (params?.to) searchParams.set('to', params.to)
  if (params?.search) searchParams.set('search', params.search)
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.page_size) searchParams.set('page_size', String(params.page_size))

  const queryString = searchParams.toString()
  const endpoint = `/audit/events/${queryString ? `?${queryString}` : ''}`

  const data = await apiClient.get<unknown>(endpoint)

  const result = AuditEventsResponseSchema.safeParse(data)
  if (!result.success) {
    console.error('[Audit API] Invalid audit events response:', result.error)
    throw new AuditApiError('Invalid audit events response from server', 500, 'INVALID_RESPONSE')
  }

  return result.data as AuditEventsResponse
}
