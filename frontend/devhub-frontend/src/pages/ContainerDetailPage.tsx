import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  Play,
  RefreshCw,
  Square,
  RotateCw,
} from 'lucide-react'
import { PageShell } from '../components/layout/PageShell'
import {
  useContainer,
  useContainerLogs,
  useStartContainer,
  useStopContainer,
  useRestartContainer,
} from '../features/docker'
import { useCanOperateContainers } from '../features/auth'
import type { DockerContainerSummary } from '../api/types'

// =============================================================================
// Constants
// =============================================================================

// DEFAULT: Tail options for logs
const TAIL_OPTIONS = [200, 500, 1000, 2000] as const
const DEFAULT_TAIL = 200

// DEFAULT: Auto-refresh interval for logs (3 seconds)
const AUTO_REFRESH_INTERVAL_LABEL = '3s'

// =============================================================================
// Helper Functions
// =============================================================================

// Extract container name from names array (remove leading /)
function getContainerName(container: DockerContainerSummary): string {
  if (container.names.length === 0) return container.id.substring(0, 12)
  return container.names[0].replace(/^\//, '')
}

// Format Unix timestamp to human readable date
function formatCreated(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleString()
}

// Format ports for display
function formatPorts(ports: DockerContainerSummary['ports']): string {
  if (!ports || ports.length === 0) return 'None'
  return ports
    .filter((p) => p.public_port)
    .map((p) => `${p.public_port}:${p.private_port}/${p.type}`)
    .join(', ') || 'None exposed'
}

// Get status badge color
function getStatusColor(state: string): string {
  switch (state.toLowerCase()) {
    case 'running':
      return 'bg-green-100 text-green-700'
    case 'paused':
      return 'bg-yellow-100 text-yellow-700'
    case 'exited':
    case 'dead':
      return 'bg-gray-100 text-gray-700'
    case 'restarting':
      return 'bg-blue-100 text-blue-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

// =============================================================================
// Components
// =============================================================================

/**
 * Confirm dialog for restart action.
 * Phase 6: Improved accessibility with ARIA attributes and keyboard navigation.
 */
function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  isLoading,
}: {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  message: string
  isLoading: boolean
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!isOpen) return

    // Focus the cancel button when dialog opens
    cancelButtonRef.current?.focus()

    // Handle escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isLoading, onCancel])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
      onClick={(e) => {
        // Close on backdrop click (only if clicking the backdrop itself)
        if (e.target === e.currentTarget && !isLoading) {
          onCancel()
        }
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="dialog-title" className="text-lg font-semibold text-gray-900">
          {title}
        </h3>
        <p id="dialog-description" className="mt-2 text-sm text-gray-600">
          {message}
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <button
            ref={cancelButtonRef}
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            type="button"
          >
            {isLoading && <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Actions bar for container lifecycle operations.
 * Only visible to users with operator or admin role.
 */
function ActionsBar({
  container,
  canOperate,
}: {
  container: DockerContainerSummary
  canOperate: boolean
}) {
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)

  const startMutation = useStartContainer()
  const stopMutation = useStopContainer()
  const restartMutation = useRestartContainer()

  const isRunning = container.state.toLowerCase() === 'running'
  const isPaused = container.state.toLowerCase() === 'paused'
  const isMutating = startMutation.isPending || stopMutation.isPending || restartMutation.isPending

  // Handle start
  const handleStart = () => {
    startMutation.mutate(container.id, {
      onSuccess: () => {
        toast.success(`Container ${getContainerName(container)} started`)
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to start container')
      },
    })
  }

  // Handle stop
  const handleStop = () => {
    stopMutation.mutate(container.id, {
      onSuccess: () => {
        toast.success(`Container ${getContainerName(container)} stopped`)
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to stop container')
      },
    })
  }

  // Handle restart (with confirmation)
  const handleRestartConfirm = () => {
    restartMutation.mutate(container.id, {
      onSuccess: () => {
        toast.success(`Container ${getContainerName(container)} restarted`)
        setShowRestartConfirm(false)
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to restart container')
        setShowRestartConfirm(false)
      },
    })
  }

  if (!canOperate) return null

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Start button - only when not running */}
        {!isRunning && (
          <button
            onClick={handleStart}
            disabled={isMutating}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            title="Start container"
          >
            {startMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Start
          </button>
        )}

        {/* Stop button - only when running or paused */}
        {(isRunning || isPaused) && (
          <button
            onClick={handleStop}
            disabled={isMutating}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            title="Stop container"
          >
            {stopMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            Stop
          </button>
        )}

        {/* Restart button - always visible */}
        <button
          onClick={() => setShowRestartConfirm(true)}
          disabled={isMutating}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          title="Restart container"
        >
          {restartMutation.isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCw className="h-4 w-4" />
          )}
          Restart
        </button>
      </div>

      {/* Restart confirmation dialog */}
      <ConfirmDialog
        isOpen={showRestartConfirm}
        onConfirm={handleRestartConfirm}
        onCancel={() => setShowRestartConfirm(false)}
        title="Restart Container"
        message={`Are you sure you want to restart ${getContainerName(container)}? This will briefly interrupt the container.`}
        isLoading={restartMutation.isPending}
      />
    </>
  )
}

/**
 * Logs panel with tail selector and auto-refresh toggle.
 */
function LogsPanel({ containerId }: { containerId: string }) {
  const [tail, setTail] = useState<number>(DEFAULT_TAIL)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const { data, isLoading, isError, error, refetch } = useContainerLogs(
    containerId,
    { tail },
    { autoRefresh }
  )

  // Copy logs to clipboard
  const handleCopyLogs = () => {
    if (data?.logs) {
      navigator.clipboard.writeText(data.logs)
      toast.success('Logs copied to clipboard')
    }
  }

  return (
    <div className="rounded-lg bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Logs</h2>
        <div className="flex items-center gap-3">
          {/* Tail selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="tail-select" className="text-sm text-gray-600">
              Tail:
            </label>
            <select
              id="tail-select"
              value={tail}
              onChange={(e) => setTail(Number(e.target.value))}
              className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {TAIL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">
              Auto-refresh ({AUTO_REFRESH_INTERVAL_LABEL})
            </span>
          </label>

          {/* Copy logs button */}
          <button
            onClick={handleCopyLogs}
            disabled={!data?.logs}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            title="Copy logs to clipboard"
          >
            <Copy className="h-4 w-4" />
            Copy
          </button>

          {/* Refresh button */}
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
            title="Refresh logs"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Loading skeleton */}
        {isLoading && !data && (
          <div className="space-y-2">
            {[85, 70, 90, 65, 80].map((width, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-gray-200" style={{ width: `${width}%` }} />
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <p className="text-sm text-red-700">
                  Failed to load logs: {error instanceof Error ? error.message : 'Unknown error'}
                </p>
              </div>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-1 rounded bg-red-100 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-200"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Logs content */}
        {!isLoading && !isError && data && (
          <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap rounded-lg bg-gray-900 p-4 font-mono text-xs text-gray-100">
            {data.logs || 'No logs available'}
          </pre>
        )}
      </div>
    </div>
  )
}

/**
 * Labels section with collapsible display.
 */
function LabelsSection({ labels }: { labels: Record<string, string> }) {
  const [expanded, setExpanded] = useState(false)
  const entries = Object.entries(labels)

  if (entries.length === 0) {
    return (
      <div className="text-sm text-gray-500">No labels</div>
    )
  }

  const displayLabels = expanded ? entries : entries.slice(0, 3)
  const hasMore = entries.length > 3

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {displayLabels.map(([key, value]) => (
          <span
            key={key}
            className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
            title={`${key}=${value}`}
          >
            <span className="max-w-[100px] truncate">{key}</span>
            <span className="mx-1">=</span>
            <span className="max-w-[150px] truncate">{value}</span>
          </span>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
        >
          {expanded ? (
            <>
              <ChevronDown className="h-3 w-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronRight className="h-3 w-3" />
              Show {entries.length - 3} more
            </>
          )}
        </button>
      )}
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * Container detail page.
 * Phase 4: Full detail, logs, and lifecycle actions with role-based visibility.
 */
export function ContainerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const canOperate = useCanOperateContainers()

  const { data: container, isLoading, isError, error, refetch } = useContainer(id ?? '')

  // Shorten the container ID for display (first 12 chars like Docker CLI)
  const shortId = id ? id.substring(0, 12) : 'unknown'

  // Loading state
  if (isLoading) {
    return (
      <PageShell title={`Container ${shortId}`} description="Loading...">
        <div className="space-y-6">
          {/* Back link */}
          <Link
            to="/containers"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Containers
          </Link>

          {/* Loading skeleton */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
              <div className="space-y-3">
                {[55, 65, 50, 60].map((width, i) => (
                  <div key={i} className="h-4 animate-pulse rounded bg-gray-200" style={{ width: `${width}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </PageShell>
    )
  }

  // Error state
  if (isError) {
    return (
      <PageShell title={`Container ${shortId}`} description="Error loading container">
        <div className="space-y-6">
          {/* Back link */}
          <Link
            to="/containers"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Containers
          </Link>

          {/* Error message */}
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-red-500" />
                <div>
                  <h3 className="font-medium text-red-900">Failed to load container</h3>
                  <p className="mt-1 text-sm text-red-700">
                    {error instanceof Error ? error.message : 'Unknown error'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </PageShell>
    )
  }

  // Container not found
  if (!container) {
    return (
      <PageShell title={`Container ${shortId}`} description="Container not found">
        <div className="space-y-6">
          {/* Back link */}
          <Link
            to="/containers"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Containers
          </Link>

          {/* Not found message */}
          <div className="rounded-lg bg-white p-12 text-center shadow-sm">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">Container not found</h3>
            <p className="mt-2 text-sm text-gray-500">
              The container with ID {shortId} could not be found.
            </p>
          </div>
        </div>
      </PageShell>
    )
  }

  const containerName = getContainerName(container)

  return (
    <PageShell
      title={containerName}
      description={`Container ${shortId}`}
    >
      <div className="space-y-6">
        {/* Header with back link and actions */}
        <div className="flex items-center justify-between">
          <Link
            to="/containers"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Containers
          </Link>

          {/* Actions bar - only visible to operators/admins */}
          <ActionsBar container={container} canOperate={canOperate} />
        </div>

        {/* Container details card */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{containerName}</h2>
              <p className="mt-1 font-mono text-sm text-gray-500">{container.id}</p>
            </div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(container.state)}`}
            >
              {container.state}
            </span>
          </div>

          <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Image</dt>
              <dd className="mt-1 font-mono text-sm text-gray-900">{container.image}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1 text-sm text-gray-900">{container.status}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatCreated(container.created)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Command</dt>
              <dd className="mt-1 truncate font-mono text-sm text-gray-900" title={container.command}>
                {container.command}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Ports</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatPorts(container.ports)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Network Mode</dt>
              <dd className="mt-1 text-sm text-gray-900">{container.host_config.network_mode}</dd>
            </div>
          </dl>

          {/* Labels section */}
          <div className="mt-6 border-t border-gray-200 pt-6">
            <h3 className="text-sm font-medium text-gray-500">Labels</h3>
            <div className="mt-2">
              <LabelsSection labels={container.labels} />
            </div>
          </div>

          {/* Mounts section */}
          {container.mounts.length > 0 && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="text-sm font-medium text-gray-500">Mounts</h3>
              <div className="mt-2 space-y-2">
                {container.mounts.map((mount, index) => (
                  <div
                    key={index}
                    className="rounded-lg bg-gray-50 p-3 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-700">
                        {mount.type}
                      </span>
                      <span className="text-gray-600">{mount.rw ? 'rw' : 'ro'}</span>
                    </div>
                    <div className="mt-1 font-mono text-xs text-gray-500">
                      {mount.source} → {mount.destination}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Networks section */}
          {Object.keys(container.network_settings.networks).length > 0 && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="text-sm font-medium text-gray-500">Networks</h3>
              <div className="mt-2 space-y-2">
                {Object.entries(container.network_settings.networks).map(([name, network]) => (
                  <div
                    key={name}
                    className="rounded-lg bg-gray-50 p-3 text-sm"
                  >
                    <div className="font-medium text-gray-900">{name}</div>
                    {network.ip_address && (
                      <div className="mt-1 font-mono text-xs text-gray-500">
                        IP: {network.ip_address}
                        {network.gateway && ` (Gateway: ${network.gateway})`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Logs panel */}
        {id && <LogsPanel containerId={id} />}
      </div>
    </PageShell>
  )
}
