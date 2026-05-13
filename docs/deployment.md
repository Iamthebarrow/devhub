# Deployment

How to run DevHub in a more stable or production-like setup, and what to harden before exposing it to a network.

!!! warning "DevHub is Local-First"
    DevHub was built for local and homelab use. The default configuration (Vite dev server for the frontend, `DEBUG=True`, `changeme` password) is intentionally optimised for fast local iteration, not hardened for public internet exposure. Read this page carefully if you plan to run it anywhere else.

---

## Local Development (Default)

The standard Docker Compose setup is covered in [Installation](installation.md). All six services start together:

```bash
cp .env.example .env
# Edit .env — at minimum set DJANGO_SECRET_KEY and DEV_ADMIN_PASSWORD
docker compose up --build
```

Services:

| Service | Port |
|---|---|
| Frontend | [http://localhost:3100](http://localhost:3100) |
| Backend API | [http://localhost:8888/api/v1/](http://localhost:8888/api/v1/) |
| Swagger UI | [http://localhost:8888/api/docs/](http://localhost:8888/api/docs/) |

---

## Accessing from Another Machine (e.g. Tailscale / LAN)

If you want to access DevHub from another device on the same network or over a VPN:

1. Set `VITE_API_BASE_URL` to the backend's hostname as seen by the browser — not `localhost`:

    ```dotenv
    VITE_API_BASE_URL=http://server:8888/api/v1
    ```

2. Add the frontend's external origin to CORS and CSRF settings:

    ```dotenv
    CORS_ALLOWED_ORIGINS=http://localhost:3100,http://server:3100
    CSRF_TRUSTED_ORIGINS=http://localhost:3100,http://server:3100
    ```

3. Add the server hostname to `DJANGO_ALLOWED_HOSTS`:

    ```dotenv
    DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,server
    ```

4. Restart the stack:

    ```bash
    docker compose up --build
    ```

---

## Hardening for a More Stable Setup

If you want to run DevHub with more stability (not necessarily public-facing), here is the checklist from the backend README:

### Security

- [ ] Set a strong, random `DJANGO_SECRET_KEY`
- [ ] Change `DEV_ADMIN_PASSWORD` to something real
- [ ] Set `DJANGO_DEBUG=False`
- [ ] Use a strong password in `DATABASE_URL`
- [ ] Set `SECURE_HSTS_SECONDS=31536000` (after testing HTTPS first)
- [ ] Configure `SECURE_HSTS_INCLUDE_SUBDOMAINS=True` once HSTS is stable
- [ ] Put the app behind HTTPS (see below)

### Performance / Reliability

- [ ] Replace the Vite dev server with a production frontend build served via Nginx or a static host
- [ ] Add persistent volume backups for `postgres_data`

### HTTPS

The current Docker Compose setup does not include a TLS terminator. To add HTTPS you have several options:

**Option A — Nginx reverse proxy (local/self-signed)**

Add an Nginx container to `docker-compose.yml` that listens on 443, terminates TLS, and proxies to `frontend:3100` and `backend:8888`.

**Option B — Caddy (automatic HTTPS)**

Replace Nginx with a [Caddy](https://caddyserver.com/) container. Caddy handles certificate provisioning automatically for public domains.

**Option C — Cloudflare Tunnel**

For homelab use without opening router ports: use a Cloudflare Tunnel to expose DevHub securely.

---

## Useful Makefile Commands

The root Makefile (and the backend Makefile) provide shortcuts:

```bash
# Start full stack (build if needed)
make dev

# Run backend tests
make test

# Run with coverage
make coverage

# Lint
make lint

# Format code
make format

# Run migrations manually (if RUN_MIGRATIONS=0)
make migrate

# Bootstrap roles + admin (already runs on first startup)
make bootstrap

# Check service health
make check
```

---

## Resetting the Database

```bash
# Stop and remove all data
docker compose down -v

# Start fresh
docker compose up --build
```

Migrations and the admin bootstrap run automatically on startup.

---

## Updating

```bash
git pull origin main
docker compose up --build
```

If the update includes new migrations, they apply automatically on backend container start (when `RUN_MIGRATIONS=1`).

---

## Environment Variables at a Glance

Full reference: [Configuration →](configuration.md)

The most important ones to change from defaults before any non-local use:

```dotenv
DJANGO_SECRET_KEY=<your-long-random-string>
DJANGO_DEBUG=False
DEV_ADMIN_PASSWORD=<something-strong>
DATABASE_URL=postgres://devhub:<strong-password>@postgres:5432/devhub
VITE_API_BASE_URL=http://<your-host>:8888/api/v1
CORS_ALLOWED_ORIGINS=http://<your-host>:3100
CSRF_TRUSTED_ORIGINS=http://<your-host>:3100
DJANGO_ALLOWED_HOSTS=<your-host>,localhost
SECURE_HSTS_SECONDS=31536000
```
