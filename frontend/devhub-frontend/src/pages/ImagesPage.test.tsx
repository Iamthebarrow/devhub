import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ImagesPage } from './ImagesPage'
import { useAuthStore } from '../features/auth'
import { mockImages } from '../test/mocks/handlers'

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => null,
}))

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
        <ImagesPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ImagesPage', () => {
  describe('with viewer role', () => {
    beforeEach(() => {
      // Set authenticated state with viewer role (cannot pull images)
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'viewer', roles: ['viewer'] },
      })
    })

    it('does NOT show pull form for viewer', async () => {
      renderWithProviders()

      // Wait for images to load
      await waitFor(() => {
        expect(screen.getByText('nginx')).toBeInTheDocument()
      })

      // Pull form should NOT be visible for viewer - check for heading
      expect(screen.queryByRole('heading', { name: /pull image/i })).not.toBeInTheDocument()
      expect(screen.queryByPlaceholderText(/image name/i)).not.toBeInTheDocument()
    })

    it('displays images list for viewer', async () => {
      renderWithProviders()

      // Wait for images to load
      await waitFor(() => {
        expect(screen.getByText('nginx')).toBeInTheDocument()
      })

      expect(screen.getByText('postgres')).toBeInTheDocument()
      expect(screen.getByText('redis')).toBeInTheDocument()
    })

    it('does NOT show remove button for viewer', async () => {
      renderWithProviders()

      // Wait for images to load
      await waitFor(() => {
        expect(screen.getByText('nginx')).toBeInTheDocument()
      })

      // Remove buttons should NOT be visible for viewer
      const removeButtons = screen.queryAllByTitle('Remove image')
      expect(removeButtons).toHaveLength(0)
    })
  })

  describe('with operator role', () => {
    beforeEach(() => {
      // Set authenticated state with operator role (can pull images)
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'operator', roles: ['operator'] },
      })
    })

    it('shows pull form for operator', async () => {
      renderWithProviders()

      // Wait for images to load
      await waitFor(() => {
        expect(screen.getByText('nginx')).toBeInTheDocument()
      })

      // Pull form should be visible for operator - check for heading
      expect(screen.getByRole('heading', { name: /pull image/i })).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/image name/i)).toBeInTheDocument()
    })

    it('does NOT show remove button for operator (admin-only)', async () => {
      renderWithProviders()

      // Wait for images to load
      await waitFor(() => {
        expect(screen.getByText('nginx')).toBeInTheDocument()
      })

      // Remove buttons should NOT be visible for operator (admin-only feature)
      const removeButtons = screen.queryAllByTitle('Remove image')
      expect(removeButtons).toHaveLength(0)
    })
  })

  describe('with admin role', () => {
    beforeEach(() => {
      // Set authenticated state with admin role (can pull and remove images)
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: { id: 1, username: 'admin', roles: ['admin'] },
      })
    })

    it('shows pull form for admin', async () => {
      renderWithProviders()

      // Wait for images to load
      await waitFor(() => {
        expect(screen.getByText('nginx')).toBeInTheDocument()
      })

      // Pull form should be visible for admin - check for heading
      expect(screen.getByRole('heading', { name: /pull image/i })).toBeInTheDocument()
    })

    it('shows remove button for admin', async () => {
      renderWithProviders()

      // Wait for images to load
      await waitFor(() => {
        expect(screen.getByText('nginx')).toBeInTheDocument()
      })

      // Remove buttons should be visible for admin
      const removeButtons = screen.getAllByTitle('Remove image')
      expect(removeButtons.length).toBe(mockImages.length)
    })

    it('shows confirm dialog when clicking remove', async () => {
      const user = userEvent.setup()
      renderWithProviders()

      // Wait for images to load
      await waitFor(() => {
        expect(screen.getByText('nginx')).toBeInTheDocument()
      })

      // Click first remove button
      const removeButtons = screen.getAllByTitle('Remove image')
      await user.click(removeButtons[0])

      // Confirm dialog should appear
      await waitFor(() => {
        expect(screen.getByText('Remove Image')).toBeInTheDocument()
        expect(screen.getByText(/are you sure you want to remove/i)).toBeInTheDocument()
      })

      // Should have Cancel and Remove buttons
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^remove$/i })).toBeInTheDocument()
    })

    it('displays image sizes correctly', async () => {
      renderWithProviders()

      // Wait for images to load
      await waitFor(() => {
        expect(screen.getByText('nginx')).toBeInTheDocument()
      })

      // Check that sizes are formatted - all mock images should show MB
      const sizeElements = screen.getAllByText(/\d+(\.\d+)?\s*MB/)
      expect(sizeElements.length).toBeGreaterThan(0)
    })
  })
})
