import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { AuditPage } from './AuditPage'
import { useAuthStore } from '../features/auth'
import { server } from '../test/mocks/server'
import { API_BASE_URL } from '../api/client'

// Use vi.hoisted to define mocks that can be used in vi.mock factory
const { mockToastSuccess } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: mockToastSuccess,
    error: vi.fn(),
  },
  toast: {
    success: mockToastSuccess,
    error: vi.fn(),
  },
  Toaster: () => null,
}))

// Mock clipboard API
const mockWriteText = vi.fn().mockResolvedValue(undefined)
Object.assign(navigator, {
  clipboard: { writeText: mockWriteText },
})

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

const renderWithProviders = (ui: React.ReactNode) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  )
}

describe('AuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('with admin role', () => {
    beforeEach(() => {
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'admin', roles: ['admin'] },
      })
    })

    it('renders page title and description', async () => {
      renderWithProviders(<AuditPage />)

      expect(screen.getByRole('heading', { name: /audit/i })).toBeInTheDocument()
      expect(screen.getByText(/track actions and system events/i)).toBeInTheDocument()
    })

    it('renders audit events from API', async () => {
      renderWithProviders(<AuditPage />)

      // Wait for events to load
      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      // Check other events are rendered
      expect(screen.getByText('container.stop')).toBeInTheDocument()
      expect(screen.getByText('image.pull')).toBeInTheDocument()
      expect(screen.getByText('auth.login')).toBeInTheDocument()
      expect(screen.getByText('container.restart')).toBeInTheDocument()
    })

    it('renders result count', async () => {
      renderWithProviders(<AuditPage />)

      await waitFor(() => {
        expect(screen.getByText(/5 results/)).toBeInTheDocument()
      })
    })

    it('renders filter controls', () => {
      renderWithProviders(<AuditPage />)

      expect(screen.getByPlaceholderText(/search events/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/filter by action/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/status filter/i)).toBeInTheDocument()
    })

    it('renders date range inputs', () => {
      renderWithProviders(<AuditPage />)

      expect(screen.getByLabelText(/from/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/to/i)).toBeInTheDocument()
    })

    it('renders refresh button', async () => {
      renderWithProviders(<AuditPage />)

      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
    })

    it('renders status badges (success and error)', async () => {
      renderWithProviders(<AuditPage />)

      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      // Should show success and error badges
      const successBadges = screen.getAllByText('success')
      expect(successBadges.length).toBeGreaterThan(0)
      expect(screen.getByText('error')).toBeInTheDocument()
    })

    it('renders actor names from mock data', async () => {
      renderWithProviders(<AuditPage />)

      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      // Actor names from mock data
      expect(screen.getAllByText('admin').length).toBeGreaterThan(0)
      expect(screen.getAllByText('operator1').length).toBeGreaterThan(0)
      expect(screen.getByText('viewer1')).toBeInTheDocument()
    })

    it('renders resource info', async () => {
      renderWithProviders(<AuditPage />)

      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      // Should show resource names
      expect(screen.getByText('nginx-proxy')).toBeInTheDocument()
      expect(screen.getByText('redis-cache')).toBeInTheDocument()
    })

    it('renders request ID with copy button', async () => {
      renderWithProviders(<AuditPage />)

      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      // Should have copy buttons for request IDs
      const copyButtons = screen.getAllByTitle('Copy request ID')
      expect(copyButtons.length).toBeGreaterThan(0)
    })

    it('filters by status', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AuditPage />)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      // Filter by error status
      const statusSelect = screen.getByLabelText(/status filter/i)
      await user.selectOptions(statusSelect, 'error')

      // Should show only error events
      await waitFor(() => {
        expect(screen.getByText('container.restart')).toBeInTheDocument()
      })

      // Success events should be filtered out
      await waitFor(() => {
        expect(screen.queryByText('container.start')).not.toBeInTheDocument()
      })
    })

    it('shows clear filters button when filters active', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AuditPage />)

      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      // No clear button initially
      expect(screen.queryByText('Clear filters')).not.toBeInTheDocument()

      // Set a filter
      const statusSelect = screen.getByLabelText(/status filter/i)
      await user.selectOptions(statusSelect, 'error')

      // Clear button should appear
      await waitFor(() => {
        expect(screen.getByText('Clear filters')).toBeInTheDocument()
      })
    })
  })

  describe('with viewer role (not authorized)', () => {
    beforeEach(() => {
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 2, username: 'viewer', roles: ['viewer'] },
      })
    })

    it('shows Not Authorized state', () => {
      renderWithProviders(<AuditPage />)

      expect(screen.getByText('Not Authorized')).toBeInTheDocument()
      expect(screen.getByText(/do not have permission/i)).toBeInTheDocument()
    })

    it('shows link back to Dashboard', () => {
      renderWithProviders(<AuditPage />)

      const link = screen.getByRole('link', { name: /back to dashboard/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/')
    })

    it('does NOT render filter controls', () => {
      renderWithProviders(<AuditPage />)

      expect(screen.queryByPlaceholderText(/search events/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/status filter/i)).not.toBeInTheDocument()
    })
  })

  describe('with operator role', () => {
    beforeEach(() => {
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 3, username: 'operator', roles: ['operator'] },
      })
    })

    it('renders audit events (operator has access)', async () => {
      renderWithProviders(<AuditPage />)

      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })
    })
  })

  describe('404 endpoint handling', () => {
    beforeEach(() => {
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'admin', roles: ['admin'] },
      })

      // Override handler to return 404
      server.use(
        http.get(`${API_BASE_URL}/audit/events/`, () => {
          return HttpResponse.json(
            { error: { code: 'NOT_FOUND', message: 'Not Found' } },
            { status: 404 }
          )
        })
      )
    })

    it('shows "Audit not available" on 404', async () => {
      renderWithProviders(<AuditPage />)

      await waitFor(
        () => {
          expect(screen.getByText(/audit is not available on this server yet/i)).toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      expect(screen.getByText(/ask an admin to enable the audit endpoint/i)).toBeInTheDocument()
    })

    it('does not show error state on 404', async () => {
      renderWithProviders(<AuditPage />)

      await waitFor(
        () => {
          expect(screen.getByText(/audit is not available/i)).toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument()
    })
  })

  describe('500 error handling', () => {
    beforeEach(() => {
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'admin', roles: ['admin'] },
      })

      // Override handler to return 500
      server.use(
        http.get(`${API_BASE_URL}/audit/events/`, () => {
          return HttpResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
            { status: 500 }
          )
        })
      )
    })

    it('shows error state with retry for non-404 errors', async () => {
      renderWithProviders(<AuditPage />)

      await waitFor(
        () => {
          expect(screen.getByText(/failed to load audit events/i)).toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      expect(screen.getByText(/try again/i)).toBeInTheDocument()
      expect(screen.queryByText(/audit is not available/i)).not.toBeInTheDocument()
    })
  })

  describe('copy request ID', () => {
    beforeEach(() => {
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'admin', roles: ['admin'] },
      })
    })

    it('clicking copy button triggers clipboard and shows toast', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AuditPage />)

      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      // Click the first copy request ID button
      const copyButtons = screen.getAllByTitle('Copy request ID')
      await user.click(copyButtons[0])

      // Should show toast
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalled()
      })
    })
  })
})
