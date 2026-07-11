# Contributing

Everything you need to set up a development environment and start contributing to DevHub.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Docker Desktop | Latest | Required for the full stack |
| Python | 3.12+ | For backend-only work |
| Node.js | 20+ | For frontend-only work |
| npm | 9+ | Comes with Node |
| Git | Any recent | Required |

---

## Getting Started

1. Fork the repository and clone your fork:

    ```bash
    git clone https://github.com/Iamthebarrow/devhub.git
    cd devhub
    ```

2. Set up the environment:

    ```bash
    cp .env.example .env
    # Set DJANGO_SECRET_KEY and DEV_ADMIN_PASSWORD
    ```

3. Start the stack:

    ```bash
    docker compose up --build
    ```

4. Verify everything works by visiting [http://localhost:3100](http://localhost:3100).

---

## Backend Development

For active Python development, running the backend outside Docker gives faster feedback.

```bash
cd backend/devhub-backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate

# Install all dependencies (including dev tools)
pip install -e ".[dev]"

# Install pre-commit hooks
pre-commit install

# Copy and configure environment
cp .env.example .env

# Apply migrations
python manage.py migrate

# Bootstrap roles and create admin
python manage.py devhub_bootstrap_roles

# Start the dev server
python manage.py runserver 0.0.0.0:8888
```

You'll also need postgres and redis running — either via Docker Compose (run `docker compose up postgres redis docker-socket-proxy` separately) or locally.

### Running Tests

```bash
# All tests
make test
# or
pytest

# With coverage
make coverage
# or
pytest --cov=apps --cov-report=term-missing

# Specific test file
pytest apps/audit/tests/test_models.py
```

### Linting and Formatting

DevHub uses [Ruff](https://docs.astral.sh/ruff/) for both linting and formatting.

```bash
make lint          # Check for issues
make format        # Auto-fix + format
```

Pre-commit hooks run these automatically on every commit.

---

## Frontend Development

For active TypeScript/React development:

```bash
cd frontend/devhub-frontend

npm install

# Copy and configure environment
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:8888/api/v1

# Start Vite dev server with hot reload
npm run dev
```

The frontend runs at `http://localhost:5173` in this mode (Vite's default; the containerised setup uses 3100).

### Running Tests

```bash
npm test               # Run all tests once
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report
```

### Type Checking

```bash
npm run typecheck      # tsc --noEmit (no emit, just type errors)
```

### Linting and Formatting

```bash
npm run lint           # ESLint
npm run lint:fix       # ESLint with auto-fix
npm run format         # Prettier
npm run format:check   # Check without writing
```

---

## Project Conventions

### Backend

- **App structure**: Each domain lives in its own app under `apps/`. New features get a new app.
- **Docker interaction**: All Docker SDK calls go through `docker_service.py`. Views do not call Docker directly.
- **Permissions**: Use the existing `IsAdmin`, `IsOperatorOrHigher`, `IsViewerOrHigher` permission classes. New endpoints must declare their `permission_classes`.
- **Audit logging**: Mutations that matter should create an `AuditEvent`. Use `AuditService.create_event()`.
- **Tests**: Use `pytest` with `pytest-django`. Tests live in `apps/<app>/tests/`.
- **No print statements**: Use Python `logging` throughout.

### Frontend

- **Feature modules**: New features go in `src/features/<feature>/` with their own hooks, stores, and components.
- **API calls**: All calls go through `src/api/client.ts`. Define new endpoints in the relevant `src/api/*.ts` file.
- **State management**: Server state via TanStack Query. Client-side state via Zustand. Do not use `useState` for data that belongs in a query.
- **Types**: Define TypeScript interfaces in `src/api/types.ts`. Use Zod schemas for runtime validation in `src/api/zod.ts`.
- **No `any`**: Avoid TypeScript `any`. Use proper types or `unknown` with type guards.

---

## Pull Request Checklist

Before opening a PR:

- [ ] Tests pass locally (`make test` / `npm test`)
- [ ] Linting passes (`make lint` / `npm run lint`)
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] New endpoints have the correct `permission_classes`
- [ ] Mutations that should be audited call `AuditService.create_event()`
- [ ] No secrets or credentials in committed code
- [ ] `.env.example` updated if new environment variables were added

---

## Architecture Decisions

Architecture decisions are recorded in:

- `backend/devhub-backend/docs/decisions.md`
- `frontend/devhub-frontend/docs/decisions.md`

If your change makes a significant architectural decision, add a record there.

---

## Getting Help

If you hit something unclear:

1. Check [Troubleshooting](troubleshooting.md) first
2. Look at the existing tests for examples of how things are tested
3. Read the architecture decision records for context on why things were built a certain way
4. Open an issue with a clear description of what you're trying to do
