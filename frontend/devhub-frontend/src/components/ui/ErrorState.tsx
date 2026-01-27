import { AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorStateProps {
  /** Error title */
  title?: string
  /** Error message to display */
  message: string
  /** Callback for retry button */
  onRetry?: () => void
  /** Label for retry button */
  retryLabel?: string
  /** Whether to show a full-page centered error state */
  fullPage?: boolean
}

/**
 * Reusable error state component.
 * Displays an error message with optional retry button.
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  fullPage = false,
}: ErrorStateProps) {
  const content = (
    <div
      className="rounded-lg border border-red-200 bg-red-50 p-4"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
        <div className="flex-1">
          <h3 className="font-medium text-red-800">{title}</h3>
          <p className="mt-1 text-sm text-red-600">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              type="button"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {retryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )

  if (fullPage) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4">
        <div className="w-full max-w-md">{content}</div>
      </div>
    )
  }

  return content
}
