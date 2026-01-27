import { useState } from 'react'
import { PageShell } from '../components/layout/PageShell'
import { Search, User, Box, Clock, RefreshCw, AlertCircle, FileText, Construction } from 'lucide-react'
import { useAuditEvents, auditKeys } from '../features/audit'
import { useQueryClient } from '@tanstack/react-query'
import type { AuditEvent, AuditEventsParams } from '../api/types'

/**
 * Format ISO timestamp to readable format.
 */
function formatTimestamp(isoDate: string): string {
  try {
    const date = new Date(isoDate)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return isoDate
  }
}

/**
 * Check if error is a 404 (endpoint not found).
 */
function is404Error(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('404') || error.message.includes('Not Found')
  }
  return false
}

/**
 * Audit event row component.
 */
function AuditEventRow({ event }: { event: AuditEvent }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="whitespace-nowrap px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="h-4 w-4" />
          {formatTimestamp(event.timestamp)}
        </div>
      </td>
      <td className="whitespace-nowrap px-6 py-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400" />
          <span className="font-medium text-gray-900">{event.actor}</span>
        </div>
      </td>
      <td className="whitespace-nowrap px-6 py-4">
        <span className="rounded bg-gray-100 px-2 py-1 text-sm font-mono text-gray-700">
          {event.action}
        </span>
      </td>
      <td className="whitespace-nowrap px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Box className="h-4 w-4 text-gray-400" />
          {event.resource}
        </div>
      </td>
      <td className="whitespace-nowrap px-6 py-4">
        <span
          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
            event.status === 'success'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {event.status}
        </span>
      </td>
    </tr>
  )
}

/**
 * Audit coming soon component - shown when API returns 404.
 */
function AuditComingSoon() {
  return (
    <div className="rounded-lg bg-white p-12 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <Construction className="h-8 w-8 text-amber-600" />
      </div>
      <h3 className="text-lg font-medium text-gray-900">Audit Log Coming Soon</h3>
      <p className="mt-2 text-sm text-gray-500">
        The audit logging feature is not yet available. This feature will allow you to track system
        activity and user actions.
      </p>
      <p className="mt-4 text-xs text-gray-400">
        The backend endpoint for audit events has not been implemented yet.
      </p>
    </div>
  )
}

/**
 * Audit log page.
 * Phase 5: Full implementation with API wiring and 404 handling.
 *
 * DEFAULT DECISION: If endpoint returns 404, shows "Coming Soon" message
 * instead of an error, since the endpoint might not exist yet.
 */
export function AuditPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const queryClient = useQueryClient()

  // Build query params
  const params: AuditEventsParams = {}
  if (actionFilter) params.action = actionFilter
  if (statusFilter) params.status = statusFilter

  const { data, isLoading, isError, error, refetch } = useAuditEvents(params)

  const events = data?.results ?? []
  const is404 = isError && is404Error(error)

  // Filter events by search query (client-side filter for actor/resource)
  const filteredEvents = events.filter((event) => {
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    return (
      event.actor.toLowerCase().includes(search) ||
      event.action.toLowerCase().includes(search) ||
      event.resource.toLowerCase().includes(search)
    )
  })

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: auditKeys.all })
  }

  const actions = (
    <button
      onClick={handleRefresh}
      className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
    >
      <RefreshCw className="h-4 w-4" />
      Refresh
    </button>
  )

  return (
    <PageShell title="Audit Log" description="System activity history" actions={actions}>
      {/* Search and filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All Actions</option>
            <option value="container">Container</option>
            <option value="image">Image</option>
            <option value="auth">Auth</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All Statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="p-6">
            <div className="space-y-3">
              {[90, 75, 85, 70, 80].map((width, i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-gray-200" style={{ width: `${width}%` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 404 - Endpoint not found (show coming soon) */}
      {is404 && <AuditComingSoon />}

      {/* Other error state */}
      {isError && !is404 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <div>
              <h3 className="font-medium text-red-800">Failed to load audit events</h3>
              <p className="mt-1 text-sm text-red-600">
                {error instanceof Error ? error.message : 'An unknown error occurred'}
              </p>
              <button
                onClick={() => refetch()}
                className="mt-3 text-sm font-medium text-red-700 hover:text-red-800"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && filteredEvents.length === 0 && (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {searchQuery || actionFilter || statusFilter
              ? 'No events match your filters'
              : 'No audit events found'}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {searchQuery || actionFilter || statusFilter
              ? 'Try adjusting your search or filters'
              : 'No activity has been recorded yet'}
          </p>
        </div>
      )}

      {/* Audit events table */}
      {!isLoading && !isError && filteredEvents.length > 0 && (
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Resource
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEvents.map((event) => (
                  <AuditEventRow key={event.id} event={event} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageShell>
  )
}
