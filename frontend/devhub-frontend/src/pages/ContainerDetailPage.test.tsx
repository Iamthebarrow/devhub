import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ContainerDetailPage } from './ContainerDetailPage'
import { useAuthStore } from '../features/auth'
import { mockContainers } from '../test/mocks/handlers'

// Use vi.hoisted to define mocks that can be used in vi.mock factory
const { mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
  Toaster: () => null,
}))

// Mock clipboard API
const mockWriteText = vi.fn()
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
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

const renderWithProviders = (containerId: string) => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/containers/${containerId}`]}>
        <Routes>
          <Route path="/containers/:id" element={<ContainerDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ContainerDetailPage', () => {
  const runningContainer = mockContainers[0] // nginx-proxy, running
  const exitedContainer = mockContainers[2] // redis-cache, exited

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
    mockWriteText.mockResolvedValue(undefined)
  })

  describe('with admin/operator role', () => {
    beforeEach(() => {
      // Set authenticated state with admin role (can operate containers)
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'testuser', roles: ['admin'] },
      })
    })

    it('renders container name and details', async () => {
      renderWithProviders(runningContainer.id)

      // Wait for container name to appear (appears in both title and details)
      await waitFor(() => {
        expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
      })

      expect(screen.getByText('nginx:latest')).toBeInTheDocument()
      expect(screen.getByText('running')).toBeInTheDocument()
    })

    it('shows action buttons for admin user', async () => {
      renderWithProviders(runningContainer.id)

      await waitFor(() => {
        expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
      })

      // Admin should see Stop and Restart buttons (Start hidden when running)
      expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /restart/i })).toBeInTheDocument()
    })

    it('shows Start button for exited container', async () => {
      renderWithProviders(exitedContainer.id)

      await waitFor(() => {
        expect(screen.getAllByText('redis-cache').length).toBeGreaterThan(0)
      })

      // Should see Start and Restart buttons (Stop hidden when exited)
      // Use exact match to avoid "restart" matching "start"
      expect(screen.getByRole('button', { name: /^start$/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^restart$/i })).toBeInTheDocument()
    })

    it('shows confirm dialog when clicking Restart', async () => {
      const user = userEvent.setup()
      renderWithProviders(runningContainer.id)

      await waitFor(() => {
        expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
      })

      // Click Restart button
      const restartButton = screen.getByRole('button', { name: /restart/i })
      await user.click(restartButton)

      // Confirm dialog should appear
      await waitFor(() => {
        expect(screen.getByText('Restart Container')).toBeInTheDocument()
        expect(screen.getByText(/are you sure you want to restart/i)).toBeInTheDocument()
      })

      // Should have Cancel and Confirm buttons
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    })

    it('renders logs panel', async () => {
      renderWithProviders(runningContainer.id)

      await waitFor(() => {
        expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
      })

      // Logs section should be visible
      expect(screen.getByText('Logs')).toBeInTheDocument()

      // Tail selector should be visible
      expect(screen.getByLabelText(/tail/i)).toBeInTheDocument()

      // Auto-refresh toggle should be visible
      expect(screen.getByText(/auto-refresh/i)).toBeInTheDocument()
    })

    it('renders logs content from API', async () => {
      renderWithProviders(runningContainer.id)

      // Wait for logs to load
      await waitFor(() => {
        expect(screen.getByText(/nginx-proxy started/i)).toBeInTheDocument()
      })
    })

    it('has copy logs button', async () => {
      renderWithProviders(runningContainer.id)

      await waitFor(() => {
        expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
      })

      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
    })
  })

  describe('with viewer role', () => {
    beforeEach(() => {
      // Set authenticated state with viewer role (cannot operate containers)
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'viewer', roles: ['viewer'] },
      })
    })

    it('renders container details', async () => {
      renderWithProviders(runningContainer.id)

      await waitFor(() => {
        expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
      })

      expect(screen.getByText('nginx:latest')).toBeInTheDocument()
    })

    it('does NOT show Start/Stop/Restart buttons for viewer', async () => {
      renderWithProviders(runningContainer.id)

      await waitFor(() => {
        expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
      })

      // Viewer should NOT see action buttons
      expect(screen.queryByRole('button', { name: /start/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /restart/i })).not.toBeInTheDocument()
    })

    it('can still view logs', async () => {
      renderWithProviders(runningContainer.id)

      await waitFor(() => {
        expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
      })

      // Logs section should still be visible for viewers
      expect(screen.getByText('Logs')).toBeInTheDocument()

      // Wait for logs to load
      await waitFor(() => {
        expect(screen.getByText(/nginx-proxy started/i)).toBeInTheDocument()
      })
    })
  })

  describe('with operator role', () => {
    beforeEach(() => {
      // Set authenticated state with operator role
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'operator', roles: ['operator'] },
      })
    })

    it('shows action buttons for operator user', async () => {
      renderWithProviders(runningContainer.id)

      await waitFor(() => {
        expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
      })

      // Operator should see Stop and Restart buttons
      expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /restart/i })).toBeInTheDocument()
    })
  })

  describe('container info sections', () => {
    beforeEach(() => {
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'testuser', roles: ['admin'] },
      })
    })

    it('displays ports information', async () => {
      renderWithProviders(runningContainer.id)

      await waitFor(() => {
        expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
      })

      // Should show ports
      expect(screen.getByText(/8080:80\/tcp/)).toBeInTheDocument()
    })

    it('displays network information', async () => {
      renderWithProviders(runningContainer.id)

      await waitFor(() => {
        expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
      })

      // Should show network name (appears in both Network Mode and Networks sections)
      expect(screen.getAllByText('bridge').length).toBeGreaterThan(0)

      // Should show IP address
      expect(screen.getByText(/172\.17\.0\.2/)).toBeInTheDocument()
    })

    it('displays labels', async () => {
      renderWithProviders(runningContainer.id)

      await waitFor(() => {
        expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
      })

      // Should show label
      expect(screen.getByText(/com\.example\.env/)).toBeInTheDocument()
      expect(screen.getByText(/production/)).toBeInTheDocument()
    })

    it('has back to containers link', async () => {
      renderWithProviders(runningContainer.id)

      await waitFor(() => {
        expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
      })

      const backLink = screen.getByRole('link', { name: /back to containers/i })
      expect(backLink).toBeInTheDocument()
      expect(backLink).toHaveAttribute('href', '/containers')
    })
  })

  describe('logs panel polling behavior', () => {
    beforeEach(() => {
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'testuser', roles: ['admin'] },
      })
    })

    it('has auto-refresh toggle that is off by default', async () => {
      renderWithProviders(runningContainer.id)

      await waitFor(() => {
        expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
      })

      // Auto-refresh checkbox should be unchecked by default
      const autoRefreshCheckbox = screen.getByRole('checkbox')
      expect(autoRefreshCheckbox).not.toBeChecked()
    })

    it('can toggle auto-refresh on', async () => {
      const user = userEvent.setup()
      renderWithProviders(runningContainer.id)

      await waitFor(() => {
        expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
      })

      const autoRefreshCheckbox = screen.getByRole('checkbox')
      await user.click(autoRefreshCheckbox)

      expect(autoRefreshCheckbox).toBeChecked()
    })

    it('can change tail count', async () => {
      const user = userEvent.setup()
      renderWithProviders(runningContainer.id)

      await waitFor(() => {
        expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
      })

      const tailSelect = screen.getByLabelText(/tail/i)
      await user.selectOptions(tailSelect, '500')

      expect(tailSelect).toHaveValue('500')
    })
  })

  describe('Copy button functionality', () => {
    beforeEach(() => {
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'testuser', roles: ['admin'] },
      })
    })

    it('Copy button is always enabled (has fallback for empty logs)', async () => {
      renderWithProviders(runningContainer.id)

      await waitFor(() => {
        expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
      })

      // Copy button should be enabled - it has a fallback to copy container name + id
      const copyButton = screen.getByRole('button', { name: /copy/i })
      expect(copyButton).not.toBeDisabled()
    })

    it('Copy button shows success toast when clipboard succeeds', async () => {
      const user = userEvent.setup()
      renderWithProviders(runningContainer.id)

      // Wait for logs to load
      await waitFor(() => {
        expect(screen.getByText(/nginx-proxy started/i)).toBeInTheDocument()
      })

      // Click Copy button
      const copyButton = screen.getByRole('button', { name: /copy/i })
      await user.click(copyButton)

      // Should show success toast (clipboard succeeded via mock or execCommand fallback)
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Copied to clipboard')
      })
    })
  })

  describe('Page-level Refresh button', () => {
    beforeEach(() => {
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'testuser', roles: ['admin'] },
      })
    })

    it('renders a page-level Refresh button with correct title', async () => {
      renderWithProviders(runningContainer.id)

      await waitFor(() => {
        expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
      })

      // Should have a Refresh button in the header area with the specific title
      const pageRefreshButton = screen.getByTitle('Refresh container details and logs')
      expect(pageRefreshButton).toBeInTheDocument()
      expect(pageRefreshButton).toHaveAttribute('aria-label')
    })

    it('page refresh button triggers refetch', async () => {
      const user = userEvent.setup()
      renderWithProviders(runningContainer.id)

      await waitFor(() => {
        expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
      })

      // Find the page-level Refresh button by title
      const pageRefreshButton = screen.getByTitle('Refresh container details and logs')
      await user.click(pageRefreshButton)

      // The button should trigger a refetch - verify by checking that toast was shown
      // (the success toast 'Refreshed' is shown after both refetches complete)
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith('Refreshed')
      })
    })
  })
})
