import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { PageShell } from '../components/layout/PageShell'
import {
  Search,
  RefreshCw,
  AlertCircle,
  FileText,
  Construction,
  ShieldAlert,
  Copy,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuditEvents, isAudit404 } from '../features/audit'
import { useCanViewAudit } from '../features/auth'
import { AuditEventDrawer, getActorName } from './AuditEventDrawer'
import type { AuditEvent, AuditEventsParams } from '../api/types'

// =============================================================================
// Constants
// =============================================================================

/** DEFAULT: page size for audit events list. */
const PAGE_SIZE = 25

/** DEFAULT: debounce delay for text inputs (ms). */
const DEBOUNCE_MS = 300

// =============================================================================
// Helpers
// =============================================================================

/** Format ISO timestamp to short relative + absolute tooltip. */
function formatRelativeTime(iso: string): string {
  try {
    const date = new Date(iso)
    const now = Date.now()
    const diff = (now - date.getTime()) / 1000

    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

function formatExactTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}

/** Shorten a request-id for display. */
function shortenRequestId(id: string): string {
  if (id.length <= 12) return id
  return id.slice(0, 12) + '\u2026'
}

/** Copy text to clipboard with toast. */
async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`Copied ${label}`)
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      toast.success(`Copied ${label}`)
    } catch {
      toast.error('Failed to copy')
    }
  }
}

// =============================================================================
// Sub-components
// =============================================================================

/** Not Authorized page state for viewer role. */
function NotAuthorized() {
  return (
    <PageShell title="Audit" description="Track actions and system events.">
      <div className="rounded-lg bg-white p-12 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <ShieldAlert className="h-8 w-8 text-red-600" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">Not Authorized</h3>
        <p className="mt-2 text-sm text-gray-500">
          You do not have permission to view audit logs. Contact an administrator for access.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to Dashboard
        </Link>
      </div>
    </PageShell>
  )
}

/** Friendly state when audit endpoint returns 404. */
function AuditNotAvailable() {
  return (
    <div className="rounded-lg bg-white p-12 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <Construction className="h-8 w-8 text-amber-600" />
      </div>
      <h3 className="text-lg font-medium text-gray-900">Audit is not available on this server yet.</h3>
      <p className="mt-2 text-sm text-gray-500">
        Ask an admin to enable the audit endpoint.
      </p>
    </div>
  )
}

/** Status badge for success / error. */
function StatusBadge({ status }: { status: AuditEvent['status'] }) {
  const isSuccess = status === 'success'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {isSuccess ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {status}
    </span>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function AuditPage() {
  const canView = useCanViewAudit()

  // --- Filter state ---
  const [statusFilter, setStatusFilter] = useState('')
  const [actionInput, setActionInput] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)

  // Debounced values for text inputs
  const [debouncedAction, setDebouncedAction] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedAction(actionInput), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [actionInput])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [searchInput])

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setPage(1)
  }, [statusFilter, debouncedAction, debouncedSearch, fromDate, toDate])

  // --- Build query params ---
  const params: AuditEventsParams = {
    page,
    page_size: PAGE_SIZE,
  }
  if (statusFilter) params.status = statusFilter
  if (debouncedAction) params.action = debouncedAction
  if (debouncedSearch) params.search = debouncedSearch
  if (fromDate) params.from = fromDate
  if (toDate) params.to = toDate

  // --- Query (skip when user cannot view) ---
  const { data, isLoading, isError, error, refetch, isFetching } = useAuditEvents(
    canView ? params : undefined
  )

  const events = data?.results ?? []
  const totalCount = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const is404 = isError && isAudit404(error)

  // --- Drawer state ---
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null)

  // --- Clear all filters ---
  const clearFilters = useCallback(() => {
    setStatusFilter('')
    setActionInput('')
    setSearchInput('')
    setFromDate('')
    setToDate('')
    setPage(1)
  }, [])

  const hasActiveFilters = statusFilter || actionInput || searchInput || fromDate || toDate

  // --- Role check ---
  if (!canView) {
    return <NotAuthorized />
  }

  // --- Render ---
  const actions = (
    <button
      onClick={() => refetch()}
      disabled={isFetching}
      className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      title="Refresh"
      aria-label={isFetching ? 'Refreshing...' : 'Refresh'}
    >
      <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
      Refresh
    </button>
  )

  return (
    <PageShell title="Audit" description="Track actions and system events." actions={actions}>
      {/* Filters */}
      <div className="mb-6 space-y-4">
        {/* Row 1: search + action + status */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search events..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Action filter */}
          <input
            type="text"
            value={actionInput}
            onChange={(e) => setActionInput(e.target.value)}
            placeholder="Filter by action..."
            className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:w-48"
          />

          {/* Status dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            aria-label="Status filter"
          >
            <option value="">All Statuses</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
        </div>

        {/* Row 2: date range + clear */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <label htmlFor="audit-from" className="whitespace-nowrap text-sm text-gray-600">
              From
            </label>
            <input
              id="audit-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="audit-to" className="whitespace-nowrap text-sm text-gray-600">
              To
            </label>
            <input
              id="audit-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              Clear filters
            </button>
          )}
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

      {/* 404 — endpoint not found */}
      {is404 && <AuditNotAvailable />}

      {/* Other errors */}
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
      {!isLoading && !isError && events.length === 0 && (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {hasActiveFilters ? 'No events match your filters' : 'No audit events found'}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {hasActiveFilters
              ? 'Try adjusting your search or filters'
              : 'No activity has been recorded yet'}
          </p>
        </div>
      )}

      {/* Events table */}
      {!isLoading && !isError && events.length > 0 && (
        <>
          {/* Result count */}
          <div className="mb-2 text-sm text-gray-500">
            {totalCount} result{totalCount !== 1 ? 's' : ''}
            {totalPages > 1 && ` \u2014 page ${page} of ${totalPages}`}
          </div>

          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Resource
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Actor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Request ID
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {events.map((event) => (
                    <tr
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-1 text-sm text-gray-600" title={formatExactTime(event.created_at)}>
                          <Clock className="h-4 w-4 text-gray-400" />
                          {formatRelativeTime(event.created_at)}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <StatusBadge status={event.status} />
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-sm text-gray-700">
                          {event.action}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        <span className="text-gray-400">{event.resource_type}</span>
                        {(event.resource_name || event.resource_id) && (
                          <>
                            {' / '}
                            <span className="font-medium text-gray-900">
                              {event.resource_name || event.resource_id.slice(0, 12)}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {getActorName(event.actor)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {event.request_id ? (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-sm text-gray-500">
                              {shortenRequestId(event.request_id)}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                copyText(event.request_id!, 'request ID')
                              }}
                              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                              title="Copy request ID"
                              aria-label="Copy request ID"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">{'\u2014'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail drawer */}
      <AuditEventDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </PageShell>
  )
}
