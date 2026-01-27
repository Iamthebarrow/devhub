import { useState } from 'react'
import { PageShell } from '../components/layout/PageShell'
import { Search, Database, RefreshCw, AlertCircle } from 'lucide-react'
import { useVolumes, dockerKeys } from '../features/docker'
import { useQueryClient } from '@tanstack/react-query'
import type { DockerVolume } from '../api/types'

/**
 * Format ISO date to readable format.
 */
function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return isoDate
  }
}

/**
 * Format bytes to human-readable size.
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * Volume card component.
 */
function VolumeCard({ volume }: { volume: DockerVolume }) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className="rounded-lg bg-purple-100 p-2">
          <Database className="h-5 w-5 text-purple-600" />
        </div>
        <h3 className="font-semibold text-gray-900 truncate" title={volume.name}>
          {volume.name}
        </h3>
      </div>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-gray-500">Driver</dt>
          <dd className="font-medium text-gray-900">{volume.driver}</dd>
        </div>
        {volume.mountpoint && (
          <div>
            <dt className="text-gray-500">Mount Point</dt>
            <dd className="truncate font-mono text-xs text-gray-600" title={volume.mountpoint}>
              {volume.mountpoint}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-gray-500">Scope</dt>
          <dd className="font-medium text-gray-900">{volume.scope}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Created</dt>
          <dd className="font-medium text-gray-900">{formatDate(volume.created_at)}</dd>
        </div>
        {volume.usage_data && (
          <div>
            <dt className="text-gray-500">Size</dt>
            <dd className="font-medium text-gray-900">{formatSize(volume.usage_data.size)}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}

/**
 * Volumes list page (read-only).
 * Phase 5: Full implementation with API wiring.
 */
export function VolumesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error, refetch } = useVolumes()

  const volumes = data?.volumes ?? []

  // Filter volumes by search query
  const filteredVolumes = volumes.filter((volume) => {
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    return (
      volume.name.toLowerCase().includes(search) ||
      volume.driver.toLowerCase().includes(search)
    )
  })

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: dockerKeys.volumes() })
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
    <PageShell title="Volumes" description="Docker volumes (read-only view)" actions={actions}>
      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search volumes..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <div className="h-9 w-9 animate-pulse rounded-lg bg-gray-200" />
                <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
              </div>
              <div className="space-y-3">
                {[60, 80, 50, 70].map((width, j) => (
                  <div key={j} className="h-4 animate-pulse rounded bg-gray-200" style={{ width: `${width}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <div>
              <h3 className="font-medium text-red-800">Failed to load volumes</h3>
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
      {!isLoading && !isError && filteredVolumes.length === 0 && (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm">
          <Database className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {searchQuery ? 'No volumes match your search' : 'No volumes found'}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {searchQuery
              ? 'Try adjusting your search query'
              : 'No Docker volumes are available'}
          </p>
        </div>
      )}

      {/* Volumes grid */}
      {!isLoading && !isError && filteredVolumes.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVolumes.map((volume) => (
            <VolumeCard key={volume.name} volume={volume} />
          ))}
        </div>
      )}
    </PageShell>
  )
}
