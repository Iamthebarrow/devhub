import { useState } from 'react'
import { PageShell } from '../components/layout/PageShell'
import { Search, Network, RefreshCw, AlertCircle } from 'lucide-react'
import { useNetworks } from '../features/docker'
import type { DockerNetwork } from '../api/types'

/**
 * Get primary subnet from subnets array.
 * Backend provides subnets as a simple array of strings.
 */
function getSubnet(network: DockerNetwork): string {
  if (network.subnets && network.subnets.length > 0) {
    return network.subnets[0]
  }
  return '—'
}

/**
 * Networks list page (read-only).
 * Phase 5: Full implementation with API wiring.
 */
export function NetworksPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const { data, isLoading, isError, error, refetch, isFetching } = useNetworks()

  const networks = data?.results ?? []

  // Filter networks by search query
  const filteredNetworks = networks.filter((network) => {
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    return (
      network.name.toLowerCase().includes(search) ||
      network.driver.toLowerCase().includes(search) ||
      network.id.toLowerCase().includes(search)
    )
  })

  const actions = (
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
  )

  return (
    <PageShell title="Networks" description="Docker networks (read-only view)" actions={actions}>
      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search networks..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="p-6">
            <div className="space-y-3">
              {[85, 70, 90, 75, 80].map((width, i) => (
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
              <h3 className="font-medium text-red-800">Failed to load networks</h3>
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
      {!isLoading && !isError && filteredNetworks.length === 0 && (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm">
          <Network className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {searchQuery ? 'No networks match your search' : 'No networks found'}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {searchQuery
              ? 'Try adjusting your search query'
              : 'No Docker networks are available'}
          </p>
        </div>
      )}

      {/* Networks table */}
      {!isLoading && !isError && filteredNetworks.length > 0 && (
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
                    Subnet
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Internal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Network ID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredNetworks.map((network) => {
                  const shortId = network.id.slice(0, 12)
                  return (
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
                        {getSubnet(network)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {network.internal ? 'Yes' : 'No'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-mono text-sm text-gray-500">
                        {shortId}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageShell>
  )
}
