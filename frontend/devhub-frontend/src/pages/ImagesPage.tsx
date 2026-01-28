import { useState } from 'react'
import { PageShell } from '../components/layout/PageShell'
import { Search, Download, Trash2, RefreshCw, AlertCircle } from 'lucide-react'
import { useImages, usePullImage, useRemoveImage, dockerKeys } from '../features/docker'
import { useCanPullImages, useIsAdmin } from '../features/auth'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import type { DockerImageSummary } from '../api/types'

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
 * Format ISO date string to relative time.
 */
function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate)
  const now = Date.now()
  const diff = (now - date.getTime()) / 1000

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`
  if (diff < 2592000) return `${Math.floor(diff / 604800)} weeks ago`
  return `${Math.floor(diff / 2592000)} months ago`
}

/**
 * Parse image name from tags array.
 */
function parseImageName(image: DockerImageSummary): { name: string; tag: string } {
  if (image.tags.length === 0 || image.tags[0] === '<none>:<none>') {
    // Use first 12 chars of ID
    return { name: image.id.replace('sha256:', '').slice(0, 12), tag: '<none>' }
  }
  const [fullName, tag = 'latest'] = image.tags[0].split(':')
  return { name: fullName, tag }
}

/**
 * Confirm dialog component.
 */
function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  isLoading,
}: {
  isOpen: boolean
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? 'Removing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Pull image form component.
 */
function PullImageForm({ onPull, isLoading }: { onPull: (image: string) => void; isLoading: boolean }) {
  const [imageName, setImageName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (imageName.trim()) {
      onPull(imageName.trim())
      setImageName('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        type="text"
        value={imageName}
        onChange={(e) => setImageName(e.target.value)}
        placeholder="Image name (e.g., nginx:latest)"
        className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={!imageName.trim() || isLoading}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        {isLoading ? 'Pulling...' : 'Pull Image'}
      </button>
    </form>
  )
}

/**
 * Images list page.
 * Phase 5: Full implementation with API wiring.
 */
export function ImagesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmRemove, setConfirmRemove] = useState<DockerImageSummary | null>(null)

  const queryClient = useQueryClient()
  const canPull = useCanPullImages()
  const isAdmin = useIsAdmin()

  const { data, isLoading, isError, error, refetch } = useImages()
  const pullMutation = usePullImage()
  const removeMutation = useRemoveImage()

  const images = data?.results ?? []

  // Filter images by search query
  const filteredImages = images.filter((image) => {
    if (!searchQuery) return true
    const { name, tag } = parseImageName(image)
    const search = searchQuery.toLowerCase()
    return (
      name.toLowerCase().includes(search) ||
      tag.toLowerCase().includes(search) ||
      image.id.toLowerCase().includes(search)
    )
  })

  const handlePull = (imageName: string) => {
    pullMutation.mutate(imageName, {
      onSuccess: () => {
        toast.success(`Pull queued for ${imageName}`)
      },
      onError: (err) => {
        toast.error(`Failed to pull image: ${err instanceof Error ? err.message : 'Unknown error'}`)
      },
    })
  }

  const handleRemove = (image: DockerImageSummary) => {
    setConfirmRemove(image)
  }

  const confirmRemoveImage = () => {
    if (!confirmRemove) return

    const { name, tag } = parseImageName(confirmRemove)
    const displayName = `${name}:${tag}`

    removeMutation.mutate(
      { id: confirmRemove.id, force: false },
      {
        onSuccess: () => {
          toast.success(`Remove queued for ${displayName}`)
          setConfirmRemove(null)
        },
        onError: (err) => {
          toast.error(`Failed to remove image: ${err instanceof Error ? err.message : 'Unknown error'}`)
          setConfirmRemove(null)
        },
      }
    )
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: dockerKeys.images() })
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
    <PageShell title="Images" description="Manage Docker images" actions={actions}>
      {/* Pull form for operator/admin */}
      {canPull && (
        <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-medium text-gray-900">Pull Image</h3>
          <PullImageForm onPull={handlePull} isLoading={pullMutation.isPending} />
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search images..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="p-6">
            <div className="space-y-3">
              {[80, 65, 90, 70, 85].map((width, i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-gray-200" style={{ width: `${width}%` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <div>
              <h3 className="font-medium text-red-800">Failed to load images</h3>
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
      {!isLoading && !isError && filteredImages.length === 0 && (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm">
          <Download className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {searchQuery ? 'No images match your search' : 'No images found'}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {searchQuery
              ? 'Try adjusting your search query'
              : canPull
                ? 'Pull an image to get started'
                : 'No Docker images are available'}
          </p>
        </div>
      )}

      {/* Images table */}
      {!isLoading && !isError && filteredImages.length > 0 && (
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Repository
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Tag
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Image ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Created
                  </th>
                  {isAdmin && (
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredImages.map((image) => {
                  const { name, tag } = parseImageName(image)
                  const shortId = image.id.replace('sha256:', '').slice(0, 12)
                  return (
                    <tr key={image.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">{name}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="rounded bg-gray-100 px-2 py-1 text-sm text-gray-600">{tag}</span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-mono text-sm text-gray-500">{shortId}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatSize(image.size)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {formatRelativeTime(image.created)}
                      </td>
                      {isAdmin && (
                        <td className="whitespace-nowrap px-6 py-4 text-right">
                          <button
                            onClick={() => handleRemove(image)}
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                            title="Remove image"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm remove dialog */}
      {confirmRemove && (
        <ConfirmDialog
          isOpen={true}
          title="Remove Image"
          message={`Are you sure you want to remove ${parseImageName(confirmRemove).name}:${parseImageName(confirmRemove).tag}? This action cannot be undone.`}
          confirmLabel="Remove"
          onConfirm={confirmRemoveImage}
          onCancel={() => setConfirmRemove(null)}
          isLoading={removeMutation.isPending}
        />
      )}
    </PageShell>
  )
}
