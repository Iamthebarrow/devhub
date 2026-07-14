# Project Structure

A map of the codebase: where things live and why they are organised the way they are.

---

## Top-Level Layout

```
devhub/
├── backend/
│   └── devhub-backend/          Django + DRF API server
├── frontend/
│   └── devhub-frontend/         React + Vite web app
├── docker-compose.yml           Full stack orchestration
├── .env.example                 Environment variable template
├── Makefile                     Convenience shortcuts (delegates to docker compose)
├── mkdocs.yml                   Documentation site config
├── requirements-docs.txt        Documentation build dependencies
└── README.md                    Short project overview
```

---

## Backend Structure

```
backend/devhub-backend/
├── config/
│   ├── settings/
│   │   ├── base.py              Shared settings (all environments)
│   │   └── local.py             Local/dev overrides
│   ├── urls.py                  Root URL routing
│   ├── celery.py                Celery app configuration
│   └── wsgi.py                  WSGI entry point
├── apps/
│   ├── accounts/                Auth + user management
│   │   ├── views.py             Login, logout, refresh, me endpoints
│   │   ├── serializers.py       Request/response shapes
│   │   ├── urls.py              Auth URL patterns
│   │   └── management/
│   │       └── commands/
│   │           └── devhub_bootstrap_roles.py
│   ├── core/                    Health, version, throttling
│   │   ├── views.py             Health check + version endpoints
│   │   ├── throttles.py         Custom DRF throttle classes
│   │   └── urls.py
│   ├── docker_manager/          Docker API integration
│   │   ├── views/               Container, image, volume, network, system views
│   │   ├── serializers.py       Docker resource serializers
│   │   ├── services/
│   │   │   └── docker_service.py  All Docker SDK interaction
│   │   ├── permissions.py       IsAdmin, IsOperatorOrHigher, IsViewerOrHigher
│   │   ├── exceptions.py        DockerConnectionError, ContainerNotFoundError, etc.
│   │   ├── tasks.py             Celery tasks (image pull)
│   │   └── urls.py
│   └── audit/
│       ├── models.py            AuditEvent (immutable, UUID PK)
│       ├── services.py          AuditService.create_event()
│       ├── middleware.py        RequestIDMiddleware (X-Request-ID header)
│       ├── views.py             Audit event list endpoint
│       └── urls.py
├── entrypoint.sh                Container startup (runs migrations if RUN_MIGRATIONS=1)
├── Dockerfile
├── pyproject.toml               Python project + dependency spec
├── Makefile                     Backend dev shortcuts
└── .env.example
```

### Key Backend Concepts

**`docker_service.py`**: All communication with Docker goes through this single service class. Views never talk to Docker directly. This makes the Docker integration easy to mock in tests and easy to replace if needed.

**`permissions.py`**: Three permission classes that check Django Group membership. Used in view `permission_classes`. If the user is not in the right group, they get a 403.

**`audit/models.py`**: The `AuditEvent` model overrides `save()` and `delete()` to raise `ValueError` on updates or deletes. Audit records are permanent by design.

**`middleware.py`**: Attaches a UUID `X-Request-ID` to every request. This ID flows into audit events and log lines, making it possible to trace a full request through all the logs.

---

## Frontend Structure

```
frontend/devhub-frontend/
├── src/
│   ├── main.tsx                 App entry point (React + Vite)
│   ├── app/
│   │   ├── App.tsx              Root component: providers + router
│   │   ├── routes.tsx           All route definitions (public + protected)
│   │   └── providers.tsx        QueryClient, BrowserRouter, ErrorBoundary, Toast
│   ├── api/
│   │   ├── client.ts            Base HTTP client (401 handling, refresh retry, single-flight lock)
│   │   ├── auth.ts              Auth endpoints (login, logout, refresh, me)
│   │   ├── docker.ts            Docker endpoints (containers, images, volumes, networks)
│   │   ├── audit.ts             Audit events endpoint
│   │   ├── types.ts             TypeScript interfaces for all API responses
│   │   └── zod.ts               Zod validation schemas
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx    Main shell (sidebar + topbar + content area)
│   │   │   ├── Sidebar.tsx      Left navigation
│   │   │   └── Topbar.tsx       Top bar with user menu
│   │   └── ui/
│   │       ├── EmptyState.tsx
│   │       ├── ErrorState.tsx
│   │       ├── LoadingState.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── RefreshButton.tsx
│   ├── features/
│   │   ├── auth/
│   │   │   ├── authStore.ts     Zustand store: access token + user state
│   │   │   ├── AuthBootstrap.tsx  Runs refresh+me on app load to restore session
│   │   │   ├── ProtectedRoute.tsx  Redirects to /login if not authenticated
│   │   │   └── PublicRoute.tsx  Redirects to / if already authenticated
│   │   ├── docker/
│   │   │   └── hooks/           TanStack Query hooks: useContainers, useImages, etc.
│   │   └── audit/
│   │       ├── hooks/           TanStack Query hooks: useAuditEvents
│   │       └── filterStore.ts   Zustand store for audit filter state
│   └── pages/
│       ├── LoginPage.tsx
│       ├── DashboardPage.tsx
│       ├── ContainersPage.tsx
│       ├── ContainerDetailPage.tsx
│       ├── ImagesPage.tsx
│       ├── VolumesPage.tsx
│       ├── NetworksPage.tsx
│       └── AuditPage.tsx
├── public/                      Static assets
├── Dockerfile
├── package.json
├── vite.config.ts
├── tsconfig.json
└── .env.example
```

### Key Frontend Concepts

**`api/client.ts`**: The base HTTP client handles the access token lifecycle. It attaches the `Authorization` header, catches 401 responses, fires a single token refresh request (regardless of how many requests 401 at once), and retries. This logic is centralised here so individual hooks and pages never need to think about it.

**`features/auth/authStore.ts`**: Zustand store that holds the access token and current user info. Keeps the token in memory only, never in localStorage or sessionStorage.

**`features/auth/AuthBootstrap.tsx`**: On initial app load, tries to restore the session by calling `/auth/refresh/` (using the cookie) then `/auth/me/`. If it works, the user is authenticated without seeing a login page. If it fails, the user goes to login.

**`app/routes.tsx`**: Route definitions. Public routes (login) redirect authenticated users away. Protected routes redirect unauthenticated users to login. All protected routes render inside `AppLayout`.

---

## Docker Compose Services

```
docker-compose.yml
│
├── postgres:16-alpine           Database (port 5432)
├── redis:7-alpine               Cache / Celery broker (port 6379)
├── docker-socket-proxy          Restricted Docker API proxy (port 2375)
├── backend                      Django API (port 8888)
├── worker                       Celery worker (no exposed port)
└── frontend                     React dev server (port 3100)
```

The startup order is enforced by `depends_on` with health checks. The frontend waits for the backend, the backend waits for postgres and redis to be healthy.

---

## Configuration Files

| File | Purpose |
|---|---|
| `.env.example` | Root environment template for Docker Compose |
| `backend/devhub-backend/.env.example` | Backend-only env template (manual setup) |
| `frontend/devhub-frontend/.env.example` | Frontend-only env template (manual setup) |
| `backend/devhub-backend/pyproject.toml` | Python project, deps, and tool config (Ruff, pytest) |
| `frontend/devhub-frontend/package.json` | Node project and npm scripts |
| `frontend/devhub-frontend/vite.config.ts` | Vite build config |
| `frontend/devhub-frontend/tsconfig.json` | TypeScript compiler config |
