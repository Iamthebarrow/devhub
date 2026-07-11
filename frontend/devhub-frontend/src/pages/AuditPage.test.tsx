import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { AuditPage } from './AuditPage'
import { useAuthStore } from '../features/auth'
import { useAuditFilterStore } from '../features/audit'
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

// Mock URL.createObjectURL / revokeObjectURL for CSV export tests
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
const mockRevokeObjectURL = vi.fn()
URL.createObjectURL = mockCreateObjectURL as unknown as typeof URL.createObjectURL
URL.revokeObjectURL = mockRevokeObjectURL as unknown as typeof URL.revokeObjectURL

// Helper to inspect current URL in tests
function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

// Helper to render with required providers (MemoryRouter for URL param isolation)
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

const renderWithProviders = (ui: React.ReactNode, { initialEntries = ['/audit'] } = {}) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the Zustand filter store between tests
    useAuditFilterStore.setState({
      status: '',
      action: '',
      search: '',
      from: '',
      to: '',
      page: 1,
      visibleColumns: ['time', 'status', 'action', 'resource', 'actor', 'requestId'],
    })
  })

  // ===========================================================================
  // Phase 2 Tests (preserved)
  // ===========================================================================

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

      expect(screen.getByLabelText('From')).toBeInTheDocument()
      expect(screen.getByLabelText('To')).toBeInTheDocument()
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

  // ===========================================================================
  // Phase 3 Tests
  // ===========================================================================

  describe('Phase 3 — quick filter chips', () => {
    beforeEach(() => {
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'admin', roles: ['admin'] },
      })
    })

    it('renders quick filter chips', () => {
      renderWithProviders(<AuditPage />)

      expect(screen.getByText('Errors only')).toBeInTheDocument()
      expect(screen.getByText('Last 24h')).toBeInTheDocument()
      expect(screen.getByText('Last 7 days')).toBeInTheDocument()
      expect(screen.getByText('Containers')).toBeInTheDocument()
      expect(screen.getByText('Auth events')).toBeInTheDocument()
    })

    it('clicking "Errors only" chip activates it and filters events', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AuditPage />)

      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      const chip = screen.getByText('Errors only')
      await user.click(chip)

      // Should filter to error events only
      await waitFor(() => {
        expect(screen.getByText('container.restart')).toBeInTheDocument()
      })
      expect(screen.queryByText('container.start')).not.toBeInTheDocument()

      // Chip should be active (aria-pressed)
      expect(chip).toHaveAttribute('aria-pressed', 'true')
    })

    it('clicking active chip deactivates it', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AuditPage />)

      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      const chip = screen.getByText('Errors only')

      // Activate
      await user.click(chip)
      await waitFor(() => {
        expect(chip).toHaveAttribute('aria-pressed', 'true')
      })

      // Deactivate
      await user.click(chip)
      await waitFor(() => {
        expect(chip).toHaveAttribute('aria-pressed', 'false')
      })

      // All events should be visible again
      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })
    })
  })

  describe('Phase 3 — URL query string sync', () => {
    beforeEach(() => {
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'admin', roles: ['admin'] },
      })
    })

    it('setting status filter updates URL', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AuditPage />)

      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      const statusSelect = screen.getByLabelText(/status filter/i)
      await user.selectOptions(statusSelect, 'error')

      // URL should now include status=error
      await waitFor(() => {
        expect(screen.getByTestId('location-search')).toHaveTextContent('status=error')
      })
    })

    it('loading page with URL params applies filters', async () => {
      renderWithProviders(<AuditPage />, {
        initialEntries: ['/audit?status=error'],
      })

      // Should only show error events
      await waitFor(() => {
        expect(screen.getByText('container.restart')).toBeInTheDocument()
      })

      // Success events should not appear
      expect(screen.queryByText('container.start')).not.toBeInTheDocument()

      // Status select should reflect URL value
      const statusSelect = screen.getByLabelText(/status filter/i) as HTMLSelectElement
      expect(statusSelect.value).toBe('error')
    })
  })

  describe('Phase 3 — export CSV', () => {
    beforeEach(() => {
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'admin', roles: ['admin'] },
      })
    })

    it('renders Export CSV button when events exist', async () => {
      renderWithProviders(<AuditPage />)

      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument()
    })

    it('export CSV produces blob with correct header row', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AuditPage />)

      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      const exportBtn = screen.getByRole('button', { name: /export csv/i })
      await user.click(exportBtn)

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob
      // jsdom's Blob doesn't support .text() — use FileReader instead
      const text = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsText(blob)
      })

      // Check header row
      expect(text.startsWith('created_at,status,action,resource_type,resource_id,resource_name,actor,request_id')).toBe(true)

      // Check it contains event data
      expect(text).toContain('container.start')
      expect(text).toContain('admin')
      expect(text).toContain('success')
    })

    it('hides Export CSV button on 404', async () => {
      server.use(
        http.get(`${API_BASE_URL}/audit/events/`, () => {
          return HttpResponse.json(
            { error: { code: 'NOT_FOUND', message: 'Not Found' } },
            { status: 404 }
          )
        })
      )

      renderWithProviders(<AuditPage />)

      await waitFor(
        () => {
          expect(screen.getByText(/audit is not available/i)).toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      expect(screen.queryByRole('button', { name: /export csv/i })).not.toBeInTheDocument()
    })
  })

  describe('Phase 3 — deep-link to event', () => {
    beforeEach(() => {
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'admin', roles: ['admin'] },
      })
    })

    it('opens drawer when ?event= matches an event in the list', async () => {
      renderWithProviders(<AuditPage />, {
        initialEntries: ['/audit?event=a1b2c3d4-0001-4000-8000-000000000001'],
      })

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      // Drawer should auto-open with event details
      await waitFor(() => {
        expect(screen.getByText('Event Details')).toBeInTheDocument()
      })
    })

    it('shows "Event not on this page" when ?event= does not match', async () => {
      renderWithProviders(<AuditPage />, {
        initialEntries: ['/audit?event=nonexistent-id-000'],
      })

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      // Should show hint message
      await waitFor(() => {
        expect(screen.getByText(/event not on this page/i)).toBeInTheDocument()
      })
    })
  })

  describe('Phase 3 — column toggles', () => {
    beforeEach(() => {
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'admin', roles: ['admin'] },
      })
    })

    it('renders Columns toggle button', async () => {
      renderWithProviders(<AuditPage />)

      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /toggle columns/i })).toBeInTheDocument()
    })

    it('shows column toggle menu on click', async () => {
      const user = userEvent.setup()
      renderWithProviders(<AuditPage />)

      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /toggle columns/i }))

      // Should show toggleable columns in the menu (Request ID also appears in table header)
      const menuLabels = screen.getAllByText('Request ID')
      expect(menuLabels.length).toBeGreaterThanOrEqual(2) // table header + menu
      expect(screen.getByText('IP Address')).toBeInTheDocument()
      expect(screen.getByText('User Agent')).toBeInTheDocument()
    })
  })

  describe('Phase 3 — error-first highlighting', () => {
    beforeEach(() => {
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'admin', roles: ['admin'] },
      })
    })

    it('error rows have red left border styling', async () => {
      renderWithProviders(<AuditPage />)

      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      // Find the error event row (container.restart has status=error)
      const errorAction = screen.getByText('container.restart')
      const errorRow = errorAction.closest('tr')
      expect(errorRow).toHaveClass('border-l-4')
      expect(errorRow).toHaveClass('border-l-red-400')
    })
  })

  describe('Phase 3 — resource ID copy', () => {
    beforeEach(() => {
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'admin', roles: ['admin'] },
      })
    })

    it('renders copy resource ID buttons', async () => {
      renderWithProviders(<AuditPage />)

      await waitFor(() => {
        expect(screen.getByText('container.start')).toBeInTheDocument()
      })

      const copyResourceButtons = screen.getAllByTitle('Copy resource ID')
      expect(copyResourceButtons.length).toBeGreaterThan(0)
    })
  })
})
