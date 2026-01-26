import { useNavigate } from 'react-router-dom'
import { User, LogOut, Menu } from 'lucide-react'
import clsx from 'clsx'
import { useAuthStore } from '../../features/auth'
import { logout } from '../../api/auth'

interface TopbarProps {
  sidebarCollapsed: boolean
  onMenuClick: () => void
}

/**
 * Top navigation bar.
 *
 * Shows:
 * - Mobile menu toggle
 * - User info (username and role badges)
 * - Logout button
 */
export function Topbar({ sidebarCollapsed, onMenuClick }: TopbarProps) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  const handleLogout = async () => {
    try {
      // Call logout API to clear refresh token cookie
      await logout()
    } catch {
      // Ignore errors - we're clearing local state anyway
    } finally {
      // Clear local auth state and redirect to login
      clearAuth()
      navigate('/login', { replace: true })
    }
  }

  return (
    <header
      className={clsx(
        'fixed top-0 right-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 transition-all duration-300',
        sidebarCollapsed ? 'left-16' : 'left-64'
      )}
    >
      {/* Mobile menu button - visible on small screens */}
      <button
        onClick={onMenuClick}
        className="rounded p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
        aria-label="Toggle menu"
      >
        <Menu size={20} />
      </button>

      {/* Page area - can be used for breadcrumbs or title */}
      <div className="flex-1" />

      {/* User section */}
      <div className="flex items-center gap-4">
        {/* Role badges */}
        {user?.roles && user.roles.length > 0 && (
          <div className="hidden items-center gap-1 sm:flex">
            {user.roles.map((role) => (
              <span
                key={role}
                className={clsx(
                  'rounded-full px-3 py-1 text-xs font-medium',
                  getRoleBadgeStyle(role)
                )}
              >
                {role}
              </span>
            ))}
          </div>
        )}

        {/* User info */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200">
            <User size={16} className="text-gray-600" />
          </div>
          <span className="hidden text-sm font-medium text-gray-700 sm:block">
            {user?.username || 'Unknown'}
          </span>
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Logout"
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}

function getRoleBadgeStyle(role: string): string {
  const lowerRole = role.toLowerCase()
  if (lowerRole === 'admin') {
    return 'bg-red-100 text-red-700'
  }
  if (lowerRole === 'operator') {
    return 'bg-amber-100 text-amber-700'
  }
  if (lowerRole === 'viewer') {
    return 'bg-green-100 text-green-700'
  }
  // Default style for unknown roles
  return 'bg-blue-100 text-blue-700'
}
