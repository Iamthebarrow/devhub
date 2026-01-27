import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DashboardPage } from './DashboardPage'
import { useAuthStore } from '../features/auth'

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

describe('DashboardPage', () => {
  beforeEach(() => {
    // Set authenticated state so API calls work
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'test-token',
      user: { id: 1, username: 'testuser', roles: ['admin'] },
    })
  })

  it('renders page title', () => {
    renderWithProviders(<DashboardPage />)
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument()
  })

  it('renders page description', () => {
    renderWithProviders(<DashboardPage />)
    expect(screen.getByText(/docker environment overview/i)).toBeInTheDocument()
  })

  it('renders stat cards', () => {
    renderWithProviders(<DashboardPage />)
    expect(screen.getByText('Containers')).toBeInTheDocument()
    expect(screen.getByText('Images')).toBeInTheDocument()
    expect(screen.getByText('Memory')).toBeInTheDocument()
    expect(screen.getByText('CPUs')).toBeInTheDocument()
  })

  it('renders Docker Info section', () => {
    renderWithProviders(<DashboardPage />)
    expect(screen.getByText('Docker Info')).toBeInTheDocument()
  })

  it('renders System Status section', () => {
    renderWithProviders(<DashboardPage />)
    expect(screen.getByText('System Status')).toBeInTheDocument()
  })

  it('loads and displays system info from API', async () => {
    renderWithProviders(<DashboardPage />)

    // Wait for API data to load
    await waitFor(() => {
      // Check container count is displayed (from mock data: 3/5)
      expect(screen.getByText('3/5')).toBeInTheDocument()
    })

    // Check images count
    expect(screen.getByText('15')).toBeInTheDocument()

    // Check Docker version
    expect(screen.getByText('24.0.7')).toBeInTheDocument()
  })
})
