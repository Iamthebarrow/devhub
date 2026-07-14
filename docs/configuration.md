# Configuration

All environment variables used by DevHub, with descriptions and safe defaults.

The root `.env` file (copied from `.env.example`) is what `docker-compose.yml` reads. For manual local development, the backend and frontend each have their own `.env.example`.

---

## Quick Reference: Required Variables

You must set these before your first run. Everything else has a working default.

| Variable | Where to Set | Notes |
|---|---|---|
| `DJANGO_SECRET_KEY` | Root `.env` | Any long random string, never commit |
| `DEV_ADMIN_PASSWORD` | Root `.env` | Password for the bootstrap admin account |

---

## Django Settings

| Variable | Default | Description |
|---|---|---|
| `DJANGO_SECRET_KEY` | *(required)* | Django's cryptographic secret. Generate with `python -c "import secrets; print(secrets.token_hex(50))"` |
| `DJANGO_DEBUG` | `True` | Set to `False` in production |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1,0.0.0.0,server` | Comma-separated list of allowed hostnames |

---

## Database

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://devhub:devhub_local_password@postgres:5432/devhub` | Full PostgreSQL connection URL |

!!! warning "Production Database"
    Change the password in `DATABASE_URL` before deploying anywhere beyond your local machine.

---

## CORS and CSRF

These must match the URL you use to access the frontend.

| Variable | Default | Description |
|---|---|---|
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3100,...` | Origins the frontend is served from (comma-separated) |
| `CSRF_TRUSTED_ORIGINS` | `http://localhost:3100,...` | Same value as `CORS_ALLOWED_ORIGINS` in most setups |

---

## JWT Tokens

| Variable | Default | Description |
|---|---|---|
| `JWT_ACCESS_LIFETIME_MINUTES` | `10` | How long the access token lives. Short by design: the refresh token extends the session transparently |
| `JWT_REFRESH_LIFETIME_DAYS` | `14` | How long the refresh cookie is valid |

---

## Admin Bootstrap

These are used once on first startup by the `devhub_bootstrap_roles` management command.

| Variable | Default | Description |
|---|---|---|
| `DEV_ADMIN_USERNAME` | `admin` | Username of the auto-created admin account |
| `DEV_ADMIN_PASSWORD` | `changeme` | Password of the auto-created admin account, **change this** |
| `DEV_ADMIN_EMAIL` | `admin@localhost` | Email for the admin account |

!!! tip
    After the first startup, changing these variables has no effect; the account already exists in the database. To reset, drop and recreate the database, or change the password through Django admin.

---

## Docker Connection

| Variable | Default | Description |
|---|---|---|
| `DOCKER_HOST` | `tcp://docker-socket-proxy:2375` | Address of the Docker daemon or socket proxy |
| `DOCKER_TLS_VERIFY` | *(empty)* | Set to `1` if connecting to a TLS-protected remote daemon |
| `DOCKER_CERT_PATH` | *(empty)* | Path to TLS certs if `DOCKER_TLS_VERIFY=1` |

---

## Celery (Background Tasks)

| Variable | Default | Description |
|---|---|---|
| `CELERY_BROKER_URL` | `redis://redis:6379/0` | Redis URL for the task queue |
| `CELERY_RESULT_BACKEND` | `redis://redis:6379/1` | Redis URL for task results |
| `CELERY_TASK_ALWAYS_EAGER` | `False` | Set to `True` in tests to run tasks synchronously |

---

## Frontend

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8888/api/v1` | Backend API URL as seen by the browser. Must be reachable from the client, not just from within Docker |

!!! warning "Remote Access"
    If accessing DevHub from another machine (e.g. over Tailscale), set `VITE_API_BASE_URL` to the backend's external hostname, not `localhost`. Example: `VITE_API_BASE_URL=http://server:8888/api/v1`

---

## Rate Limiting

| Variable | Default | Description |
|---|---|---|
| `THROTTLE_RATE_ANON` | `30/min` | Request limit for unauthenticated users |
| `THROTTLE_RATE_USER` | `120/min` | Request limit for authenticated users |
| `THROTTLE_RATE_LOGIN` | `10/min` | Request limit for the login endpoint |
| `THROTTLE_RATE_DOCKER_MUTATION` | `30/min` | Request limit for container lifecycle actions |

---

## Login Protection (django-axes)

| Variable | Default | Description |
|---|---|---|
| `AXES_FAILURE_LIMIT` | `5` | Number of consecutive failed login attempts before lockout |
| `AXES_COOLOFF_MINUTES` | `15` | How long a locked account stays locked |

---

## Logging

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `INFO` | Root Python logging level |
| `DJANGO_LOG_LEVEL` | `INFO` | Django framework logging level |
| `APP_LOG_LEVEL` | `INFO` | Application code logging level |

Logs are output as structured JSON. In production, route these to a log aggregator.

---

## Production Security Headers

These are safe to leave at their defaults for local development. In production, raise them.

| Variable | Default | Description |
|---|---|---|
| `SECURE_HSTS_SECONDS` | `60` | HSTS header duration in seconds. Start low (60) while testing, then raise to `31536000` (1 year) once you're confident |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` | `True` | Apply HSTS to all subdomains |
| `SECURE_HSTS_PRELOAD` | `False` | Enable only once HSTS is fully tested; adding to the preload list is very hard to undo |

---

## Migrations on Startup

| Variable | Default | Description |
|---|---|---|
| `RUN_MIGRATIONS` | `1` | Set to `1` to run `python manage.py migrate` automatically when the backend container starts. Safe to leave on for local development. Consider turning off in production if you manage migrations manually. |
