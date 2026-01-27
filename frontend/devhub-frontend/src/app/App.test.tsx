import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { useAuthStore } from '../features/auth'
import { setRefreshBehavior } from '../test/mocks/handlers'

const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  roles: ['admin'],
}

describe('App', () => {
  beforeEach(() => {
    // Reset auth store before each test
    useAuthStore.setState({
      status: 'unknown',
      accessToken: null,
      user: null,
    })
    // Allow refresh to succeed by default
    setRefreshBehavior(true)
  })

  it('shows loading screen during auth boot', () => {
    render(<App />)
    // During auth boot, should show loading
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('redirects to login when unauthenticated', async () => {
    // Make refresh fail so user becomes unauthenticated
    setRefreshBehavior(false)

    render(<App />)

    // Wait for auth boot to complete and redirect to login
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    })
  })

  describe('when authenticated', () => {
    beforeEach(() => {
      // Pre-set authenticated state to skip boot flow
      useAuthStore.setState({
        status: 'authenticated',
        accessToken: 'test-token',
        user: mockUser,
      })
    })

    it('renders Dashboard page title on root route', () => {
      render(<App />)
      // Check for the page title heading specifically
      const heading = screen.getByRole('heading', { name: /dashboard/i, level: 1 })
      expect(heading).toBeInTheDocument()
      expect(heading).toHaveClass('text-2xl')
    })

    it('renders sidebar navigation', () => {
      render(<App />)
      // Check for app title in sidebar
      expect(screen.getByText('DevHub')).toBeInTheDocument()
      // Check for navigation links by their href
      expect(screen.getByRole('link', { name: /containers/i })).toHaveAttribute('href', '/containers')
      expect(screen.getByRole('link', { name: /images/i })).toHaveAttribute('href', '/images')
      expect(screen.getByRole('link', { name: /volumes/i })).toHaveAttribute('href', '/volumes')
      expect(screen.getByRole('link', { name: /networks/i })).toHaveAttribute('href', '/networks')
      expect(screen.getByRole('link', { name: /audit log/i })).toHaveAttribute('href', '/audit')
    })

    it('shows user info in topbar', () => {
      render(<App />)
      // Check for username in topbar
      expect(screen.getByText('testuser')).toBeInTheDocument()
      // Check for role badge
      expect(screen.getByText('admin')).toBeInTheDocument()
    })
  })
})
