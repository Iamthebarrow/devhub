import { PageShell } from '../components/layout/PageShell'
import { Search, Database } from 'lucide-react'

/**
 * Volumes list page (read-only).
 * Phase 1: Static placeholder UI.
 * Future phases will fetch from /docker/volumes/
 */
export function VolumesPage() {
  // Placeholder volumes - will be fetched from API
  const placeholderVolumes = [
    { name: 'postgres_data', driver: 'local', mountpoint: '/var/lib/docker/volumes/postgres_data/_data', created: '2024-01-10' },
    { name: 'redis_data', driver: 'local', mountpoint: '/var/lib/docker/volumes/redis_data/_data', created: '2024-01-12' },
    { name: 'app_uploads', driver: 'local', mountpoint: '/var/lib/docker/volumes/app_uploads/_data', created: '2024-01-15' },
  ]

  return (
    <PageShell title="Volumes" description="Docker volumes (read-only view)">
      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search volumes..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Volumes grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {placeholderVolumes.map((volume) => (
          <div key={volume.name} className="rounded-lg bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2">
                <Database className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900">{volume.name}</h3>
            </div>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Driver</dt>
                <dd className="font-medium text-gray-900">{volume.driver}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Mount Point</dt>
                <dd className="truncate font-mono text-xs text-gray-600" title={volume.mountpoint}>
                  {volume.mountpoint}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Created</dt>
                <dd className="font-medium text-gray-900">{volume.created}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      {/* Phase 1 notice */}
      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-700">
          <strong>Phase 1:</strong> Placeholder data. Real volumes will be fetched from the Docker API
          in future phases.
        </p>
      </div>
    </PageShell>
  )
}
