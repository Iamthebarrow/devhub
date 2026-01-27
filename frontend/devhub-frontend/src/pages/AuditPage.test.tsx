import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { AuditPage } from './AuditPage'
import { useAuthStore } from '../features/auth'
import { server } from '../test/mocks/server'
import { API_BASE_URL } from '../api/client'

// Helper to render with required providers
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

const renderWithProviders = () => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuditPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AuditPage', () => {
  beforeEach(() => {
    // Set authenticated state with admin role
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'test-token',
      user: { id: 1, username: 'testadmin', roles: ['admin'] },
    })
  })

  describe('when API returns data', () => {
    it('renders audit events from API', async () => {
      renderWithProviders()

      // Wait for audit events to load - look for specific action that's in mock data
      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      // Check that events are displayed - operator1 appears twice, so use getAllByText
      expect(screen.getAllByText('operator1').length).toBeGreaterThan(0)
      expect(screen.getByText('container.stop')).toBeInTheDocument()
    })

    it('displays event statuses', async () => {
      renderWithProviders()

      // Wait for audit events to load
      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      // Check for success and failed status badges
      const successBadges = screen.getAllByText('success')
      const failedBadges = screen.getAllByText('failed')

      expect(successBadges.length).toBeGreaterThan(0)
      expect(failedBadges.length).toBeGreaterThan(0)
    })

    it('displays event resources', async () => {
      renderWithProviders()

      // Wait for audit events to load
      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      // Check for resources
      expect(screen.getByText('nginx-proxy')).toBeInTheDocument()
      expect(screen.getByText('redis-cache')).toBeInTheDocument()
    })

    it('shows filter controls', async () => {
      renderWithProviders()

      // Wait for audit events to load
      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      // Check for filter dropdowns - look for "All Actions" option
      expect(screen.getByText('All Actions')).toBeInTheDocument()
      expect(screen.getByText('All Statuses')).toBeInTheDocument()
    })
  })

  describe('when API returns 404', () => {
    beforeEach(() => {
      // Override the audit events handler to return 404
      // Use a wildcard to match with or without query string
      server.use(
        http.get(`${API_BASE_URL}/audit/events/`, () => {
          return new HttpResponse(
            JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not Found' } }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          )
        })
      )
    })

    it('shows "Audit Coming Soon" message gracefully', async () => {
      renderWithProviders()

      // Wait for error state to show - increase timeout since queries may retry
      await waitFor(
        () => {
          expect(screen.getByText(/audit log coming soon/i)).toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      // Should show the coming soon message, not a generic error
      expect(screen.getByText(/not yet available/i)).toBeInTheDocument()
      expect(screen.queryByText(/failed to load audit events/i)).not.toBeInTheDocument()
    })

    it('does not crash on 404', async () => {
      // This test verifies the page renders without throwing
      expect(() => renderWithProviders()).not.toThrow()

      // Wait for the coming soon message
      await waitFor(
        () => {
          expect(screen.getByText(/audit log coming soon/i)).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })
  })

  describe('when API returns other errors', () => {
    beforeEach(() => {
      // Override the audit events handler to return 500
      server.use(
        http.get(`${API_BASE_URL}/audit/events/`, () => {
          return new HttpResponse(
            JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        })
      )
    })

    it('shows error state for non-404 errors', async () => {
      renderWithProviders()

      // Wait for error state to show - increase timeout since queries may retry
      await waitFor(
        () => {
          expect(screen.getByText(/failed to load audit events/i)).toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      // Should show generic error, not coming soon
      expect(screen.queryByText(/audit log coming soon/i)).not.toBeInTheDocument()
    })

    it('shows try again button', async () => {
      renderWithProviders()

      // Wait for error state to show
      await waitFor(
        () => {
          expect(screen.getByText(/failed to load audit events/i)).toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      expect(screen.getByText(/try again/i)).toBeInTheDocument()
    })
  })
})
