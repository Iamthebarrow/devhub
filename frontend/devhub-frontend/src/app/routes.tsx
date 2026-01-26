import { Routes, Route } from 'react-router-dom'
import { AppLayout } from '../components/layout/AppLayout'
import { ProtectedRoute, PublicRoute } from '../features/auth'
import { LoginPage } from '../pages/LoginPage'
import { DashboardPage } from '../pages/DashboardPage'
import { ContainersPage } from '../pages/ContainersPage'
import { ContainerDetailPage } from '../pages/ContainerDetailPage'
import { ImagesPage } from '../pages/ImagesPage'
import { VolumesPage } from '../pages/VolumesPage'
import { NetworksPage } from '../pages/NetworksPage'
import { AuditPage } from '../pages/AuditPage'

/**
 * Application routes with auth gating.
 *
 * - /login: Public only (redirects to / if authenticated)
 * - All other routes: Protected (redirects to /login if not authenticated)
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Login page - public only, no layout */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      {/* Protected app routes - wrapped in layout with sidebar/topbar */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/containers" element={<ContainersPage />} />
        <Route path="/containers/:id" element={<ContainerDetailPage />} />
        <Route path="/images" element={<ImagesPage />} />
        <Route path="/volumes" element={<VolumesPage />} />
        <Route path="/networks" element={<NetworksPage />} />
        <Route path="/audit" element={<AuditPage />} />
      </Route>
    </Routes>
  )
}
