import { PageShell } from '../components/layout/PageShell'
import { Search, Network } from 'lucide-react'

/**
 * Networks list page (read-only).
 * Phase 1: Static placeholder UI.
 * Future phases will fetch from /docker/networks/
 */
export function NetworksPage() {
  // Placeholder networks - will be fetched from API
  const placeholderNetworks = [
    { id: 'abc123', name: 'bridge', driver: 'bridge', scope: 'local', ipam: '172.17.0.0/16' },
    { id: 'def456', name: 'host', driver: 'host', scope: 'local', ipam: '—' },
    { id: 'ghi789', name: 'none', driver: 'null', scope: 'local', ipam: '—' },
    { id: 'jkl012', name: 'devhub_network', driver: 'bridge', scope: 'local', ipam: '172.18.0.0/16' },
  ]

  return (
    <PageShell title="Networks" description="Docker networks (read-only view)">
      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search networks..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Networks table */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Driver
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Scope
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  IPAM Subnet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Network ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {placeholderNetworks.map((network) => (
                <tr key={network.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Network className="h-4 w-4 text-orange-500" />
                      <span className="font-medium text-gray-900">{network.name}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="rounded bg-gray-100 px-2 py-1 text-sm text-gray-600">
                      {network.driver}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {network.scope}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 font-mono text-sm text-gray-500">
                    {network.ipam}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 font-mono text-sm text-gray-500">
                    {network.id}
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
          <strong>Phase 1:</strong> Placeholder data. Real networks will be fetched from the Docker
          API in future phases.
        </p>
      </div>
    </PageShell>
  )
}
