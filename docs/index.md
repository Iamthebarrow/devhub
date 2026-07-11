# Docs

**A self-hosted Docker management dashboard — built for developers who want visibility and control without the complexity.**

DevHub gives you a clean web interface to manage your local Docker environment. View running containers, pull images, inspect volumes and networks, trigger container lifecycle actions, and keep a full audit trail of who did what — all through a browser.

---

![DevHub dashboard showing container counts, system stats, and the main navigation sidebar](assets/images/dashboard-page.png)

---

## What DevHub Does

| Feature | Summary |
|---|---|
| Container management | List, start, stop, restart, and view logs for containers |
| Image management | List local images, pull new ones, remove unused ones |
| Volume listing | Read-only view of all Docker volumes |
| Network listing | Read-only view of all Docker networks |
| System dashboard | High-level Docker engine stats at a glance |
| Audit log | Immutable, append-only record of every action taken |
| Role-based access | Three roles: `admin`, `operator`, `viewer` |

## Who It's For

- **Developers** running multi-container projects locally who want a visual alternative to `docker ps` and `docker logs`
- **Small teams** who want a lightweight, self-hosted management layer with access control
- **Hobbyists** running homelab stacks who want audit trails and a cleaner UI

## Tech Stack at a Glance

```
Frontend  →  React 19 · TypeScript · Vite · Tailwind CSS 4 · TanStack Query
Backend   →  Django 5 · Django REST Framework · Celery · JWT auth
Database  →  PostgreSQL 16
Cache     →  Redis 7
Infra     →  Docker Compose (6 services)
```

## Quick Links

- [Quick Start →](getting-started.md) — Up and running in 5 minutes
- [Features →](features.md) — What each part of the app does
- [API Reference →](api.md) — Full endpoint list
- [Configuration →](configuration.md) — All environment variables
- [Troubleshooting →](troubleshooting.md) — Common issues and fixes

---

!!! note "Project Status"
    DevHub is actively developed. Some features (custom user profiles, persistent Docker resource models) are planned for future phases and are called out where relevant in these docs.
