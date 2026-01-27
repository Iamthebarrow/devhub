import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  /** Message to display while loading */
  message?: string
  /** Size of the spinner: sm | md | lg */
  size?: 'sm' | 'md' | 'lg'
  /** Whether to show a full-page centered loading state */
  fullPage?: boolean
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
}

/**
 * Reusable loading state component.
 * Displays a spinner with optional message.
 */
export function LoadingState({
  message = 'Loading...',
  size = 'md',
  fullPage = false,
}: LoadingStateProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
      <Loader2
        className={`${sizeClasses[size]} animate-spin text-blue-600`}
        aria-hidden="true"
      />
      {message && <p className="text-sm text-gray-500">{message}</p>}
      <span className="sr-only">{message}</span>
    </div>
  )

  if (fullPage) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">{content}</div>
    )
  }

  return content
}
