# DevHub

DevHub is a self-hosted Docker management dashboard with a Django + DRF backend and a React + Vite frontend. Manage containers, images, volumes, and networks from a browser, with role-based access control and an immutable audit log.

**[Full Documentation →](https://Iamthebarrow.github.io/devhub/)**

## Quick Start (Docker)

```bash
cp .env.example .env
# Set DJANGO_SECRET_KEY and DEV_ADMIN_PASSWORD in .env
docker compose up --build
```

## Services

- **Frontend**: http://localhost:3100 (or http://server:3100 if accessing remotely)
- **Backend API**: http://localhost:8888/api/v1/ (or http://server:8888/api/v1/)
- **Swagger Docs**: http://localhost:8888/api/docs/
- **OpenAPI Schema**: http://localhost:8888/api/schema/
- **Health**: http://localhost:8888/api/v1/health/
- **Version**: http://localhost:8888/api/v1/version/

## Stop and Clean Up

```bash
docker compose down
docker compose down -v
```

## Environment Variables (Root .env)

See `.env.example` for defaults. The key variables are:

- Backend config: `DJANGO_SECRET_KEY`, `DATABASE_URL`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`
- Docker access: `DOCKER_HOST` (defaults to socket proxy)
- Celery: `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`
- Frontend: `VITE_API_BASE_URL`

## Troubleshooting

### CORS or Cookie Issues

- Ensure `CORS_ALLOWED_ORIGINS` includes `http://localhost:3100`
- Ensure `CSRF_TRUSTED_ORIGINS` includes `http://localhost:3100`
- If using refresh cookies, the frontend must send `credentials: "include"`

### Accessing via Tailscale

This is the preferred setup for accessing DevHub from another device. Replace `<tailscale-hostname>` with your machine's Tailscale hostname (find it in the Tailscale admin panel or by running `tailscale status`).

```dotenv
VITE_API_BASE_URL=http://<tailscale-hostname>:8888/api/v1
CORS_ALLOWED_ORIGINS=http://localhost:3100,http://<tailscale-hostname>:3100
CSRF_TRUSTED_ORIGINS=http://localhost:3100,http://<tailscale-hostname>:3100
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,<tailscale-hostname>
```

Restart the stack after editing `.env`. No router port forwarding required — Tailscale handles the routing.

### Backend not reaching Docker

- The stack uses `docker-socket-proxy` by default.
- Confirm `DOCKER_HOST=tcp://docker-socket-proxy:2375` in `.env`.

## Defaults (Documented Decisions)

- **Frontend runtime**: Vite dev server in a container (for fast local iteration).
- **Docker access**: docker-socket-proxy enabled by default for safer Docker API access.
