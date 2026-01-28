import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VolumesPage } from './VolumesPage'
import { useAuthStore } from '../features/auth'
import { mockVolumes } from '../test/mocks/handlers'

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
        <VolumesPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('VolumesPage', () => {
  beforeEach(() => {
    // Set authenticated state
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'test-token',
      user: { id: 1, username: 'testuser', roles: ['admin'] },
    })
  })

  it('renders volumes list from API', async () => {
    renderWithProviders()

    // Wait for volumes to load
    await waitFor(() => {
      expect(screen.getByText('postgres-data')).toBeInTheDocument()
    })

    // Check that all mock volumes are displayed
    expect(screen.getByText('redis-data')).toBeInTheDocument()
    expect(screen.getByText('app-uploads')).toBeInTheDocument()
  })

  it('displays volume drivers', async () => {
    renderWithProviders()

    // Wait for volumes to load
    await waitFor(() => {
      expect(screen.getByText('postgres-data')).toBeInTheDocument()
    })

    // All volumes have 'local' driver - but scope is also 'local'
    // Check that we have at least the expected number of 'local' texts
    // (driver + scope = 2 per volume = 6 total for 3 volumes)
    const localTexts = screen.getAllByText('local')
    expect(localTexts.length).toBe(mockVolumes.length * 2) // driver + scope per volume
  })

  it('displays volume scope', async () => {
    renderWithProviders()

    // Wait for volumes to load
    await waitFor(() => {
      expect(screen.getByText('postgres-data')).toBeInTheDocument()
    })

    // All volumes have 'local' scope (confirmed by checking total 'local' count)
    const localTexts = screen.getAllByText('local')
    expect(localTexts.length).toBeGreaterThan(0)
  })

  it('displays volume created date when available', async () => {
    renderWithProviders()

    // Wait for volumes to load
    await waitFor(() => {
      expect(screen.getByText('postgres-data')).toBeInTheDocument()
    })

    // Check that created date is displayed - looking for "Created" label
    const createdLabels = screen.getAllByText('Created')
    expect(createdLabels.length).toBeGreaterThan(0)
  })

  it('does not display mount points for security reasons', async () => {
    renderWithProviders()

    // Wait for volumes to load
    await waitFor(() => {
      expect(screen.getByText('postgres-data')).toBeInTheDocument()
    })

    // Mount points should NOT be displayed (security)
    expect(screen.queryByText(/\/var\/lib\/docker\/volumes/)).not.toBeInTheDocument()
  })

  it('shows search input', async () => {
    renderWithProviders()

    // Wait for volumes to load
    await waitFor(() => {
      expect(screen.getByText('postgres-data')).toBeInTheDocument()
    })

    // Search input should be visible
    expect(screen.getByPlaceholderText(/search volumes/i)).toBeInTheDocument()
  })

  it('shows refresh button', async () => {
    renderWithProviders()

    // Wait for volumes to load
    await waitFor(() => {
      expect(screen.getByText('postgres-data')).toBeInTheDocument()
    })

    // Refresh button should be visible
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
  })
})
