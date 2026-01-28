/**
 * Role-based UI visibility tests (Phase 6).
 *
 * Tests that role-based access controls work correctly:
 * - Viewer cannot see mutation controls
 * - Operator/admin can see mutation controls
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ImagesPage } from '../../pages/ImagesPage'
import { ContainerDetailPage } from '../../pages/ContainerDetailPage'
import { useAuthStore } from './authStore'
import { mockContainers } from '../../test/mocks/handlers'
import type { User } from '../../api/types'

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

const renderWithProviders = (ui: React.ReactElement, initialRoute = '/') => {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

// Separate render function for ContainerDetailPage that needs route params
const renderContainerDetailPage = (containerId: string) => {
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

const setAuthenticatedUser = (roles: string[]) => {
  const user: User = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    roles,
  }
  useAuthStore.setState({
    status: 'authenticated',
    accessToken: 'test-token',
    user,
  })
}

describe('Role-based UI visibility', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'unknown',
      accessToken: null,
      user: null,
    })
  })

  describe('ImagesPage', () => {
    describe('viewer role', () => {
      beforeEach(() => {
        setAuthenticatedUser(['viewer'])
      })

      it('cannot see Pull Image form', async () => {
        renderWithProviders(<ImagesPage />)

        // Wait for page to load
        await waitFor(() => {
          expect(screen.getByText('nginx')).toBeInTheDocument()
        })

        // Viewer should NOT see pull form
        expect(screen.queryByRole('heading', { name: /pull image/i })).not.toBeInTheDocument()
        expect(screen.queryByPlaceholderText(/image name/i)).not.toBeInTheDocument()
      })

      it('cannot see remove buttons (admin-only)', async () => {
        renderWithProviders(<ImagesPage />)

        await waitFor(() => {
          expect(screen.getByText('nginx')).toBeInTheDocument()
        })

        // Viewer should NOT see remove buttons (Actions column doesn't exist)
        expect(screen.queryByTitle(/remove image/i)).not.toBeInTheDocument()
      })
    })

    describe('operator role', () => {
      beforeEach(() => {
        setAuthenticatedUser(['operator'])
      })

      it('can see Pull Image form', async () => {
        renderWithProviders(<ImagesPage />)

        await waitFor(() => {
          expect(screen.getByText('nginx')).toBeInTheDocument()
        })

        // Operator CAN see pull form
        expect(screen.getByRole('heading', { name: /pull image/i })).toBeInTheDocument()
        expect(screen.getByPlaceholderText(/image name/i)).toBeInTheDocument()
      })

      it('cannot see remove buttons (admin-only)', async () => {
        renderWithProviders(<ImagesPage />)

        await waitFor(() => {
          expect(screen.getByText('nginx')).toBeInTheDocument()
        })

        // Operator should NOT see remove buttons
        expect(screen.queryByTitle(/remove image/i)).not.toBeInTheDocument()
      })
    })

    describe('admin role', () => {
      beforeEach(() => {
        setAuthenticatedUser(['admin'])
      })

      it('can see Pull Image form', async () => {
        renderWithProviders(<ImagesPage />)

        await waitFor(() => {
          expect(screen.getByText('nginx')).toBeInTheDocument()
        })

        // Admin CAN see pull form
        expect(screen.getByRole('heading', { name: /pull image/i })).toBeInTheDocument()
      })

      it('can see remove buttons', async () => {
        renderWithProviders(<ImagesPage />)

        await waitFor(() => {
          expect(screen.getByText('nginx')).toBeInTheDocument()
        })

        // Admin CAN see remove buttons
        const removeButtons = screen.getAllByTitle(/remove image/i)
        expect(removeButtons.length).toBeGreaterThan(0)
      })
    })
  })

  describe('ContainerDetailPage - action buttons', () => {
    // Use the first mock container ID (nginx-proxy, running)
    const containerId = mockContainers[0].id

    describe('viewer role', () => {
      beforeEach(() => {
        setAuthenticatedUser(['viewer'])
      })

      it('cannot see Start/Stop/Restart buttons', async () => {
        renderContainerDetailPage(containerId)

        // Wait for container to load - multiple elements have 'nginx-proxy'
        await waitFor(() => {
          expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
        })

        // Viewer should NOT see action buttons
        expect(screen.queryByRole('button', { name: /start/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /restart/i })).not.toBeInTheDocument()
      })
    })

    describe('operator role', () => {
      beforeEach(() => {
        setAuthenticatedUser(['operator'])
      })

      it('can see action buttons', async () => {
        renderContainerDetailPage(containerId)

        // Wait for container to load
        await waitFor(() => {
          expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
        })

        // Operator CAN see action buttons (Stop and Restart for running container)
        expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /restart/i })).toBeInTheDocument()
      })
    })

    describe('admin role', () => {
      beforeEach(() => {
        setAuthenticatedUser(['admin'])
      })

      it('can see action buttons', async () => {
        renderContainerDetailPage(containerId)

        // Wait for container to load
        await waitFor(() => {
          expect(screen.getAllByText('nginx-proxy').length).toBeGreaterThan(0)
        })

        // Admin CAN see action buttons
        expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /restart/i })).toBeInTheDocument()
      })
    })
  })
})
