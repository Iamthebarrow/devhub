import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { DashboardPage } from './DashboardPage'

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('DashboardPage', () => {
  it('renders page title', () => {
    renderWithRouter(<DashboardPage />)
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument()
  })

  it('renders page description', () => {
    renderWithRouter(<DashboardPage />)
    expect(screen.getByText(/docker environment overview/i)).toBeInTheDocument()
  })

  it('renders stat cards', () => {
    renderWithRouter(<DashboardPage />)
    expect(screen.getByText('Containers')).toBeInTheDocument()
    expect(screen.getByText('Images')).toBeInTheDocument()
    expect(screen.getByText('Volumes')).toBeInTheDocument()
    expect(screen.getByText('Networks')).toBeInTheDocument()
  })

  it('renders Docker Info section', () => {
    renderWithRouter(<DashboardPage />)
    expect(screen.getByText('Docker Info')).toBeInTheDocument()
  })

  it('renders System Status section', () => {
    renderWithRouter(<DashboardPage />)
    expect(screen.getByText('System Status')).toBeInTheDocument()
  })
})
