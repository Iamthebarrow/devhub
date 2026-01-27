/**
 * Audit query hooks using TanStack Query (Phase 5).
 */

import { useQuery } from '@tanstack/react-query'
import { listAuditEvents } from '../../api/audit'
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
// Audit Hooks
// =============================================================================

/**
 * Hook to fetch audit events list.
 * Used in AuditPage.
 *
 * DEFAULT DECISION: If endpoint 404s, error will be caught and handled
 * by the component to show "Audit coming soon" message.
 */
export function useAuditEvents(params?: AuditEventsParams) {
  return useQuery({
    queryKey: auditKeys.eventsList(params),
    queryFn: () => listAuditEvents(params),
    staleTime: 30_000, // 30 seconds
    retry: (failureCount, error) => {
      // Don't retry on 404 - endpoint might not exist
      if (error instanceof Error && error.message.includes('404')) {
        return false
      }
      return failureCount < 1
    },
  })
}
