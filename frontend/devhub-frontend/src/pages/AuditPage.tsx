import { PageShell } from '../components/layout/PageShell'
import { Search, Filter, User, Box, Clock } from 'lucide-react'

/**
 * Audit log page (operator/admin only in future phases).
 * Phase 1: Static placeholder UI.
 * Future phases will fetch from /audit/ and implement role gating.
 */
export function AuditPage() {
  // Placeholder audit events - will be fetched from API
  const placeholderEvents = [
    {
      id: 1,
      timestamp: '2024-01-20 14:32:15',
      user: 'admin',
      action: 'container.start',
      resource: 'nginx-proxy',
      status: 'success',
    },
    {
      id: 2,
      timestamp: '2024-01-20 14:30:00',
      user: 'operator1',
      action: 'container.stop',
      resource: 'redis-cache',
      status: 'success',
    },
    {
      id: 3,
      timestamp: '2024-01-20 14:25:30',
      user: 'admin',
      action: 'image.pull',
      resource: 'nginx:latest',
      status: 'success',
    },
    {
      id: 4,
      timestamp: '2024-01-20 14:20:00',
      user: 'viewer1',
      action: 'container.view',
      resource: 'postgres-db',
      status: 'success',
    },
    {
      id: 5,
      timestamp: '2024-01-20 14:15:00',
      user: 'operator1',
      action: 'container.restart',
      resource: 'node-api',
      status: 'failed',
    },
  ]

  return (
    <PageShell title="Audit Log" description="System activity history">
      {/* Search and filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search events..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex gap-2">
          <select className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="all">All Actions</option>
            <option value="container">Container</option>
            <option value="image">Image</option>
            <option value="auth">Auth</option>
          </select>
          <select className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="all">All Users</option>
            <option value="admin">admin</option>
            <option value="operator1">operator1</option>
            <option value="viewer1">viewer1</option>
          </select>
          <button className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">More Filters</span>
          </button>
        </div>
      </div>

      {/* Audit events table */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  User
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
              {placeholderEvents.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="h-4 w-4" />
                      {event.timestamp}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{event.user}</span>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phase 1 notice */}
      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-700">
          <strong>Phase 1:</strong> Placeholder data. Real audit events will be fetched from the API
          in future phases. Access will be restricted to operator/admin roles.
        </p>
      </div>
    </PageShell>
  )
}
