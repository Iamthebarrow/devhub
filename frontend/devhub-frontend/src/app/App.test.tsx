import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
    // App should render and show the Dashboard page heading (h1)
    expect(screen.getByRole('heading', { name: /dashboard/i, level: 1 })).toBeInTheDocument()
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
})
