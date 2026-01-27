import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'react-hot-toast'
import { AuthBootstrap } from '../features/auth'

interface ProvidersProps {
  children: ReactNode
}

// Create a QueryClient with sensible defaults for data fetching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 seconds - data is fresh for this duration
      gcTime: 5 * 60_000, // 5 minutes - cache time before garbage collection
      retry: 1, // Retry failed requests once
      refetchOnWindowFocus: false, // Disable auto-refetch on window focus
    },
  },
})

/**
 * App providers wrapper.
 *
 * Includes:
 * - QueryClientProvider for TanStack Query (server state management)
 * - BrowserRouter for routing
 * - AuthBootstrap for auth boot flow (refresh + me on startup)
 * - Toaster for toast notifications (Phase 4)
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthBootstrap>{children}</AuthBootstrap>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            style: {
              background: '#059669',
            },
          },
          error: {
            duration: 5000,
            style: {
              background: '#dc2626',
            },
          },
        }}
      />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
