# DevHub Backend

Django + DRF backend for DevHub server management suite.

## Requirements

- Python 3.12+
- Docker & Docker Compose
- Make (optional, for convenience commands)

## Quick Start

### 1. Clone and Setup

```bash
cd devhub-backend

# Copy environment file
cp .env.example .env

# Edit .env if needed (defaults work for local dev)
```

### 2. Start Development Environment

```bash
# Using Make
make dev

# Or using docker compose directly
docker compose up --build
```

This starts:
- Django backend at http://localhost:8000
- PostgreSQL database at localhost:5432
- Redis at localhost:6379
- Celery worker for background tasks

### 3. Run Migrations

```bash
# In a new terminal (while docker compose is running)
make migrate

# Or directly
docker compose exec backend python manage.py migrate
```

### 4. Bootstrap Roles and Create Admin

```bash
# Bootstrap roles (admin, operator, viewer groups)
docker compose exec backend python manage.py devhub_bootstrap_roles

# Bootstrap roles AND create admin user (uses DEV_ADMIN_* env vars)
docker compose exec backend python manage.py devhub_bootstrap_roles --create-admin

# Update password for existing admin user
docker compose exec backend python manage.py devhub_bootstrap_roles --create-admin --update-password
```

Or create a superuser manually:

```bash
make superuser

# Or directly
docker compose exec backend python manage.py createsuperuser
```

### 5. Access the API

- **API Root**: http://localhost:8000/api/v1/
- **Health Check**: http://localhost:8000/api/v1/health/
- **Version**: http://localhost:8000/api/v1/version/
- **Auth Login**: http://localhost:8000/api/v1/auth/login/
- **Docker System Info**: http://localhost:8000/api/v1/docker/system/info/ (requires auth)
- **Docker Version**: http://localhost:8000/api/v1/docker/system/version/ (requires auth)
- **Containers List**: http://localhost:8000/api/v1/docker/containers/ (requires auth)
- **Images List**: http://localhost:8000/api/v1/docker/images/ (requires auth)
- **Volumes List**: http://localhost:8000/api/v1/docker/volumes/ (requires auth)
- **Networks List**: http://localhost:8000/api/v1/docker/networks/ (requires auth)
- **Swagger Docs**: http://localhost:8000/api/docs/
- **OpenAPI Schema**: http://localhost:8000/api/schema/
- **Django Admin**: http://localhost:8000/admin/

## Development

### Project Structure

```
devhub-backend/
├── config/
│   ├── settings/
│   │   ├── base.py      # Shared settings
│   │   ├── local.py     # Development settings
│   │   └── prod.py      # Production settings
│   ├── urls.py
│   ├── celery.py
│   ├── asgi.py
│   └── wsgi.py
├── apps/
│   ├── accounts/        # Auth & users
│   ├── core/            # Health, version, system
│   ├── docker_manager/  # Docker operations
│   └── audit/           # Audit logging
├── docs/
│   ├── api.md
│   └── decisions.md
├── tests/
├── docker-compose.yml
├── Dockerfile
├── Makefile
├── pyproject.toml
└── .env.example
```

### Running Tests

Tests use SQLite in-memory and don't require Docker to be running:

```bash
# Using Make
make test

# With coverage report
make coverage

# Or directly
pytest
pytest --cov=apps --cov-report=term-missing
```

### Linting

```bash
# Check for issues
make lint

# Auto-fix and format
make format

# Or directly
ruff check .
ruff format .
```

### CI Pipeline

Run the full CI pipeline locally:

```bash
make ci
```

This runs:
1. `ruff check .` - Linting
2. `pytest` - Tests
3. `python manage.py spectacular --validate` - OpenAPI schema validation

### Pre-commit Hooks

```bash
# Install hooks
make install-hooks

# Or directly
pre-commit install
```

## Environment Variables

All configuration is via environment variables (12-factor). See `.env.example` for all available options.

### Core Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `DJANGO_SECRET_KEY` | Django secret key | **Required** |
| `DJANGO_DEBUG` | Enable debug mode | `False` |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated hosts | `localhost,127.0.0.1` |
| `DATABASE_URL` | PostgreSQL connection URL | **Required** |
| `CORS_ALLOWED_ORIGINS` | Comma-separated CORS origins | `http://localhost:5173` |
| `CSRF_TRUSTED_ORIGINS` | Comma-separated CSRF origins | `http://localhost:5173` |

### Authentication

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_ACCESS_LIFETIME_MINUTES` | JWT access token lifetime | `10` |
| `JWT_REFRESH_LIFETIME_DAYS` | JWT refresh token lifetime | `14` |

### Dev Admin Bootstrap

| Variable | Description | Default |
|----------|-------------|---------|
| `DEV_ADMIN_USERNAME` | Bootstrap admin username | *(empty)* |
| `DEV_ADMIN_PASSWORD` | Bootstrap admin password | *(empty)* |
| `DEV_ADMIN_EMAIL` | Bootstrap admin email | *(empty)* |

### Docker Access

| Variable | Description | Default |
|----------|-------------|---------|
| `DOCKER_HOST` | Docker engine socket/URL | `unix:///var/run/docker.sock` |
| `DOCKER_TLS_VERIFY` | Enable TLS verification | `False` |
| `DOCKER_CERT_PATH` | Path to TLS certificates | *(empty)* |

### Container & Audit

| Variable | Description | Default |
|----------|-------------|---------|
| `CONTAINER_LOGS_MAX_TAIL` | Max lines for logs endpoint | `2000` |
| `CONTAINER_LOGS_MAX_SIZE` | Max log response size (bytes) | `65536` (64KB) |
| `AUDIT_METADATA_MAX_SIZE` | Max audit metadata size (bytes) | `32768` (32KB) |
| `AUDIT_ERROR_MESSAGE_MAX_SIZE` | Max audit error message size | `4096` (4KB) |

### Celery / Redis

| Variable | Description | Default |
|----------|-------------|---------|
| `CELERY_BROKER_URL` | Redis broker URL for Celery | `redis://redis:6379/0` |
| `CELERY_RESULT_BACKEND` | Redis backend for task results | `redis://redis:6379/1` |
| `CELERY_TASK_ALWAYS_EAGER` | Run tasks synchronously | `False` |

### Security & Throttling

| Variable | Description | Default |
|----------|-------------|---------|
| `THROTTLE_RATE_ANON` | Rate limit for anonymous users | `30/min` |
| `THROTTLE_RATE_USER` | Rate limit for authenticated users | `120/min` |
| `THROTTLE_RATE_LOGIN` | Rate limit for login endpoint | `10/min` |
| `THROTTLE_RATE_DOCKER_MUTATION` | Rate limit for Docker mutations | `30/min` |
| `AXES_FAILURE_LIMIT` | Failed login attempts before lockout | `5` |
| `AXES_COOLOFF_MINUTES` | Lockout duration in minutes | `15` |

### Logging

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Root log level | `INFO` |
| `DJANGO_LOG_LEVEL` | Django log level | `INFO` |
| `APP_LOG_LEVEL` | Application log level | `INFO` |

### Production Security

| Variable | Description | Default |
|----------|-------------|---------|
| `SECURE_HSTS_SECONDS` | HSTS header duration | `60` |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` | Include subdomains in HSTS | `True` |
| `SECURE_HSTS_PRELOAD` | Enable HSTS preload | `False` |

## Throttling & Rate Limiting

DevHub implements multiple layers of protection against abuse:

### DRF Throttling
- **Anonymous users**: 30 requests/minute (default)
- **Authenticated users**: 120 requests/minute (default)
- **Login endpoint**: 10 requests/minute (scoped)
- **Docker mutations**: 30 requests/minute (start/stop/restart, image pull/remove)

Tune via environment variables: `THROTTLE_RATE_*`

### Django-Axes (Login Protection)
- **Lockout**: After 5 failed login attempts (default)
- **Duration**: 15 minutes (default)
- **Behavior**: Returns 403 Forbidden when locked out

#### Reset Lockouts
```bash
# Reset all lockouts
docker compose exec backend python manage.py axes_reset

# Reset for specific username
docker compose exec backend python manage.py axes_reset_username <username>

# Reset for specific IP
docker compose exec backend python manage.py axes_reset_ip <ip_address>
```

## Management Commands

### DevHub Commands

| Command | Description |
|---------|-------------|
| `devhub_bootstrap_roles` | Create admin/operator/viewer groups |
| `devhub_bootstrap_roles --create-admin` | Also create admin user from env vars |
| `devhub_bootstrap_roles --create-admin --update-password` | Update password if user exists |
| `devhub_check` | Check DB, Redis, Docker connectivity |
| `devhub_check --verbose` | Show detailed connection info |

### Axes Commands

| Command | Description |
|---------|-------------|
| `axes_reset` | Clear all lockouts |
| `axes_reset_username <user>` | Clear lockout for specific user |
| `axes_reset_ip <ip>` | Clear lockout for specific IP |

## Docker Compose Commands

```bash
# Start all services
docker compose up

# Start with rebuild
docker compose up --build

# Start in background
docker compose up -d

# View logs
docker compose logs -f backend

# Stop services
docker compose down

# Stop and remove volumes
docker compose down -v

# View worker logs
docker compose logs -f worker

# Include Docker socket proxy (recommended for production)
docker compose --profile with-socket-proxy up
```

## Docker Access

DevHub needs access to the Docker engine to manage containers. Two access modes are supported:

### Direct Socket (Local Dev Default)

The default configuration mounts the Docker socket directly:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

**Pros:** Simple, no additional services
**Cons:** Full Docker API access (security concern in production)

### Socket Proxy (Recommended for Production)

Use the `tecnativa/docker-socket-proxy` for controlled, filtered access:

```bash
# Start with socket proxy
docker compose --profile with-socket-proxy up

# Update .env
DOCKER_HOST=tcp://docker-socket-proxy:2375
```

**Pros:**
- Filters which Docker API endpoints are accessible
- Can restrict to read-only operations
- Better security isolation

**Cons:** Additional service to run

See [docs/decisions.md](docs/decisions.md) for the full rationale.

## Make Commands

| Command | Description |
|---------|-------------|
| `make dev` | Start development server |
| `make test` | Run pytest tests |
| `make coverage` | Run tests with coverage report |
| `make lint` | Run ruff linter |
| `make format` | Format code with ruff |
| `make ci` | Run full CI pipeline |
| `make schema-validate` | Validate OpenAPI schema |
| `make migrate` | Run Django migrations |
| `make shell` | Open Django shell |
| `make superuser` | Create superuser |
| `make bootstrap` | Bootstrap roles and admin user |
| `make check` | Run dependency health check |
| `make clean` | Stop and remove containers |
| `make install-hooks` | Install pre-commit hooks |

## Production Checklist

Before deploying to production:

### Required
- [ ] Set a strong, unique `DJANGO_SECRET_KEY` (not the default)
- [ ] Set `DJANGO_DEBUG=False`
- [ ] Set `DJANGO_ALLOWED_HOSTS` to your domain(s)
- [ ] Configure `CORS_ALLOWED_ORIGINS` for your frontend domain(s)
- [ ] Configure `CSRF_TRUSTED_ORIGINS` for your frontend domain(s)
- [ ] Deploy behind TLS-terminating reverse proxy (nginx, Caddy, etc.)
- [ ] Use Docker socket proxy instead of direct socket mount

### Security Headers
- [ ] Test with low `SECURE_HSTS_SECONDS=60` first
- [ ] After verification, increase to `SECURE_HSTS_SECONDS=31536000` (1 year)
- [ ] Consider enabling `SECURE_HSTS_PRELOAD=True` for HSTS preload list

### Cookie Settings (Automatic in prod.py)
- `SESSION_COOKIE_SECURE=True` (HTTPS only)
- `CSRF_COOKIE_SECURE=True` (HTTPS only)
- `REFRESH_TOKEN_COOKIE_SECURE=True` (HTTPS only)
- `SameSite=Lax` on all cookies

### Password Security
- Argon2 is used as the primary password hasher (more secure than PBKDF2)
- Existing PBKDF2 hashes are automatically upgraded on next login

### Recommended Deployment Architecture

```
                    ┌─────────────┐
                    │   Browser   │
                    └──────┬──────┘
                           │ HTTPS
                    ┌──────▼──────┐
                    │   Reverse   │
                    │    Proxy    │
                    │(nginx/Caddy)│
                    └──────┬──────┘
                           │ HTTP
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼───────┐  ┌───────▼───────┐  ┌───────▼───────┐
│    Backend    │  │    Worker     │  │    Frontend   │
│   (Gunicorn)  │  │   (Celery)    │  │   (Vite/SPA)  │
└───────┬───────┘  └───────┬───────┘  └───────────────┘
        │                  │
        │     ┌────────────┴────────────┐
        │     │                         │
┌───────▼─────▼─┐  ┌─────────────┐  ┌───▼───────────┐
│   PostgreSQL  │  │    Redis    │  │ Docker Socket │
│               │  │             │  │     Proxy     │
└───────────────┘  └─────────────┘  └───────┬───────┘
                                            │
                                    ┌───────▼───────┐
                                    │    Docker     │
                                    │    Engine     │
                                    └───────────────┘
```

## API Documentation

See [docs/api.md](docs/api.md) for API documentation.

Interactive documentation available at http://localhost:8000/api/docs/ when running locally.

## Architecture Decisions

See [docs/decisions.md](docs/decisions.md) for Architecture Decision Records covering:
- Settings structure
- JWT authentication strategy
- Docker access methods
- Audit logging
- Throttling and rate limiting
- Password hashing
- And more...
