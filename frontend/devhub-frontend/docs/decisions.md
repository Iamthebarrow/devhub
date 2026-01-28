# DevHub Frontend - Architecture Decisions

This document records architectural and implementation decisions made during frontend development.

---

## Phase 1: Scaffold + Routing + Layout Shell + Tooling

### Decision 1: Tailwind CSS v4 (Vite Plugin)

**Choice:** Tailwind CSS v4 with `@tailwindcss/vite` plugin

**Rationale:**
- v4 offers simpler configuration with the new Vite plugin approach
- No need for separate `tailwind.config.js` - configuration can be done in CSS
- Uses modern CSS imports: `@import "tailwindcss"`
- Better performance with native CSS cascade layers

### Decision 2: Project Structure

**Choice:** Feature-based organization with clear separation

```
src/
  app/          # App bootstrap, routing, providers
  api/          # API client and types
  components/   # Shared components (layout, ui)
  features/     # Feature modules (auth, docker, audit)
  pages/        # Page components (one per route)
  utils/        # Utility functions
  test/         # Test utilities and setup
```

**Rationale:**
- Matches the spec's recommended layout
- Clear separation between shared components and feature-specific code
- Pages are thin wrappers that compose features
- Easy to navigate and scale

### Decision 3: Routing Architecture

**Choice:** React Router v7 with layout routes

**Rationale:**
- Layout routes (`<Route element={<AppLayout />}>`) cleanly separate authenticated layout from standalone pages
- Login page is outside the layout wrapper (no sidebar/topbar)
- All other routes share the AppLayout with sidebar and topbar
- Prepares for future auth gating with route wrappers

### Decision 4: Sidebar Collapse

**Choice:** Toggle button in sidebar header, state in AppLayout

**Rationale:**
- Single source of truth for collapse state in parent layout
- Sidebar width transitions smoothly with CSS transitions
- Main content area padding adjusts with sidebar
- Mobile: Same toggle button, could be enhanced with overlay in future

**DEFAULT:** Sidebar starts expanded on desktop

### Decision 5: Icons

**Choice:** lucide-react

**Rationale:**
- Lightweight, tree-shakeable icon library
- Consistent with modern React patterns
- Good selection of icons for dashboard/admin UI
- No additional configuration needed

### Decision 6: CSS Utility for Class Names

**Choice:** clsx

**Rationale:**
- Lightweight utility for conditional class names
- Works well with Tailwind's utility-first approach
- More readable than string concatenation
- Standard choice in React ecosystem

### Decision 7: Testing Setup

**Choice:** Vitest + React Testing Library

**Rationale:**
- Vitest integrates natively with Vite (same config file)
- React Testing Library promotes user-centric testing
- `@testing-library/jest-dom` provides useful DOM matchers
- Consistent with the spec requirements

### Decision 8: Prettier Configuration

**Choices:**
- `semi: false` - No semicolons (cleaner look)
- `singleQuote: true` - Single quotes for strings
- `trailingComma: "es5"` - Trailing commas where valid in ES5
- `printWidth: 100` - Slightly wider than default for component props

**Rationale:**
- Consistent code style across the project
- Personal preference aligned with modern JS conventions
- Works well with TypeScript

### Decision 9: Dockerized Vite Dev Server

**Choice:** Run the Vite dev server in a container for local Docker Compose development.

**Rationale:**
- Matches the backend containerized workflow for a single `docker compose up --build`
- Enables hot reload with bind-mounted source
- Keeps frontend dev dependencies contained in the image

### Decision 10: Theme Toggle (Dark Mode)

**Choice:** Store theme preference in Zustand with `dark` class on `<html>`.

**Rationale:**
- Keeps theme state consistent with existing client state patterns
- Uses Tailwind's `dark:` variants without extra config
- Persists preference in localStorage while supporting system default

---

## Future Phases (Planned)

### Phase 2: Auth + API Client
- Implement refresh-on-401 logic in API client
- Add auth context/store with Zustand
- Boot refresh flow on app load
- Login form integration

### Phase 3: Docker Features
- Container list/detail with TanStack Query
- Image list + pull form
- Logs panel with auto-refresh
- Role-based action visibility

### Phase 4: Remaining Features
- Volumes/Networks pages with real data
- Audit log with filters
- Toast notifications
- Confirm dialogs for destructive actions

### Phase 5: Polish
- Loading skeletons
- Error boundaries
- Accessibility improvements
- Mobile responsive enhancements
