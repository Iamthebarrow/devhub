import type { ReactNode } from 'react'

interface PageShellProps {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

/**
 * Page wrapper component that provides consistent page structure.
 * - Title and optional description
 * - Optional action buttons in the header
 * - Content area
 */
export function PageShell({ title, description, actions, children }: PageShellProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
        {actions && <div className="mt-4 flex gap-2 sm:mt-0">{actions}</div>}
      </div>

      {/* Page content */}
      <div>{children}</div>
    </div>
  )
}
