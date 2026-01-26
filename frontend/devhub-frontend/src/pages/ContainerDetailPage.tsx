import { useParams } from 'react-router-dom'
import { PageShell } from '../components/layout/PageShell'
import { Play, Square, RotateCcw, Trash2, Terminal } from 'lucide-react'

/**
 * Container detail page.
 * Phase 1: Static placeholder showing container info and logs section.
 * Future phases will fetch from /docker/containers/{id}/ and /docker/containers/{id}/logs/
 */
export function ContainerDetailPage() {
  const { id } = useParams<{ id: string }>()

  // Placeholder container detail - will be fetched from API
  const container = {
    id: id || 'abc123',
    name: 'nginx-proxy',
    image: 'nginx:latest',
    status: 'running',
    created: '2024-01-15T10:30:00Z',
    ports: [{ host: 8080, container: 80, protocol: 'tcp' }],
    mounts: [{ source: '/data/nginx', destination: '/usr/share/nginx/html', mode: 'rw' }],
    labels: { 'com.example.env': 'production', 'com.example.app': 'web' },
  }

  const actions = (
    <div className="flex gap-2">
      <button className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700">
        <Play className="h-4 w-4" />
        Start
      </button>
      <button className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700">
        <Square className="h-4 w-4" />
        Stop
      </button>
      <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
        <RotateCcw className="h-4 w-4" />
        Restart
      </button>
      <button className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50">
        <Trash2 className="h-4 w-4" />
        Remove
      </button>
    </div>
  )

  return (
    <PageShell title={container.name} description={`Container ID: ${container.id}`} actions={actions}>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Container info */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Container Info</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Image</dt>
              <dd className="font-medium text-gray-900">{container.image}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Status</dt>
              <dd>
                <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                  {container.status}
                </span>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Created</dt>
              <dd className="font-medium text-gray-900">{container.created}</dd>
            </div>
          </dl>
        </div>

        {/* Ports */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Ports</h2>
          {container.ports.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {container.ports.map((port, i) => (
                <li key={i} className="flex justify-between">
                  <span className="text-gray-500">{port.container}/{port.protocol}</span>
                  <span className="font-medium text-gray-900">→ {port.host}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No ports exposed</p>
          )}
        </div>

        {/* Mounts */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Mounts</h2>
          {container.mounts.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {container.mounts.map((mount, i) => (
                <li key={i}>
                  <div className="text-gray-500">{mount.source}</div>
                  <div className="font-medium text-gray-900">→ {mount.destination} ({mount.mode})</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No mounts</p>
          )}
        </div>

        {/* Labels */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Labels</h2>
          {Object.keys(container.labels).length > 0 ? (
            <dl className="space-y-2 text-sm">
              {Object.entries(container.labels).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-gray-500">{key}</dt>
                  <dd className="font-medium text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-gray-500">No labels</p>
          )}
        </div>
      </div>

      {/* Logs section */}
      <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Logs</h2>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" className="rounded border-gray-300" />
              Auto-refresh
            </label>
            <select className="rounded border border-gray-300 px-2 py-1 text-sm">
              <option value="100">Last 100 lines</option>
              <option value="200">Last 200 lines</option>
              <option value="500">Last 500 lines</option>
            </select>
          </div>
        </div>
        <div className="h-64 overflow-auto rounded bg-gray-900 p-4 font-mono text-sm text-gray-300">
          <p className="text-gray-500"># Container logs will appear here in future phases</p>
          <p>2024-01-20 10:30:15 [INFO] Server started on port 80</p>
          <p>2024-01-20 10:30:16 [INFO] Ready to accept connections</p>
          <p className="text-gray-500">...</p>
        </div>
      </div>

      {/* Phase 1 notice */}
      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-700">
          <strong>Phase 1:</strong> Placeholder data. Real container details and logs will be fetched
          from the Docker API in future phases.
        </p>
      </div>
    </PageShell>
  )
}
