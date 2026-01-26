import { PageShell } from '../components/layout/PageShell'
import { Search, Filter, Play, Square, RotateCcw } from 'lucide-react'

/**
 * Containers list page.
 * Phase 1: Static placeholder UI with search/filter controls.
 * Future phases will fetch from /docker/containers/ and implement actions.
 */
export function ContainersPage() {
  // Placeholder containers - will be fetched from API
  const placeholderContainers = [
    { id: 'abc123', name: 'nginx-proxy', image: 'nginx:latest', status: 'running', state: 'Up 2 days' },
    { id: 'def456', name: 'postgres-db', image: 'postgres:15', status: 'running', state: 'Up 5 hours' },
    { id: 'ghi789', name: 'redis-cache', image: 'redis:alpine', status: 'exited', state: 'Exited (0) 1 hour ago' },
  ]

  return (
    <PageShell title="Containers" description="Manage Docker containers">
      {/* Search and filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search containers..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex gap-2">
          <select className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="exited">Exited</option>
            <option value="paused">Paused</option>
          </select>
          <button className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>
        </div>
      </div>

      {/* Containers table */}
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
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  State
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {placeholderContainers.map((container) => (
                <tr key={container.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer">
                      {container.name}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {container.image}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        container.status === 'running'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {container.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {container.state}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-green-600"
                        title="Start"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                        title="Stop"
                      >
                        <Square className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                        title="Restart"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phase 1 notice */}
      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-700">
          <strong>Phase 1:</strong> Placeholder data. Real containers will be fetched from the Docker
          API in future phases.
        </p>
      </div>
    </PageShell>
  )
}
