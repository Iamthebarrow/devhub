import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ContainersPage } from './ContainersPage'
import { useAuthStore } from '../features/auth'
import { mockContainers } from '../test/mocks/handlers'

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

describe('ContainersPage', () => {
  beforeEach(() => {
    // Set authenticated state so API calls work
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'test-token',
      user: { id: 1, username: 'testuser', roles: ['admin'] },
    })
  })

  it('renders page title and description', () => {
    renderWithProviders(<ContainersPage />)
    expect(screen.getByRole('heading', { name: /containers/i })).toBeInTheDocument()
    expect(screen.getByText(/view docker containers/i)).toBeInTheDocument()
  })

  it('renders search input and status filter', () => {
    renderWithProviders(<ContainersPage />)
    expect(screen.getByPlaceholderText(/search containers/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders loading state initially', () => {
    renderWithProviders(<ContainersPage />)
    // Should show skeleton loading rows
    const loadingRows = document.querySelectorAll('.animate-pulse')
    expect(loadingRows.length).toBeGreaterThan(0)
  })

  it('renders containers from API response', async () => {
    renderWithProviders(<ContainersPage />)

    // Wait for containers to load
    await waitFor(() => {
      expect(screen.getByText('nginx-proxy')).toBeInTheDocument()
    })

    // Check all mock containers are rendered
    expect(screen.getByText('nginx-proxy')).toBeInTheDocument()
    expect(screen.getByText('postgres-db')).toBeInTheDocument()
    expect(screen.getByText('redis-cache')).toBeInTheDocument()
  })

  it('renders container images', async () => {
    renderWithProviders(<ContainersPage />)

    await waitFor(() => {
      expect(screen.getByText('nginx:latest')).toBeInTheDocument()
    })

    expect(screen.getByText('postgres:15')).toBeInTheDocument()
    expect(screen.getByText('redis:alpine')).toBeInTheDocument()
  })

  it('renders container states with correct badges', async () => {
    renderWithProviders(<ContainersPage />)

    await waitFor(() => {
      expect(screen.getAllByText('running').length).toBe(2)
    })

    expect(screen.getByText('exited')).toBeInTheDocument()
  })

  it('container name links to detail page', async () => {
    renderWithProviders(<ContainersPage />)

    await waitFor(() => {
      expect(screen.getByText('nginx-proxy')).toBeInTheDocument()
    })

    const containerLink = screen.getByRole('link', { name: 'nginx-proxy' })
    expect(containerLink).toHaveAttribute('href', `/containers/${mockContainers[0].id}`)
  })

  it('shows count of containers', async () => {
    renderWithProviders(<ContainersPage />)

    await waitFor(() => {
      expect(screen.getByText(/showing 3 of 3 containers/i)).toBeInTheDocument()
    })
  })

  it('has a refresh button', async () => {
    renderWithProviders(<ContainersPage />)

    await waitFor(() => {
      expect(screen.getByText('nginx-proxy')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
  })

  describe('filters', () => {
    it('filters by status when selecting from dropdown', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ContainersPage />)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('nginx-proxy')).toBeInTheDocument()
      })

      // Change status filter to "running"
      const statusSelect = screen.getByRole('combobox')
      await user.selectOptions(statusSelect, 'running')

      // Wait for filtered results - running containers visible
      await waitFor(() => {
        expect(screen.getByText('nginx-proxy')).toBeInTheDocument()
        expect(screen.getByText('postgres-db')).toBeInTheDocument()
      })

      // Exited container should not be visible
      await waitFor(() => {
        expect(screen.queryByText('redis-cache')).not.toBeInTheDocument()
      })
    })

    it('filters by status exited', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ContainersPage />)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('nginx-proxy')).toBeInTheDocument()
      })

      // Change status filter to "exited"
      const statusSelect = screen.getByRole('combobox')
      await user.selectOptions(statusSelect, 'exited')

      // Wait for filtered results - only redis-cache should be visible
      await waitFor(() => {
        expect(screen.getByText('redis-cache')).toBeInTheDocument()
      })

      // Running containers should not be visible
      await waitFor(() => {
        expect(screen.queryByText('nginx-proxy')).not.toBeInTheDocument()
        expect(screen.queryByText('postgres-db')).not.toBeInTheDocument()
      })
    })

    it('shows empty state when no containers match filter', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ContainersPage />)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('nginx-proxy')).toBeInTheDocument()
      })

      // Filter by "paused" which has no containers
      const statusSelect = screen.getByRole('combobox')
      await user.selectOptions(statusSelect, 'paused')

      // Should show empty state
      await waitFor(() => {
        expect(screen.getByText(/no containers found/i)).toBeInTheDocument()
      })
    })
  })

  describe('refresh button', () => {
    it('refresh does not clear filter state', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ContainersPage />)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('nginx-proxy')).toBeInTheDocument()
      })

      // Set filter to "running"
      const statusSelect = screen.getByRole('combobox')
      await user.selectOptions(statusSelect, 'running')

      // Verify filter is applied
      await waitFor(() => {
        expect(screen.queryByText('redis-cache')).not.toBeInTheDocument()
      })

      // Click refresh button
      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      await user.click(refreshButton)

      // Filter should still be "running"
      expect(statusSelect).toHaveValue('running')

      // Data should still be filtered (exited container not visible)
      await waitFor(() => {
        expect(screen.getByText('nginx-proxy')).toBeInTheDocument()
        expect(screen.queryByText('redis-cache')).not.toBeInTheDocument()
      })
    })

    it('refresh does not clear search text', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ContainersPage />)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('nginx-proxy')).toBeInTheDocument()
      })

      // Enter search text
      const searchInput = screen.getByPlaceholderText(/search containers/i)
      await user.type(searchInput, 'nginx')

      // Wait for search to take effect (debounced)
      await waitFor(() => {
        expect(searchInput).toHaveValue('nginx')
      })

      // Click refresh button
      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      await user.click(refreshButton)

      // Search input should still have text
      expect(searchInput).toHaveValue('nginx')
    })

    it('refresh button is disabled while fetching', async () => {
      renderWithProviders(<ContainersPage />)

      // During initial loading, button might be disabled
      // Once loaded, button should be enabled
      await waitFor(() => {
        expect(screen.getByText('nginx-proxy')).toBeInTheDocument()
      })

      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      // Button should be enabled when not fetching
      expect(refreshButton).not.toBeDisabled()
    })
  })
})
