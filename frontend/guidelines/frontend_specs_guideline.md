# DevHub Frontend Specs (React + Vite): Guideline for Another LLM

This document is a **development contract**. Implement exactly what’s specified, keep changes minimal, and document assumptions in `docs/decisions.md`.

---

## 0) Goal and scope

Build the **DevHub** SPA (React + Vite) that talks to the Django API.

V1 focuses on a **Portainer-like Docker Manager**:
- Login/logout
- Role-aware UI (viewer/operator/admin)
- Dashboard (host/docker info)
- Containers list + search + filters
- Container details + logs
- Start/Stop/Restart actions
- Images list + Pull image
- Volumes/networks read-only pages
- Audit log view (admin/operator)

---

## 1) Tech stack (preferred)

- Node 20+
- Vite + React
- **TypeScript** (required)
- React Router
- TanStack Query (server state)
- Zustand (light client state) OR React Context (minimal)
- Zod (runtime validation for critical API responses)
- React Hook Form (forms)
- Tailwind CSS + optional component primitives:
  - shadcn/ui (recommended)
- Fetch wrapper (preferred) OR Axios (choose one)
- Testing:
  - Vitest + React Testing Library
  - MSW for API mocking

Code quality:
- ESLint + Prettier
- Typecheck in CI

---

## 2) Repository layout (frontend)

```
devhub-frontend/
  index.html
  vite.config.ts
  package.json
  src/
    app/
      App.tsx
      routes.tsx
      providers.tsx
    api/
      client.ts
      auth.ts
      docker.ts
      types.ts
      zod.ts
    components/
      layout/
      ui/
    features/
      auth/
      docker/
      audit/
    pages/
      LoginPage.tsx
      DashboardPage.tsx
      ContainersPage.tsx
      ContainerDetailPage.tsx
      ImagesPage.tsx
      VolumesPage.tsx
      NetworksPage.tsx
      AuditPage.tsx
    styles/
    utils/
  docs/
    decisions.md
```

---

## 3) UX requirements

### 3.1 Layout
- Left sidebar navigation (collapsible)
- Top bar with:
  - current user
  - role badge
  - logout button
- Main content area with page titles

### 3.2 Role-aware navigation
- Viewer: Dashboard, Containers (read-only), Images (read-only), Volumes, Networks
- Operator: Viewer + Start/Stop/Restart, Logs, Pull Image, Audit
- Admin: Operator + Create/Remove actions

### 3.3 Feedback and safety
- Confirm dialogs for destructive actions
- Toast notifications for success/error
- Clear error states with retry
- Disable action buttons while requests are in flight

---

## 4) Auth flow (must match backend)

### 4.1 Token strategy
- Backend returns **access JWT** on login/refresh.
- Backend stores **refresh token** in **HttpOnly cookie**.
- Frontend stores **access token in memory** (NOT localStorage).
- On page refresh: call `/auth/refresh/` to get a new access token, then proceed.

### 4.2 Auth state machine
States:
- `unknown` (app boot)
- `authenticated`
- `unauthenticated`

Boot logic:
1. App starts → call `refresh()`
2. If success: set access token and fetch `/auth/me/`
3. Else: go to Login page

### 4.3 API client rules
- Always send `Authorization: Bearer <access>`
- Include `credentials: "include"` for refresh/logout calls (cookies)
- On 401 from any endpoint:
  - attempt a single refresh
  - retry original request once
  - if still 401 → clear auth state and route to login

---

## 5) API module design

### 5.1 `src/api/client.ts`
- Single fetch wrapper:
  - base URL from `VITE_API_BASE_URL`
  - intercept 401 → refresh → retry once
  - typed helpers for GET/POST
- Request ID handling:
  - read `X-Request-ID` response header and log to console in dev

### 5.2 Types
- Define TypeScript types in `src/api/types.ts` matching backend schema.
- Zod schemas for critical responses (`me`, container detail).

---

## 6) Pages and features (V1)

### 6.1 LoginPage
- Username/password form
- Calls `POST /auth/login/`
- On success route to `/`

### 6.2 DashboardPage
- Calls:
  - `/docker/system/info/`
  - `/docker/system/version/`
- Display a small “status” summary.

### 6.3 ContainersPage
- Calls `/docker/containers/?status=&search=`
- UI:
  - search input
  - status filter (all/running/exited)
  - table or cards
  - actions column (role-dependent)
- Clicking row opens ContainerDetailPage.

### 6.4 ContainerDetailPage
- Shows:
  - name, image, state, created, ports, mounts, labels
- Actions:
  - Start/Stop/Restart (operator+)
  - Remove (admin)
- Logs panel:
  - `/docker/containers/{id}/logs/?tail=200`
  - auto-refresh toggle (poll every 2–5s when enabled)

### 6.5 ImagesPage
- List images via `/docker/images/`
- Pull image form (operator+):
  - calls `/docker/images/pull/`
  - show progress state (“pull started”) then refresh list

### 6.6 VolumesPage / NetworksPage
- Read-only lists

### 6.7 AuditPage (operator/admin)
- List audit events and basic filters.

---

## 7) State management strategy

- Server state: TanStack Query
  - invalidate list queries after mutations
- Auth/access token:
  - Zustand store or React context
  - never persist to disk
- UI state: local component state

---

## 8) Styling and component conventions

- Tailwind for layout and spacing.
- Reusable components:
  - `PageShell`, `Sidebar`, `Topbar`
  - `ConfirmDialog`
  - `Toast`
- Accessibility basics: focus styles, proper button labels.

---

## 9) Error handling and empty states

- Lists:
  - loading skeleton
  - empty state
  - error with retry
- Mutations:
  - toast on success/error
  - show backend error message when available

---

## 10) Testing requirements

- Unit test API client refresh logic with MSW.
- Component tests:
  - login flow
  - containers list filters
  - role-based buttons visibility

---

## 11) Development workflow

- `.env.example`:
  - `VITE_API_BASE_URL=http://localhost:8000/api/v1`
- Scripts:
  - `dev`, `build`, `preview`, `test`, `lint`, `typecheck`

---

## 12) Implementation notes for the LLM

Build order:
1. Scaffold + routing + layout
2. Auth store + boot refresh
3. API client with refresh-on-401
4. Containers list/detail/logs
5. Images pull/list
6. Remaining pages
7. Tests + lint + typecheck

---

## 13) Acceptance criteria (frontend)

- `npm run dev` starts app
- Boot refresh logic works (session survives refresh via refresh cookie)
- Viewer cannot see destructive buttons
- Operator can start/stop/restart and view logs
- Admin can remove and create (once backend supports it)
- Clear loading/error states
- Tests pass and TypeScript passes
