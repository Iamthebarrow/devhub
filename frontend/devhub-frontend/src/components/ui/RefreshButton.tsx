import { RefreshCw } from 'lucide-react'

/**
 * Reusable refresh button with loading state.
 * Phase 1: UX bugfixes - consistent refresh pattern across pages.
 *
 * DEFAULT: Shows spinner when isRefreshing, disabled during refresh.
 */
interface RefreshButtonProps {
  onRefresh: () => void
  isRefreshing: boolean
  label?: string
  className?: string
}

export function RefreshButton({
  onRefresh,
  isRefreshing,
  label = 'Refresh',
  className = '',
}: RefreshButtonProps) {
  return (
    <button
      onClick={onRefresh}
      disabled={isRefreshing}
      className={`flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      title={label}
      aria-label={isRefreshing ? 'Refreshing...' : label}
    >
      <RefreshCw
        className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
        aria-hidden="true"
      />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
