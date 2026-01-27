# DevHub Frontend

Docker container management dashboard built with React + TypeScript + Vite.

## Features

- **Dashboard**: System overview with Docker stats, container counts, images, memory, and CPU info
- **Containers**: List, filter, search, and manage containers with lifecycle actions (start/stop/restart)
- **Container Detail**: Full container info, logs viewer with auto-refresh, and action buttons
- **Images**: List, pull new images, and remove images (admin only)
- **Volumes**: Read-only volume list with size and mount info
- **Networks**: Read-only network list with driver and scope info
- **Audit**: Audit log viewer (graceful "coming soon" if backend endpoint not available)
- **Role-based Access**: Viewer, Operator, and Admin roles with appropriate UI controls

## Tech Stack

- **React 19** with TypeScript
- **Vite** for development and build
- **TanStack Query** for server state management
- **Zustand** for client state (auth)
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Zod** for runtime type validation
- **Vitest + React Testing Library + MSW** for testing

## Setup

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+
- DevHub backend running at `http://localhost:8000`

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:8000/api/v1` |

See `.env.example` for full documentation.

## Scripts

```bash
# Development server with hot reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run typecheck

# Linting
npm run lint

# Production build
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── api/              # API client and endpoint modules
│   ├── client.ts     # Base API client with 401 handling
│   ├── auth.ts       # Auth API (login, refresh, logout, me)
│   ├── docker.ts     # Docker API (containers, images, volumes, networks)
│   ├── audit.ts      # Audit API
│   ├── types.ts      # TypeScript interfaces
│   └── zod.ts        # Zod schemas for runtime validation
├── app/              # App-level components
│   ├── App.tsx       # Main app with routing
│   └── providers.tsx # Provider wrapper (Query, Router, Auth, Toast, ErrorBoundary)
├── components/       # Reusable components
│   ├── layout/       # Layout components (AppLayout, Sidebar, PageShell)
│   └── ui/           # UI components (LoadingState, ErrorState, EmptyState, ErrorBoundary)
├── features/         # Feature modules
│   ├── auth/         # Auth store, bootstrap, hooks
│   └── docker/       # Docker query hooks
├── pages/            # Page components
│   ├── DashboardPage.tsx
│   ├── ContainersPage.tsx
│   ├── ContainerDetailPage.tsx
│   ├── ImagesPage.tsx
│   ├── VolumesPage.tsx
│   ├── NetworksPage.tsx
│   ├── AuditPage.tsx
│   └── LoginPage.tsx
└── test/             # Test utilities and mocks
    └── mocks/        # MSW handlers and mock data
```

## Common Troubleshooting

### CORS Errors

If you see CORS errors in the console:

1. Ensure the backend is running at the URL specified in `VITE_API_BASE_URL`
2. Verify the backend has CORS configured to allow `http://localhost:5173`
3. Check that credentials mode is enabled in backend CORS config (for refresh token cookies)

Example backend CORS config (Django):
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
]
CORS_ALLOW_CREDENTIALS = True
```

### Backend Connection Issues

If the app can't connect to the backend:

1. Check that the backend is running: `curl http://localhost:8000/api/v1/docker/system/info/`
2. Verify `VITE_API_BASE_URL` in your `.env` file matches the backend URL
3. Check browser network tab for specific error messages

### Authentication Issues

If you're logged out unexpectedly:

1. Check that the backend is returning proper cookies (HttpOnly refresh token)
2. Ensure `credentials: 'include'` is set for auth requests
3. Verify the refresh token endpoint is working: `POST /api/v1/auth/refresh/`

### Build Errors

If the build fails:

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run typecheck

# Check for lint errors
npm run lint
```

## Testing

Tests use Vitest + React Testing Library + MSW for mocking API responses.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test src/pages/DashboardPage.test.tsx

# Run with coverage
npm test -- --coverage
```

### Test Files

- `*.test.tsx` - Component tests
- `*.test.ts` - Unit tests
- `src/test/mocks/handlers.ts` - MSW request handlers
- `src/test/setup.ts` - Test setup (MSW server lifecycle)

## CI/CD

The following commands must pass for CI:

```bash
npm test          # All tests pass
npm run lint      # No lint errors
npm run typecheck # No TypeScript errors
npm run build     # Production build succeeds
```

## Architecture Decisions

### Auth Flow
- Access token stored in memory (Zustand store) - never persisted to disk
- Refresh token stored as HttpOnly cookie by backend
- On app boot: attempt refresh → get user info → set authenticated state
- On 401: try refresh once → retry request → if fails, clear auth and redirect

### Query Caching (TanStack Query)
- System info: 15s staleTime
- Containers: 5s staleTime
- Container detail: 5s staleTime
- Logs: 3s staleTime, polling only when auto-refresh enabled
- Images: 30s staleTime
- Volumes/Networks: 60s staleTime

### Role-Based UI
- **Viewer**: Read-only access to all pages
- **Operator**: Can start/stop/restart containers, pull images
- **Admin**: All operator permissions + remove images

## License

Proprietary - DevHub
