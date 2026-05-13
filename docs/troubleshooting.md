# Troubleshooting

Common problems and how to fix them.

---

## The Frontend Can't Reach the Backend

**Symptom:** The app loads but shows API errors or nothing loads after login.

**Causes and fixes:**

1. **Wrong `VITE_API_BASE_URL`**

    The frontend calls the API using the URL baked in at build time. Check that `.env` has:

    ```dotenv
    VITE_API_BASE_URL=http://localhost:8888/api/v1
    ```

    If you're accessing from another machine, replace `localhost` with the server's hostname or IP.

2. **Backend not running yet**

    The backend might still be starting. Check `docker compose logs backend` for errors or "Running on..." messages.

3. **CORS blocked**

    Open your browser dev tools → Network tab → look for a request blocked with a CORS error. Fix by adding the frontend origin to `.env`:

    ```dotenv
    CORS_ALLOWED_ORIGINS=http://localhost:3100
    CSRF_TRUSTED_ORIGINS=http://localhost:3100
    ```

    Restart the stack after changing `.env`.

---

## Login Fails / "Invalid credentials"

**Cause A — Wrong password**

Check `DEV_ADMIN_USERNAME` and `DEV_ADMIN_PASSWORD` in your `.env`. The bootstrap creates the admin account using these values on first startup only.

**Cause B — Account locked (django-axes)**

After 5 failed login attempts, the account is locked for 15 minutes. Wait for the cooldown to expire, or reset it manually:

```bash
docker compose exec backend python manage.py axes_reset
```

This resets all access attempt records. To unlock a specific user only:

```bash
docker compose exec backend python manage.py axes_reset_ip --ip <ip-address>
```

---

## Refresh Token / Cookie Issues

**Symptom:** Logged in, but the session drops after 10 minutes and you have to log in again.

**Cause:** The refresh token cookie isn't being sent or isn't being set.

**Fixes:**

1. Ensure the frontend is sending requests with `credentials: "include"` — this is handled by `src/api/client.ts`, so if you're accessing the API from a custom client, you need to set this manually.

2. Ensure the cookie origin matches. If the frontend is on `localhost:3100` and the backend is on `localhost:8888`, the cookie is cross-origin — this requires the backend to set `SameSite=None; Secure` on the cookie, which requires HTTPS.

    For local HTTP-only development, both frontend and backend need to be on the same hostname (just different ports). The default `localhost` setup should work.

---

## Backend Can't Reach Docker

**Symptom:** The Dashboard shows no containers, or actions fail with a connection error.

**Check 1 — Socket proxy is running:**

```bash
docker compose ps docker-socket-proxy
```

If it's not running, start it: `docker compose up -d docker-socket-proxy`

**Check 2 — `DOCKER_HOST` setting:**

Your `.env` should have:

```dotenv
DOCKER_HOST=tcp://docker-socket-proxy:2375
```

**Check 3 — Backend logs:**

```bash
docker compose logs backend
```

Look for `DockerConnectionError` or connection refused messages.

---

## Database Connection Errors

**Symptom:** Backend fails to start with a database error.

**Check 1 — Postgres is healthy:**

```bash
docker compose ps postgres
```

It should show `healthy`. If it's still starting, wait 10–15 seconds and check again.

**Check 2 — `DATABASE_URL` is correct:**

```dotenv
DATABASE_URL=postgres://devhub:devhub_local_password@postgres:5432/devhub
```

The hostname `postgres` is the Docker Compose service name — it resolves internally. Don't change it to `localhost` when running inside Docker.

**Check 3 — Run migrations manually:**

```bash
docker compose exec backend python manage.py migrate
```

---

## The Stack Starts But the Frontend Shows a Blank Page

**Cause A — Build error in the frontend container**

```bash
docker compose logs frontend
```

Look for TypeScript or Vite errors.

**Cause B — Backend health check not passing**

The frontend container waits for the backend to be healthy. If the backend health check is failing, the frontend won't start.

```bash
docker compose logs backend
```

---

## Containers / Images / etc. Show an Error State

**Symptom:** A page in the app shows an error state instead of data.

**Check the backend logs:**

```bash
docker compose logs backend --tail=50
```

Look for:
- `DockerConnectionError` — Docker socket proxy issue
- `ContainerNotFoundError` — the container was removed since the last API call
- `500` errors — unexpected exceptions

---

## Resetting Everything

If the environment is in a bad state and you want a clean start:

```bash
docker compose down -v   # Removes all containers AND data volumes
docker compose up --build
```

This wipes the database. You'll start with a fresh admin account from the bootstrap.

---

## Checking Service Health

```bash
# See the status of all services
docker compose ps

# Check the backend health endpoint directly
curl http://localhost:8888/api/v1/health/

# Tail all service logs
docker compose logs -f

# Tail a specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f worker
```

---

## Pre-commit Hook Failures (Contributors)

If a commit fails because of pre-commit hooks:

```bash
# Fix lint issues automatically
cd backend/devhub-backend && make format

# Or run hooks manually to see what failed
pre-commit run --all-files
```

---

## "ALLOWED_HOSTS" Error

**Symptom:** Django returns a `DisallowedHost` error.

Add the hostname to `.env`:

```dotenv
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0,server,<your-hostname>
```

Restart the backend.
