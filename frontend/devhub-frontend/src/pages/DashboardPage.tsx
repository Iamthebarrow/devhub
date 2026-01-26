import { PageShell } from '../components/layout/PageShell'
import { Box, HardDrive, Database, Network, Activity, Server } from 'lucide-react'

/**
 * Dashboard page showing system overview.
 * Phase 1: Static placeholder cards.
 * Future phases will fetch from /docker/system/info/ and /docker/system/version/
 */
export function DashboardPage() {
  // Placeholder stats - will be fetched from API in future phases
  const stats = [
    { label: 'Containers', value: '—', icon: Box, color: 'bg-blue-500' },
    { label: 'Images', value: '—', icon: HardDrive, color: 'bg-green-500' },
    { label: 'Volumes', value: '—', icon: Database, color: 'bg-purple-500' },
    { label: 'Networks', value: '—', icon: Network, color: 'bg-orange-500' },
  ]

  return (
    <PageShell title="Dashboard" description="Docker environment overview">
      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-lg bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className={`rounded-lg ${color} p-3`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* System info placeholder */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Docker info */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Server className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Docker Info</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Docker Version</span>
              <span className="font-medium text-gray-900">—</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">API Version</span>
              <span className="font-medium text-gray-900">—</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">OS/Arch</span>
              <span className="font-medium text-gray-900">—</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Kernel Version</span>
              <span className="font-medium text-gray-900">—</span>
            </div>
          </div>
        </div>

        {/* System status */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">System Status</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Total Memory</span>
              <span className="font-medium text-gray-900">—</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">CPUs</span>
              <span className="font-medium text-gray-900">—</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Storage Driver</span>
              <span className="font-medium text-gray-900">—</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Docker Root Dir</span>
              <span className="font-medium text-gray-900">—</span>
            </div>
          </div>
        </div>
      </div>

      {/* Phase 1 notice */}
      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-700">
          <strong>Phase 1:</strong> This is a placeholder dashboard. Real data will be fetched from
          the Docker API in future phases.
        </p>
      </div>
    </PageShell>
  )
}
