import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthBootstrap } from '../features/auth'

interface ProvidersProps {
  children: ReactNode
}

/**
 * App providers wrapper.
 *
 * Includes:
 * - BrowserRouter for routing
 * - AuthBootstrap for auth boot flow (refresh + me on startup)
 *
 * Future phases will add: QueryClientProvider, etc.
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <BrowserRouter>
      <AuthBootstrap>{children}</AuthBootstrap>
    </BrowserRouter>
  )
}
