import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
  Download,
  Settings2,
  Info,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuditEvents, isAudit404, useAuditFilterStore, DEFAULT_VISIBLE_COLUMNS } from '../features/audit'
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

/** DEFAULT: refresh relative timestamps every 60 seconds. */
const RELATIVE_TIME_REFRESH_MS = 60_000

// =============================================================================
// Quick Filter Chip Definitions (Phase 3 — A1)
// =============================================================================

/** Get YYYY-MM-DD string for N days ago. */
function getDateNDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

interface QuickFilterDef {
  key: string
  label: string
  /** Which URL param this chip controls. */
  param: string
  /** The value to set (or a function returning it). */
  value: string | (() => string)
  /** Check if currently active given the param's current value. */
  isActive: (currentValue: string) => boolean
}

/**
 * Quick filter chips.
 *
 * Behavior: each chip toggles a single URL param on/off.
 * Chips do NOT clear other filters when toggled.
 * "Containers" and "Auth events" both use the `action` param — mutually exclusive.
 * "Last 24h" and "Last 7 days" both use the `from` param — mutually exclusive.
 */
const QUICK_FILTERS: QuickFilterDef[] = [
  {
    key: 'errors',
    label: 'Errors only',
    param: 'status',
    value: 'error',
    isActive: (v) => v === 'error',
  },
  {
    key: 'last24h',
    label: 'Last 24h',
    param: 'from',
    value: () => getDateNDaysAgo(1),
    isActive: (v) => v === getDateNDaysAgo(1),
  },
  {
    key: 'last7d',
    label: 'Last 7 days',
    param: 'from',
    value: () => getDateNDaysAgo(7),
    isActive: (v) => v === getDateNDaysAgo(7),
  },
  {
    key: 'containers',
    label: 'Containers',
    param: 'action',
    value: 'container.',
    isActive: (v) => v === 'container.',
  },
  {
    key: 'auth',
    label: 'Auth events',
    param: 'action',
    value: 'auth.',
    isActive: (v) => v === 'auth.',
  },
]

// =============================================================================
// Column Definitions (Phase 3 — C8)
// =============================================================================

interface ColumnDef {
  key: string
  label: string
  alwaysVisible?: boolean
}

const COLUMN_DEFS: ColumnDef[] = [
  { key: 'time', label: 'Time', alwaysVisible: true },
  { key: 'status', label: 'Status', alwaysVisible: true },
  { key: 'action', label: 'Action', alwaysVisible: true },
  { key: 'resource', label: 'Resource', alwaysVisible: true },
  { key: 'actor', label: 'Actor', alwaysVisible: true },
  { key: 'requestId', label: 'Request ID' },
  { key: 'ipAddress', label: 'IP Address' },
  { key: 'userAgent', label: 'User Agent' },
]

const TOGGLEABLE_COLUMNS = COLUMN_DEFS.filter((c) => !c.alwaysVisible)

// =============================================================================
// Helpers
// =============================================================================

/** Format ISO timestamp to short relative time. */
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

/** Shorten an ID for display; copy still uses full value. */
function shortenId(id: string, maxLen = 12): string {
  if (id.length <= maxLen) return id
  return id.slice(0, maxLen) + '\u2026'
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
// CSV Export (Phase 3 — D10)
// =============================================================================

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

/**
 * Export currently loaded audit events as CSV (client-side, current page only).
 * Columns: created_at, status, action, resource_type, resource_id, resource_name, actor, request_id.
 * Does NOT include metadata or user_agent by default.
 */
export function exportAuditCsv(events: AuditEvent[]) {
  const headers = ['created_at', 'status', 'action', 'resource_type', 'resource_id', 'resource_name', 'actor', 'request_id']
  const rows = events.map((e) =>
    [
      e.created_at,
      e.status,
      e.action,
      e.resource_type,
      e.resource_id,
      e.resource_name || '',
      getActorName(e.actor),
      e.request_id || '',
    ]
      .map(escapeCsvField)
      .join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-events-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
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
  const [searchParams, setSearchParams] = useSearchParams()
  const filterStore = useAuditFilterStore()
  const initialized = useRef(false)

  // ---- Auto-refresh relative timestamps every 60s (Phase 3 — A2) ----
  const [, setTimeTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTimeTick((t) => t + 1), RELATIVE_TIME_REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  // ---- Column visibility (Phase 3 — C8) ----
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    () => filterStore.visibleColumns.length > 0 ? filterStore.visibleColumns : DEFAULT_VISIBLE_COLUMNS
  )
  const [columnMenuOpen, setColumnMenuOpen] = useState(false)
  const columnMenuRef = useRef<HTMLDivElement>(null)

  const toggleColumn = useCallback(
    (col: string) => {
      setVisibleColumns((prev) => {
        const next = prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
        filterStore.save({ visibleColumns: next })
        return next
      })
    },
    [filterStore]
  )

  // Close column menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setColumnMenuOpen(false)
      }
    }
    if (columnMenuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [columnMenuOpen])

  const isColumnVisible = useCallback(
    (key: string) => {
      const def = COLUMN_DEFS.find((c) => c.key === key)
      if (def?.alwaysVisible) return true
      return visibleColumns.includes(key)
    },
    [visibleColumns]
  )

  // ---- Read URL params — source of truth (Phase 3 — B5) ----
  const urlStatus = searchParams.get('status') || ''
  const urlAction = searchParams.get('action') || ''
  const urlSearch = searchParams.get('search') || ''
  const urlFrom = searchParams.get('from') || ''
  const urlTo = searchParams.get('to') || ''
  const urlPage = parseInt(searchParams.get('page') || '1', 10)
  const urlEventId = searchParams.get('event') || ''

  // ---- Restore from Zustand on first mount if URL is empty (Phase 3 — B6) ----
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const hasUrlFilters =
      searchParams.has('status') ||
      searchParams.has('action') ||
      searchParams.has('search') ||
      searchParams.has('from') ||
      searchParams.has('to') ||
      searchParams.has('page')

    if (!hasUrlFilters) {
      const s = filterStore
      const hasStoreFilters = s.status || s.action || s.search || s.from || s.to || s.page > 1
      if (hasStoreFilters) {
        const params = new URLSearchParams()
        if (s.status) params.set('status', s.status)
        if (s.action) params.set('action', s.action)
        if (s.search) params.set('search', s.search)
        if (s.from) params.set('from', s.from)
        if (s.to) params.set('to', s.to)
        if (s.page > 1) params.set('page', String(s.page))
        // Preserve event param
        const ev = searchParams.get('event')
        if (ev) params.set('event', ev)
        setSearchParams(params, { replace: true })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Text input local state (responsive typing with debounce) ----
  const [actionInput, setActionInput] = useState(urlAction)
  const [searchInput, setSearchInput] = useState(urlSearch)

  // Sync URL → local on browser back/forward
  useEffect(() => { setActionInput(urlAction) }, [urlAction])
  useEffect(() => { setSearchInput(urlSearch) }, [urlSearch])

  // Debounce action input → URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (actionInput !== urlAction) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            if (actionInput) next.set('action', actionInput)
            else next.delete('action')
            next.delete('page')
            return next
          },
          { replace: true }
        )
        filterStore.save({ action: actionInput, page: 1 })
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionInput])

  // Debounce search input → URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== urlSearch) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            if (searchInput) next.set('search', searchInput)
            else next.delete('search')
            next.delete('page')
            return next
          },
          { replace: true }
        )
        filterStore.save({ search: searchInput, page: 1 })
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  // ---- Generic filter setter (non-debounced inputs) ----
  const setFilter = useCallback(
    (updates: Record<string, string | number | null>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        let resetPage = false
        for (const [key, value] of Object.entries(updates)) {
          const shouldRemove =
            value === null || value === '' || (key === 'page' && (value === 1 || value === 0))
          if (shouldRemove) {
            next.delete(key)
          } else {
            next.set(key, String(value))
          }
          if (key !== 'page' && key !== 'event') resetPage = true
        }
        if (resetPage) next.delete('page')
        return next
      })
      // Sync to Zustand
      const storeUpdate: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(updates)) {
        if (['status', 'action', 'search', 'from', 'to', 'page'].includes(key)) {
          storeUpdate[key] = value ?? ''
        }
      }
      if (Object.keys(storeUpdate).length > 0) {
        filterStore.save(storeUpdate as Parameters<typeof filterStore.save>[0])
      }
      if (Object.keys(updates).some((k) => k !== 'page' && k !== 'event')) {
        filterStore.save({ page: 1 })
      }
    },
    [setSearchParams, filterStore]
  )

  const clearFilters = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams()
      const ev = prev.get('event')
      if (ev) next.set('event', ev)
      return next
    })
    setActionInput('')
    setSearchInput('')
    filterStore.reset()
  }, [setSearchParams, filterStore])

  const hasActiveFilters = urlStatus || urlAction || urlSearch || urlFrom || urlTo

  // ---- Quick filter chip toggle (Phase 3 — A1) ----
  const toggleChip = useCallback(
    (chip: QuickFilterDef) => {
      const currentValue = searchParams.get(chip.param) || ''
      const chipValue = typeof chip.value === 'function' ? chip.value() : chip.value

      if (chip.isActive(currentValue)) {
        setFilter({ [chip.param]: null })
        if (chip.param === 'action') setActionInput('')
      } else {
        setFilter({ [chip.param]: chipValue })
        if (chip.param === 'action') setActionInput(chipValue)
      }
    },
    [searchParams, setFilter]
  )

  // ---- Build query params ----
  const params: AuditEventsParams = {
    page: urlPage,
    page_size: PAGE_SIZE,
  }
  if (urlStatus) params.status = urlStatus
  if (urlAction) params.action = urlAction
  if (urlSearch) params.search = urlSearch
  if (urlFrom) params.from = urlFrom
  if (urlTo) params.to = urlTo

  // ---- Query (skip when user cannot view) ----
  const { data, isLoading, isError, error, refetch, isFetching } = useAuditEvents(
    canView ? params : undefined
  )

  const events = data?.results ?? []
  const totalCount = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const is404 = isError && isAudit404(error)

  // ---- Drawer state ----
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null)

  // ---- Deep-link to event via ?event=<id> (Phase 3 — B7) ----
  const [eventNotOnPage, setEventNotOnPage] = useState(false)
  const deepLinkProcessed = useRef(false)

  useEffect(() => {
    if (!urlEventId || isLoading || !data) return
    if (deepLinkProcessed.current) return

    const found = events.find((e) => e.id === urlEventId)
    if (found) {
      setSelectedEvent(found)
      setEventNotOnPage(false)
    } else {
      setEventNotOnPage(true)
    }
    deepLinkProcessed.current = true
  }, [urlEventId, data, isLoading, events])

  const openDrawer = useCallback(
    (event: AuditEvent) => {
      setSelectedEvent(event)
      setEventNotOnPage(false)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('event', event.id)
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const closeDrawer = useCallback(() => {
    setSelectedEvent(null)
    setEventNotOnPage(false)
    deepLinkProcessed.current = false
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('event')
        return next
      },
      { replace: true }
    )
  }, [setSearchParams])

  // ---- Role check ----
  if (!canView) {
    return <NotAuthorized />
  }

  // ---- Render ----
  const actions = (
    <div className="flex items-center gap-2">
      {/* Export CSV — hidden when 404 (Phase 3 — D10) */}
      {!is404 && events.length > 0 && (
        <button
          onClick={() => exportAuditCsv(events)}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          title="Export current page as CSV"
          aria-label="Export CSV"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </button>
      )}

      {/* Column toggles (Phase 3 — C8) */}
      <div ref={columnMenuRef} className="relative">
        <button
          onClick={() => setColumnMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          title="Toggle columns"
          aria-label="Toggle columns"
        >
          <Settings2 className="h-4 w-4" aria-hidden="true" />
          Columns
        </button>
        {columnMenuOpen && (
          <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {TOGGLEABLE_COLUMNS.map((col) => (
              <label
                key={col.key}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(col.key)}
                  onChange={() => toggleColumn(col.key)}
                  className="rounded border-gray-300"
                />
                {col.label}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Refresh */}
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
    </div>
  )

  return (
    <PageShell title="Audit" description="Track actions and system events." actions={actions}>
      {/* Quick filter chips (Phase 3 — A1) */}
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Quick filters">
        {QUICK_FILTERS.map((chip) => {
          const currentValue = searchParams.get(chip.param) || ''
          const active = chip.isActive(currentValue)
          return (
            <button
              key={chip.key}
              onClick={() => toggleChip(chip)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                active
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
              }`}
              aria-pressed={active}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        {/* Row 1: search + action + status */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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

          <input
            type="text"
            value={actionInput}
            onChange={(e) => setActionInput(e.target.value)}
            placeholder="Filter by action..."
            className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:w-48"
          />

          <select
            value={urlStatus}
            onChange={(e) => setFilter({ status: e.target.value })}
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
              value={urlFrom}
              onChange={(e) => setFilter({ from: e.target.value })}
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
              value={urlTo}
              onChange={(e) => setFilter({ to: e.target.value })}
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

      {/* Deep-link: event not on current page (Phase 3 — B7) */}
      {eventNotOnPage && urlEventId && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Info className="h-4 w-4 shrink-0" />
          Event not on this page. Try using Search to find it.
        </div>
      )}

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
            {totalPages > 1 && ` \u2014 page ${urlPage} of ${totalPages}`}
          </div>

          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    {isColumnVisible('time') && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Time
                      </th>
                    )}
                    {isColumnVisible('status') && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Status
                      </th>
                    )}
                    {isColumnVisible('action') && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Action
                      </th>
                    )}
                    {isColumnVisible('resource') && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Resource
                      </th>
                    )}
                    {isColumnVisible('actor') && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Actor
                      </th>
                    )}
                    {isColumnVisible('requestId') && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Request ID
                      </th>
                    )}
                    {isColumnVisible('ipAddress') && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        IP Address
                      </th>
                    )}
                    {isColumnVisible('userAgent') && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        User Agent
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {events.map((event) => {
                    const isErrorRow = event.status === 'error'
                    return (
                      <tr
                        key={event.id}
                        onClick={() => openDrawer(event)}
                        className={`cursor-pointer hover:bg-gray-50 ${
                          isErrorRow ? 'border-l-4 border-l-red-400 bg-red-50/40' : ''
                        }`}
                      >
                        {isColumnVisible('time') && (
                          <td className="whitespace-nowrap px-6 py-4">
                            <div
                              className="flex items-center gap-1 text-sm text-gray-600"
                              title={formatExactTime(event.created_at)}
                            >
                              <Clock className="h-4 w-4 text-gray-400" />
                              {formatRelativeTime(event.created_at)}
                            </div>
                          </td>
                        )}
                        {isColumnVisible('status') && (
                          <td className="whitespace-nowrap px-6 py-4">
                            <StatusBadge status={event.status} />
                          </td>
                        )}
                        {isColumnVisible('action') && (
                          <td className="whitespace-nowrap px-6 py-4">
                            <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-sm text-gray-700">
                              {event.action}
                            </span>
                          </td>
                        )}
                        {isColumnVisible('resource') && (
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                            <span className="text-gray-400">{event.resource_type}</span>
                            {(event.resource_name || event.resource_id) && (
                              <>
                                {' / '}
                                <span className="font-medium text-gray-900">
                                  {event.resource_name || shortenId(event.resource_id)}
                                </span>
                              </>
                            )}
                            {event.resource_id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  copyText(event.resource_id, 'resource ID')
                                }}
                                className="ml-1 inline-flex rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                title="Copy resource ID"
                                aria-label="Copy resource ID"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            )}
                          </td>
                        )}
                        {isColumnVisible('actor') && (
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                            {getActorName(event.actor)}
                          </td>
                        )}
                        {isColumnVisible('requestId') && (
                          <td className="whitespace-nowrap px-6 py-4">
                            {event.request_id ? (
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-sm text-gray-500">
                                  {shortenId(event.request_id)}
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
                        )}
                        {isColumnVisible('ipAddress') && (
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                            {event.ip_address || '\u2014'}
                          </td>
                        )}
                        {isColumnVisible('userAgent') && (
                          <td className="whitespace-nowrap px-6 py-4">
                            <span
                              className="inline-block max-w-[200px] truncate text-xs text-gray-500"
                              title={event.user_agent || ''}
                            >
                              {event.user_agent || '\u2014'}
                            </span>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setFilter({ page: Math.max(1, urlPage - 1) })}
                disabled={urlPage <= 1}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {urlPage} of {totalPages}
              </span>
              <button
                onClick={() => setFilter({ page: Math.min(totalPages, urlPage + 1) })}
                disabled={urlPage >= totalPages}
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
      <AuditEventDrawer event={selectedEvent} onClose={closeDrawer} />
    </PageShell>
  )
}
