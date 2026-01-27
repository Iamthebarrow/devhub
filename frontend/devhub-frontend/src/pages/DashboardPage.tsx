import { PageShell } from '../components/layout/PageShell'
import {
  Box,
  HardDrive,
  Database,
  Network,
  Activity,
  Server,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { useSystemInfo, useSystemVersion } from '../features/docker'

/**
 * Dashboard page showing system overview.
 * Phase 3: Fetches real data from Docker system API.
 */
export function DashboardPage() {
  const {
    data: systemInfo,
    isLoading: isInfoLoading,
    isError: isInfoError,
    error: infoError,
    refetch: refetchInfo,
  } = useSystemInfo()

  const {
    data: systemVersion,
    isLoading: isVersionLoading,
    isError: isVersionError,
    error: versionError,
    refetch: refetchVersion,
  } = useSystemVersion()

  const isLoading = isInfoLoading || isVersionLoading
  const isError = isInfoError || isVersionError
  const error = infoError || versionError

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  // Build stats from system info
  const stats = [
    {
      label: 'Containers',
      value: isLoading
        ? '—'
        : systemInfo
          ? `${systemInfo.containers_running}/${systemInfo.containers}`
          : '—',
      subtext: isLoading ? '' : systemInfo ? `${systemInfo.containers_running} running` : '',
      icon: Box,
      color: 'bg-blue-500',
    },
    {
      label: 'Images',
      value: isLoading ? '—' : systemInfo?.images?.toString() ?? '—',
      icon: HardDrive,
      color: 'bg-green-500',
    },
    {
      label: 'Memory',
      value: isLoading ? '—' : systemInfo ? formatBytes(systemInfo.mem_total) : '—',
      icon: Database,
      color: 'bg-purple-500',
    },
    {
      label: 'CPUs',
      value: isLoading ? '—' : systemInfo?.ncpu?.toString() ?? '—',
      icon: Network,
      color: 'bg-orange-500',
    },
  ]

  // Handle retry
  const handleRetry = () => {
    refetchInfo()
    refetchVersion()
  }

  return (
    <PageShell title="Dashboard" description="Docker environment overview">
      {/* Error state */}
      {isError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-sm text-red-700">
                Failed to load Docker system info:{' '}
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1 rounded bg-red-100 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-200"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, subtext, icon: Icon, color }) => (
          <div key={label} className="rounded-lg bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className={`rounded-lg ${color} p-3`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{label}</p>
                {isLoading ? (
                  <div className="mt-1 h-8 w-16 animate-pulse rounded bg-gray-200" />
                ) : (
                  <>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                    {subtext && <p className="text-xs text-gray-500">{subtext}</p>}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* System info */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Docker info */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Server className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Docker Info</h2>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Docker Version</span>
                <span className="font-medium text-gray-900">
                  {systemVersion?.version ?? systemInfo?.server_version ?? '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">API Version</span>
                <span className="font-medium text-gray-900">
                  {systemVersion?.api_version ?? '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">OS/Arch</span>
                <span className="font-medium text-gray-900">
                  {systemInfo
                    ? `${systemInfo.operating_system} / ${systemInfo.architecture}`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Kernel Version</span>
                <span className="font-medium text-gray-900">
                  {systemInfo?.kernel_version ?? '—'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* System status */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">System Status</h2>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Memory</span>
                <span className="font-medium text-gray-900">
                  {systemInfo ? formatBytes(systemInfo.mem_total) : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">CPUs</span>
                <span className="font-medium text-gray-900">{systemInfo?.ncpu ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Storage Driver</span>
                <span className="font-medium text-gray-900">{systemInfo?.driver ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Docker Root Dir</span>
                <span className="max-w-[200px] truncate font-medium text-gray-900" title={systemInfo?.docker_root_dir}>
                  {systemInfo?.docker_root_dir ?? '—'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
