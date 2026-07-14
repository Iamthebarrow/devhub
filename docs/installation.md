# Installation

This page covers the full installation process in detail, including environment variable configuration, service dependencies, and the optional manual setup path for contributors.

---

## Option A: Docker Compose (Recommended)

This is the standard way to run DevHub. All dependencies are containerised, so you do not need to install Python, Node, or PostgreSQL locally.

### Step 1: Clone

```bash
git clone https://github.com/Iamthebarrow/devhub.git
cd devhub
```

### Step 2: Environment Files

DevHub uses three `.env` files. You need the root one at minimum.

#### Root `.env` (required)

```bash
cp .env.example .env
```

Open `.env` and set these required values:

```dotenv
DJANGO_SECRET_KEY=<your-long-random-secret-key>
DEV_ADMIN_PASSWORD=<your-admin-password>
```

See the [Configuration page](configuration.md) for the full list of variables and what they control.

#### Backend `.env` (optional, only for manual setup)

```bash
cp backend/devhub-backend/.env.example backend/devhub-backend/.env
```

#### Frontend `.env` (optional, only for manual setup)

```bash
cp frontend/devhub-frontend/.env.example frontend/devhub-frontend/.env
```

### Step 3: Build and Run

```bash
docker compose up --build
```

### Step 4: Verify

Visit [http://localhost:8888/api/v1/health/](http://localhost:8888/api/v1/health/): you should get a `200 OK` response with a JSON status payload.

Visit [http://localhost:3100](http://localhost:3100): you should see the login page.

---

## Option B: Manual Setup (for Contributors)

If you are working on the backend or frontend code directly and want faster iteration without rebuilding containers, you can run each service manually.

### Prerequisites

| Tool | Version |
|---|---|
| Python | 3.12+ |
| Node.js | 20+ |
| npm | 9+ |
| PostgreSQL | 16 |
| Redis | 7 |

### Backend

```bash
cd backend/devhub-backend

# Create a virtual environment
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate

# Install dependencies
pip install -e ".[dev]"

# Set up environment
cp .env.example .env
# Edit .env: point DATABASE_URL at your local Postgres, set DOCKER_HOST, etc.

# Apply migrations
python manage.py migrate

# Bootstrap roles and admin user
python manage.py devhub_bootstrap_roles

# Start the dev server
python manage.py runserver 0.0.0.0:8888
```

### Celery Worker

In a separate terminal:

```bash
cd backend/devhub-backend
source .venv/bin/activate
celery -A config worker -l INFO --concurrency=2
```

### Frontend

```bash
cd frontend/devhub-frontend

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env: set VITE_API_BASE_URL=http://localhost:8888/api/v1

# Start the dev server
npm run dev
```

The frontend runs on `http://localhost:5173` by default when using Vite directly (not containerised).

---

## Resetting the Environment

```bash
# Stop everything and remove containers
docker compose down

# Full reset: removes all data including the database
docker compose down -v

# Rebuild images from scratch
docker compose up --build --force-recreate
```

---

## Updating DevHub

```bash
git pull origin main
docker compose up --build
```

If there are new migrations, they run automatically on backend container startup when `RUN_MIGRATIONS=1` is set (the default).

---

!!! note "Docker Socket Proxy"
    DevHub uses a `docker-socket-proxy` service to safely expose Docker API access to the backend. This proxy restricts which Docker API operations the backend can call. You do not need to do anything special to enable this; it is included in `docker-compose.yml` and configured automatically.
