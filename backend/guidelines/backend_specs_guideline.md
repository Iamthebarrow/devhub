# DevHub Backend Specs (Django): Guideline for Another LLM

This document is a **development contract**. Implement exactly what’s specified, keep changes minimal, and add anything only if required for correctness/security. When assumptions are necessary, write them down in `docs/decisions.md` with rationale.

---

## 0) Goal and scope

Build **DevHub**, a suite of server-management apps. **App #1** is a **Portainer-like** “Docker Manager” that can:

- Authenticate users and enforce permissions
- List Docker resources (containers/images/volumes/networks)
- Start/stop/restart containers
- View container logs
- Create containers (limited, safe subset of options)
- Show basic host/system info relevant to Docker
- Provide audit logging for actions

The backend is a **Django + DRF** API used by a **React + Vite** SPA.

---

## 1) Non-goals (explicitly out of scope for V1)

- Kubernetes support
- Multi-host cluster orchestration (single host only)
- Full Compose stack UI (optional future)
- Terminal exec into containers (security-heavy; future)
- Arbitrary Docker socket exposure to the browser

---

## 2) Architecture overview

### 2.1 High-level
- Django monolith API + modular apps inside:
  - `accounts` (auth, user profile)
  - `core` (health, version, settings exposure)
  - `docker_manager` (Docker resources + operations)
  - `audit` (immutable audit log)
- REST API via DRF
- API documentation via OpenAPI
- PostgreSQL for persistence
- Redis for cache + task queue (optional but recommended)
- Background tasks (Celery) for long operations (pull image, create container, prune)

### 2.2 Docker engine access (CRITICAL)
Do **NOT** mount `/var/run/docker.sock` directly into the web container without protections.

Preferred safe pattern (choose one and document it):
1) **Socket proxy** (recommended): run a Docker Socket Proxy container that exposes only required endpoints; backend talks to proxy over HTTP.
2) Direct docker.sock mount **only** if running on a trusted single-user server; must be documented as insecure-by-design.

Implementation target: use **Docker Engine API via python `docker` SDK** or direct HTTP to the socket proxy. Keep the access layer behind an interface.

---

## 3) Tech stack and packages

### 3.1 Core
- Python 3.12+
- Django 5.x
- Django REST Framework
- PostgreSQL (`psycopg`)
- `django-environ` for config
- `django-cors-headers` for CORS
- `drf-spectacular` for OpenAPI schema
- `structlog` OR `python-json-logger` for structured logs
- `sentry-sdk` (optional) for error tracking

### 3.2 Auth (preferred)
Use **cookie-based auth with JWT** for SPA:
- `djangorestframework-simplejwt` with:
  - **access token** returned by `/auth/login`
  - **refresh token** stored as **HttpOnly + Secure cookie**
  - rotating refresh + blacklist enabled
- CSRF:
  - If any authenticated endpoints ever rely on cookies, ensure CSRF is enforced correctly.
  - If you always use `Authorization: Bearer <access>`, CSRF surface is reduced.

Alternative acceptable: `dj-rest-auth` + `django-allauth`, but keep complexity low.

### 3.3 Security hardening (recommended)
- `django-axes` for login attempt throttling
- `argon2-cffi` for password hasher (enable Argon2)
- DRF throttling (`DEFAULT_THROTTLE_CLASSES`) for sensitive endpoints
- Strict `ALLOWED_HOSTS`, `SECURE_*` settings when behind TLS

---

## 4) Repository layout (backend)

```
devhub-backend/
  manage.py
  pyproject.toml
  README.md
  .env.example
  config/
    settings/
      base.py
      local.py
      prod.py
    urls.py
    asgi.py
    wsgi.py
  apps/
    accounts/
    core/
    docker_manager/
    audit/
  docs/
    api.md
    decisions.md
  tests/
```

Must be runnable via `docker compose up` and `pytest`.

---

## 5) Environment configuration

All config from env vars (12-factor). Provide `.env.example`.

Required env vars:
- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG` (false in prod)
- `DJANGO_ALLOWED_HOSTS`
- `DATABASE_URL`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `JWT_ACCESS_LIFETIME_MINUTES` (e.g., 10)
- `JWT_REFRESH_LIFETIME_DAYS` (e.g., 14)
- Docker access:
  - `DOCKER_HOST` (e.g. `unix:///var/run/docker.sock` or socket proxy base URL)
  - `DOCKER_TLS_VERIFY` (if applicable)
  - `DOCKER_CERT_PATH` (if applicable)

---

## 6) Data model (minimum)

### 6.1 User model
Use Django default User unless custom requirements emerge. Add `Profile` only if needed.

### 6.2 Audit Log (immutable)
Model: `AuditEvent`
- `id` UUID
- `created_at` datetime
- `actor` FK to User (nullable for system)
- `ip_address` string
- `user_agent` text
- `action` string enum (e.g., `container.start`, `container.stop`, `image.pull`)
- `resource_type` string (container/image/etc)
- `resource_id` string (Docker ID)
- `resource_name` string (best effort)
- `request_id` string (correlation id)
- `status` enum (`success`, `error`)
- `error_message` text nullable
- `metadata` JSON field (validated/sanitized; no secrets)

Must not be editable via admin except readonly views.

---

## 7) API design requirements

### 7.1 General API rules
- JSON only
- All endpoints under `/api/v1/`
- Consistent envelope:
  - For lists: `{ "results": [...], "count": n }` (pagination)
  - For errors: `{ "error": { "code": "...", "message": "...", "details": {...} } }`
- Pagination: DRF PageNumberPagination or LimitOffset (documented)
- Filtering: `django-filter` where applicable
- Validation: DRF serializers with explicit fields; never accept arbitrary dicts for container create.
- Idempotency: start/stop/restart endpoints return success when already in target state

### 7.2 Auth endpoints
`POST /api/v1/auth/login/`
- body: `{ "username": "", "password": "" }`
- returns: `{ "access": "<jwt>", "user": { ... } }`
- sets `refresh_token` HttpOnly cookie

`POST /api/v1/auth/refresh/`
- uses refresh cookie; returns new access token

`POST /api/v1/auth/logout/`
- blacklists refresh (if enabled), clears cookie

`GET /api/v1/auth/me/`
- returns current user details + roles

### 7.3 Docker Manager endpoints (V1)

System
- `GET /api/v1/docker/system/info/` (subset of Docker info, safe)
- `GET /api/v1/docker/system/version/`

Containers
- `GET /api/v1/docker/containers/` (supports `status`, `search`)
- `GET /api/v1/docker/containers/{id}/`
- `GET /api/v1/docker/containers/{id}/logs/?tail=200&since=...`
- `POST /api/v1/docker/containers/{id}/start/`
- `POST /api/v1/docker/containers/{id}/stop/`
- `POST /api/v1/docker/containers/{id}/restart/`
- `POST /api/v1/docker/containers/{id}/remove/` (admin only)
- `POST /api/v1/docker/containers/create/` (safe subset; see below)

Images
- `GET /api/v1/docker/images/`
- `POST /api/v1/docker/images/pull/` (Celery task recommended)
- `POST /api/v1/docker/images/{id}/remove/` (admin only)

Volumes
- `GET /api/v1/docker/volumes/`
- `POST /api/v1/docker/volumes/{name}/remove/` (admin only)

Networks
- `GET /api/v1/docker/networks/`

### 7.4 Container create payload (safe subset)
`POST /api/v1/docker/containers/create/`

Accept only:
- `name` (optional)
- `image` (required, string)
- `command` (optional string or array)
- `env` (optional map of string->string; max 50 keys)
- `ports` (optional list) each: `{ "containerPort": 80, "hostPort": 8080, "protocol": "tcp" }`
- `binds` (optional list) each: `{ "source": "/srv/devhub/data", "target": "/data", "readOnly": true }`
- `restartPolicy` (optional enum: `no`, `always`, `on-failure`, `unless-stopped`)
- `labels` (optional map; add `devhub.managed=true` automatically)

Reject:
- privileged mode
- host network
- mounting docker.sock
- device passthrough
- arbitrary capabilities
- any “dangerous” security options

---

## 8) Permissions and roles

Role model (simple):
- `admin`: full access
- `operator`: can start/stop/restart, view logs, pull images
- `viewer`: read-only

Implementation: Django Groups + DRF permission classes.

Rules:
- `viewer`: GET endpoints only
- `operator`: includes container lifecycle and image pull
- `admin`: includes removals and container create

---

## 9) Observability and audit

### 9.1 Request correlation
- Generate a `request_id` per request (middleware) and include in:
  - response header `X-Request-ID`
  - logs
  - audit events

### 9.2 Logging
- Structured JSON logs
- No secrets in logs

### 9.3 Audit events
Every state-changing operation must write an `AuditEvent`.

---

## 10) Testing requirements

- Use `pytest` + `pytest-django`
- Minimum tests:
  - auth login/refresh/logout
  - permission enforcement for each role
  - docker client wrapper unit tests (mock Docker SDK)
  - audit log created for state changes
- Add `ruff` + `mypy` (recommended)

---

## 11) Development workflow

- Provide `docker-compose.yml` for local dev:
  - backend
  - postgres
  - redis (optional)
- `make` targets recommended:
  - `make dev`
  - `make test`
  - `make lint`
  - `make format`
- Pre-commit hooks: ruff + formatting

---

## 12) Implementation notes for the LLM

Build order:
1. Project skeleton + settings split (base/local/prod).
2. Auth endpoints and role permissions.
3. Docker access layer (`DockerService`) with DI for tests.
4. Container listing and lifecycle endpoints.
5. Audit logging service + middleware for request context.
6. OpenAPI schema and docs.
7. Tests.

Deliverables:
- working API
- OpenAPI at `/api/schema/` and Swagger UI at `/api/docs/`
- dev admin bootstrap (env-based or management command)

---

## 13) Acceptance criteria (backend)

- `docker compose up` brings up API + DB
- Can login and fetch `/auth/me`
- Viewer can list containers but cannot start/stop
- Operator can start/stop/restart and view logs
- Admin can remove and create containers
- Every state change creates an audit record
- OpenAPI docs render
- Tests pass with `pytest`
