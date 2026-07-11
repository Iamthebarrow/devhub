# Quick Start

Get DevHub running locally in about 5 minutes. The entire stack runs inside Docker — no Python, Node, or Postgres installation required on your machine.

---

## Prerequisites

You need two things:

- **Docker Desktop** (or Docker Engine + Docker Compose) — [Install Docker](https://docs.docker.com/get-docker/)
- **Git**

That's it.

---

## 1. Clone the Repository

```bash
git clone https://github.com/Iamthebarrow/devhub.git
cd devhub
```

---

## 2. Configure Environment Variables

Copy the root environment template and open it in your editor:

```bash
cp .env.example .env
```

At minimum, change these two values before running:

| Variable | What to Set |
|---|---|
| `DJANGO_SECRET_KEY` | Any long random string — never share or commit this |
| `DEV_ADMIN_PASSWORD` | Your chosen admin password for the local admin account |

All other defaults work fine for local development.

!!! tip "Generating a Secret Key"
    You can generate a safe secret key with Python:
    ```bash
    python -c "import secrets; print(secrets.token_hex(50))"
    ```
    Or use any online random string generator.

---

## 3. Start the Stack

```bash
docker compose up --build
```

The first run downloads base images and builds the containers. This takes a couple of minutes. On subsequent runs it's much faster.

When you see the backend health check pass and the frontend container start, you're good to go.

---

## 4. Open the App

| Service | URL |
|---|---|
| Frontend (app) | [http://localhost:3100](http://localhost:3100) |
| Backend API | [http://localhost:8888/api/v1/](http://localhost:8888/api/v1/) |
| Swagger UI | [http://localhost:8888/api/docs/](http://localhost:8888/api/docs/) |
| Health check | [http://localhost:8888/api/v1/health/](http://localhost:8888/api/v1/health/) |

---

## 5. Log In

Navigate to [http://localhost:3100](http://localhost:3100). You'll see the login page.

Use the credentials you set in `.env`:

- **Username:** value of `DEV_ADMIN_USERNAME` (default: `admin`)
- **Password:** value of `DEV_ADMIN_PASSWORD` (default: `changeme`)

!!! warning "Change the Default Password"
    If you leave `DEV_ADMIN_PASSWORD=changeme` you'll have a working app, but please change it before exposing DevHub on any network beyond your local machine.

---

## 6. Stop the Stack

```bash
# Stop containers, keep data
docker compose down

# Stop containers and remove all data volumes (full reset)
docker compose down -v
```

---

## What's Running?

Six Docker services start together:

| Service | Role |
|---|---|
| `postgres` | PostgreSQL database |
| `redis` | Celery broker + result backend |
| `docker-socket-proxy` | Secure, read-limited proxy to the Docker socket |
| `backend` | Django API server (port 8888) |
| `worker` | Celery worker for background tasks |
| `frontend` | React dev server (port 3100) |

---

!!! success "Up and Running?"
    Once logged in, head to [Features](features.md) for a walkthrough of what each section does.
