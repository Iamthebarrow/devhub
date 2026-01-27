import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  /** Icon to display */
  icon?: LucideIcon
  /** Title for the empty state */
  title: string
  /** Description text */
  description?: string
  /** Optional action button or element */
  action?: ReactNode
}

/**
 * Reusable empty state component.
 * Displays when there's no data to show.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div
      className="rounded-lg bg-white p-12 text-center shadow-sm"
      role="status"
      aria-live="polite"
    >
      <Icon className="mx-auto h-12 w-12 text-gray-400" aria-hidden="true" />
      <h3 className="mt-4 text-lg font-medium text-gray-900">{title}</h3>
      {description && <p className="mt-2 text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
