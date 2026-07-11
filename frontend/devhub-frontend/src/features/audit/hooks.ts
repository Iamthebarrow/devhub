/**
 * Audit query hooks using TanStack Query (Phase 2 — Industry-standard MVP).
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { listAuditEvents } from '../../api/audit'
import { ApiRequestError } from '../../api/client'
import type { AuditEventsParams } from '../../api/types'

// =============================================================================
// Query Keys
// =============================================================================

export const auditKeys = {
  all: ['audit'] as const,
  events: () => [...auditKeys.all, 'events'] as const,
  eventsList: (params?: AuditEventsParams) => [...auditKeys.events(), 'list', params ?? {}] as const,
}

// =============================================================================
// Helpers
// =============================================================================

/** Check if an error represents a 404 (endpoint not found). */
export function isAudit404(error: unknown): boolean {
  if (error instanceof ApiRequestError) {
    return error.status === 404
  }
  if (error instanceof Error) {
    return error.message.includes('404') || error.message.includes('Not Found')
  }
  return false
}

// =============================================================================
// Audit Hooks
// =============================================================================

/**
 * Hook to fetch a paginated list of audit events.
 *
 * - Uses keepPreviousData so the table doesn't flash empty on page change.
 * - Never retries on 404 (endpoint may not exist).
 * - Retries once on other errors.
 */
export function useAuditEvents(params?: AuditEventsParams) {
  return useQuery({
    queryKey: auditKeys.eventsList(params),
    queryFn: () => listAuditEvents(params),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => {
      if (isAudit404(error)) return false
      return failureCount < 1
    },
  })
}
