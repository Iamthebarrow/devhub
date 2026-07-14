# API Reference

The DevHub backend exposes a RESTful JSON API at `/api/v1/`. All authenticated endpoints require a `Bearer` token in the `Authorization` header.

An interactive Swagger UI is available at [http://localhost:8888/api/docs/](http://localhost:8888/api/docs/), so you can explore and test endpoints there without writing any code.

---

## Base URL

```
http://localhost:8888/api/v1/
```

---

## Authentication

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/auth/login/` | POST | None | Authenticate with username and password. Returns an access token; sets a refresh cookie. |
| `/auth/refresh/` | POST | Cookie | Exchange a valid refresh cookie for a new access token. |
| `/auth/logout/` | POST | Bearer | Invalidate the current refresh token. |
| `/auth/me/` | GET | Bearer | Return the current user's details and role memberships. |

### Login Request

```json
POST /api/v1/auth/login/
Content-Type: application/json

{
  "username": "admin",
  "password": "yourpassword"
}
```

### Login Response

```json
{
  "access": "<jwt-access-token>"
}
```

A `Set-Cookie` header is also returned with the `refresh` token as an HttpOnly cookie.

### Using the Access Token

Include it as a `Bearer` token on every subsequent request:

```
Authorization: Bearer <access-token>
```

---

## System

| Endpoint | Method | Auth | Role | Description |
|---|---|---|---|---|
| `/health/` | GET | None | Any | Returns `{ "status": "ok" }` (used by Docker healthchecks) |
| `/version/` | GET | None | Any | Returns API version information |
| `/docker/system/info/` | GET | Bearer | Viewer+ | Docker engine system info (sanitised) |
| `/docker/system/version/` | GET | Bearer | Viewer+ | Docker engine version |

---

## Containers

| Endpoint | Method | Auth | Role | Description |
|---|---|---|---|---|
| `/docker/containers/` | GET | Bearer | Viewer+ | List all containers |
| `/docker/containers/{id}/` | GET | Bearer | Viewer+ | Container detail |
| `/docker/containers/{id}/logs/` | GET | Bearer | Viewer+ | Container logs (tail) |
| `/docker/containers/{id}/start/` | POST | Bearer | Operator+ | Start a stopped container |
| `/docker/containers/{id}/stop/` | POST | Bearer | Operator+ | Stop a running container |
| `/docker/containers/{id}/restart/` | POST | Bearer | Operator+ | Restart a container |

### Container List Query Parameters

| Parameter | Type | Description |
|---|---|---|
| (none documented yet) | N/A | N/A |

### Log Query Parameters

| Parameter | Type | Description |
|---|---|---|
| `tail` | integer | Number of log lines to return (default varies) |
| `follow` | boolean | Whether to stream logs (tail mode) |

---

## Images

| Endpoint | Method | Auth | Role | Description |
|---|---|---|---|---|
| `/docker/images/` | GET | Bearer | Viewer+ | List all local images |
| `/docker/images/pull/` | POST | Bearer | Operator+ | Pull an image from a registry (async) |
| `/docker/images/{id}/remove/` | POST | Bearer | Admin | Remove a local image |

### Image Pull Request

```json
POST /api/v1/docker/images/pull/
Content-Type: application/json

{
  "image": "nginx:latest"
}
```

!!! note "Async Pull"
    Image pulls run as a Celery background task. The response acknowledges the task has been queued. Whether pull status is polled by the frontend is to be confirmed; see [Features](features.md#image-management).

---

## Volumes

| Endpoint | Method | Auth | Role | Description |
|---|---|---|---|---|
| `/docker/volumes/` | GET | Bearer | Viewer+ | List all Docker volumes (read-only) |

---

## Networks

| Endpoint | Method | Auth | Role | Description |
|---|---|---|---|---|
| `/docker/networks/` | GET | Bearer | Viewer+ | List all Docker networks (read-only) |

---

## Audit

| Endpoint | Method | Auth | Role | Description |
|---|---|---|---|---|
| `/audit/events/` | GET | Bearer | Viewer+ | List audit events |

### Audit Filter Query Parameters

| Parameter | Type | Description |
|---|---|---|
| `actor` | integer | Filter by user ID |
| `action` | string | Filter by action type (e.g. `container.start`) |
| `resource_type` | string | Filter by resource type (e.g. `container`) |
| `status` | string | `success` or `error` |
| `from` | datetime | Start of date range (ISO 8601) |
| `to` | datetime | End of date range (ISO 8601) |

---

## API Documentation (Swagger)

DevHub auto-generates an OpenAPI 3 schema using `drf-spectacular`.

| URL | Description |
|---|---|
| `/api/schema/` | Raw OpenAPI JSON, importable into Postman, Insomnia, etc. |
| `/api/docs/` | Interactive Swagger UI |

![Swagger UI showing the DevHub API endpoints](assets/images/swagger-ui.png)

---

## Error Responses

The API returns standard HTTP status codes:

| Code | Meaning |
|---|---|
| `200` | Success |
| `201` | Created |
| `204` | No content |
| `400` | Bad request: check the request body |
| `401` | Unauthenticated: missing or expired token |
| `403` | Forbidden: authenticated but insufficient role |
| `404` | Resource not found |
| `429` | Too many requests: rate limit hit |
| `500` | Server error: check backend logs |

Error responses include a JSON body:

```json
{
  "detail": "A human-readable error message."
}
```

---

## Role Summary

| Role | Read | Lifecycle Actions | Image Remove |
|---|---|---|---|
| `viewer` | ✓ | ✗ | ✗ |
| `operator` | ✓ | ✓ | ✗ |
| `admin` | ✓ | ✓ | ✓ |
