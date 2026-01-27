import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PageShell } from '../components/layout/PageShell'
import { Search, RefreshCw, AlertCircle, Box } from 'lucide-react'
import { useContainers } from '../features/docker'
import type { DockerContainerSummary } from '../api/types'

/**
 * Containers list page.
 * Phase 3: Fetches real data from Docker API with search and filter support.
 * Note: Container actions (start/stop/restart) are planned for later phases.
 */
export function ContainersPage() {
  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Build query params
  const queryParams = useMemo(
    () => ({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: debouncedSearch || undefined,
    }),
    [statusFilter, debouncedSearch]
  )

  // Fetch containers
  const { data, isLoading, isError, error, refetch } = useContainers(queryParams)

  // Extract container name from names array (remove leading /)
  const getContainerName = (container: DockerContainerSummary): string => {
    if (container.names.length === 0) return container.id.substring(0, 12)
    return container.names[0].replace(/^\//, '')
  }

  // Format Unix timestamp to human readable date
  const formatCreated = (timestamp: number): string => {
    const date = new Date(timestamp * 1000)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor(diffMs / (1000 * 60))

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
    return 'Just now'
  }

  // Format ports for display
  const formatPorts = (ports: DockerContainerSummary['ports']): string => {
    if (!ports || ports.length === 0) return '—'
    return ports
      .filter((p) => p.public_port)
      .map((p) => `${p.public_port}:${p.private_port}/${p.type}`)
      .join(', ') || '—'
  }

  // Get status badge color
  const getStatusColor = (state: string): string => {
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

  const containers = data?.results ?? []
  const totalCount = data?.count ?? 0

  return (
    <PageShell title="Containers" description="View Docker containers">
      {/* Search and filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search containers..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="exited">Exited</option>
            <option value="paused">Paused</option>
          </select>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-sm text-red-700">
                Failed to load containers: {error instanceof Error ? error.message : 'Unknown error'}
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

      {/* Loading state */}
      {isLoading && (
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Image
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    State
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Ports
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {[1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="h-6 w-16 animate-pulse rounded bg-gray-200" />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && containers.length === 0 && (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm">
          <Box className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No containers found</h3>
          <p className="mt-2 text-sm text-gray-500">
            {debouncedSearch || statusFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'There are no containers on this Docker host.'}
          </p>
        </div>
      )}

      {/* Containers table */}
      {!isLoading && !isError && containers.length > 0 && (
        <>
          <div className="mb-2 text-sm text-gray-500">
            Showing {containers.length} of {totalCount} container{totalCount !== 1 ? 's' : ''}
          </div>
          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Image
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      State
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Ports
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {containers.map((container) => (
                    <tr key={container.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <Link
                          to={`/containers/${container.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          {getContainerName(container)}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {container.image}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(container.state)}`}
                        >
                          {container.state}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {container.status}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatCreated(container.created)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatPorts(container.ports)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </PageShell>
  )
}
