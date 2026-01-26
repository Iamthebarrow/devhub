import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Box,
  HardDrive,
  Database,
  Network,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/containers', icon: Box, label: 'Containers' },
  { to: '/images', icon: HardDrive, label: 'Images' },
  { to: '/volumes', icon: Database, label: 'Volumes' },
  { to: '/networks', icon: Network, label: 'Networks' },
  { to: '/audit', icon: FileText, label: 'Audit Log' },
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-full bg-slate-800 text-slate-200 transition-all duration-300 z-40',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-slate-700 px-4">
        {!collapsed && <span className="text-xl font-bold text-white">DevHub</span>}
        <button
          onClick={onToggle}
          className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="mt-4 flex flex-col gap-1 px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              )
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={20} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
