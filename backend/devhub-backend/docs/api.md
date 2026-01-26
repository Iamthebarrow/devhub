# DevHub API Documentation

## Overview

DevHub is a server management suite API. All endpoints are under `/api/v1/`.

## OpenAPI Documentation

- **Schema**: `GET /api/schema/` - OpenAPI 3.0 schema (JSON/YAML)
- **Swagger UI**: `GET /api/docs/` - Interactive API documentation

## Authentication

DevHub uses JWT authentication with refresh tokens stored in HttpOnly cookies.

### Flow

1. **Login**: POST to `/api/v1/auth/login/` with credentials
   - Returns `access` token in JSON response
   - Sets `refresh_token` as HttpOnly cookie
2. **Use API**: Include access token in `Authorization: Bearer <token>` header
3. **Refresh**: POST to `/api/v1/auth/refresh/` when access token expires
   - Uses refresh token from cookie
   - Returns new access token
   - Rotates refresh cookie
4. **Logout**: POST to `/api/v1/auth/logout/`
   - Blacklists refresh token
   - Clears refresh cookie

### Frontend Integration

```javascript
// Login
const response = await fetch('/api/v1/auth/login/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // Required for cookies
  body: JSON.stringify({ username, password })
});
const { access, user } = await response.json();

// Store access token (e.g., in memory or localStorage)

// Use authenticated API calls
const data = await fetch('/api/v1/some-endpoint/', {
  headers: { 'Authorization': `Bearer ${access}` }
});

// Refresh token (when access expires)
const refreshResponse = await fetch('/api/v1/auth/refresh/', {
  method: 'POST',
  credentials: 'include'  // Required for cookies
});
const { access: newAccess } = await refreshResponse.json();

// Logout
await fetch('/api/v1/auth/logout/', {
  method: 'POST',
  credentials: 'include'
});
```

## Auth Endpoints (Phase 2)

### Login
```
POST /api/v1/auth/login/
```

Authenticate user and receive access token. Refresh token is set as HttpOnly cookie.

**Request:**
```json
{
  "username": "user",
  "password": "password"
}
```

**Response (200):**
```json
{
  "access": "<jwt_access_token>",
  "user": {
    "id": 1,
    "username": "user",
    "email": "user@example.com",
    "roles": ["viewer"]
  }
}
```

**Response (401):**
```json
{
  "error": {
    "code": "auth_failed",
    "message": "Invalid credentials"
  }
}
```

### Refresh Token
```
POST /api/v1/auth/refresh/
```

Get new access token using refresh token from cookie. Rotates the refresh token.

**Request:** No body required. Uses `refresh_token` cookie.

**Response (200):**
```json
{
  "access": "<new_jwt_access_token>"
}
```

**Response (401):**
```json
{
  "error": {
    "code": "auth_failed",
    "message": "Invalid or expired token"
  }
}
```

### Logout
```
POST /api/v1/auth/logout/
```

Blacklist refresh token and clear cookie.

**Response (200):**
```json
{
  "ok": true
}
```

### Get Current User
```
GET /api/v1/auth/me/
```

Returns the currently authenticated user's information. **Requires authentication.**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "id": 1,
  "username": "user",
  "email": "user@example.com",
  "roles": ["viewer", "operator"]
}
```

**Response (401):**
```json
{
  "detail": "Authentication credentials were not provided."
}
```

## System Endpoints (Phase 1)

### Health Check
```
GET /api/v1/health/
```

Returns the health status of the API. **Public endpoint.**

**Response:**
```json
{
  "status": "ok"
}
```

### Version
```
GET /api/v1/version/
```

Returns the API name and version. **Public endpoint.**

**Response:**
```json
{
  "name": "devhub",
  "api": "v1"
}
```

## Roles and Permissions

DevHub uses three roles (implemented via Django Groups):

| Role | Description | Access Level |
|------|-------------|--------------|
| `viewer` | Read-only access | Lowest |
| `operator` | Can start/stop/restart containers, view logs, pull images | Medium |
| `admin` | Full access including removals and container creation | Highest |

Role hierarchy: `admin` > `operator` > `viewer`

Users can have multiple roles. Access is granted if the user has the required role or higher.

## Error Format

All authentication errors follow this format:

```json
{
  "error": {
    "code": "error_code",
    "message": "Human-readable message",
    "details": {}  // Optional additional details
  }
}
```

## Docker System Endpoints (Phase 3)

Docker endpoints require authentication with at least `viewer` role.

### Get Docker System Info
```
GET /api/v1/docker/system/info/
```

Returns sanitized Docker system information. **Requires authentication (viewer+).**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "id": "ABC123...",
  "name": "docker-host",
  "operatingSystem": "Ubuntu 22.04.3 LTS",
  "osType": "linux",
  "architecture": "x86_64",
  "serverVersion": "24.0.7",
  "containers": 10,
  "containersRunning": 5,
  "containersPaused": 1,
  "containersStopped": 4,
  "images": 25,
  "memTotal": 16777216000,
  "ncpu": 8
}
```

**Response (401):**
```json
{
  "detail": "Authentication credentials were not provided."
}
```

**Response (503):**
```json
{
  "error": {
    "code": "docker_unavailable",
    "message": "Docker engine is not available"
  }
}
```

### Get Docker Version
```
GET /api/v1/docker/system/version/
```

Returns Docker version information. **Requires authentication (viewer+).**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "version": "24.0.7",
  "apiVersion": "1.43",
  "gitCommit": "afdd53b",
  "goVersion": "go1.20.10",
  "os": "linux",
  "arch": "amd64"
}
```

**Response (503):**
```json
{
  "error": {
    "code": "docker_unavailable",
    "message": "Docker engine is not available"
  }
}
```

## Container Endpoints (Phase 4)

Container endpoints require authentication. Read operations (list, detail, logs) require `viewer` role. Lifecycle operations (start, stop, restart) require `operator` role or higher.

All lifecycle operations create an audit event.

### List Containers
```
GET /api/v1/docker/containers/
```

Returns a list of containers with optional filtering. **Requires authentication (viewer+).**

**Query Parameters:**
- `status` (optional): Filter by status - `running`, `exited`, `paused`, or `all` (default: all)
- `search` (optional): Search string to match against name, image, or ID

**Response (200):**
```json
{
  "results": [
    {
      "id": "abc123",
      "name": "my-container",
      "image": "nginx:latest",
      "state": "running",
      "status": "Up 2 hours",
      "created": "2024-01-15T10:00:00Z",
      "ports": [
        {
          "containerPort": 80,
          "hostPort": 8080,
          "hostIp": "",
          "protocol": "tcp"
        }
      ],
      "labels": {
        "app": "web"
      }
    }
  ],
  "count": 1
}
```

### Get Container Detail
```
GET /api/v1/docker/containers/{id}/
```

Returns detailed information about a specific container. **Requires authentication (viewer+).**

**Response (200):**
```json
{
  "id": "abc123",
  "fullId": "abc123def456789...",
  "name": "my-container",
  "image": "nginx:latest",
  "state": "running",
  "status": "Up 2 hours",
  "created": "2024-01-15T10:00:00Z",
  "ports": [...],
  "labels": {...},
  "mounts": [
    {
      "target": "/data",
      "type": "volume",
      "readOnly": false
    }
  ],
  "networks": [
    {
      "name": "bridge",
      "ipAddress": "172.17.0.2"
    }
  ],
  "restartPolicy": {
    "name": "always",
    "maximumRetryCount": 0
  }
}
```

**Response (404):**
```json
{
  "error": {
    "code": "container_not_found",
    "message": "Container not found"
  }
}
```

### Get Container Logs
```
GET /api/v1/docker/containers/{id}/logs/
```

Returns container logs. **Requires authentication (viewer+).**

**Query Parameters:**
- `tail` (optional): Number of lines to return (default: 200, max: 2000)
- `since` (optional): Return logs since timestamp (ISO format or Unix timestamp)

**Response (200):**
```json
{
  "logs": "2024-01-15T10:00:00Z Container started\n2024-01-15T10:00:01Z Ready",
  "truncated": false
}
```

Note: Logs are truncated to 64KB maximum. If truncated, `truncated` will be `true`.

### Start Container
```
POST /api/v1/docker/containers/{id}/start/
```

Starts a stopped container. **Idempotent** - returns success if already running. **Requires authentication (operator+).** Creates audit event.

**Response (200):**
```json
{
  "ok": true,
  "message": "Container started"
}
```

**Response (400):**
```json
{
  "error": {
    "code": "operation_failed",
    "message": "Failed to start container"
  }
}
```

### Stop Container
```
POST /api/v1/docker/containers/{id}/stop/
```

Stops a running container. **Idempotent** - returns success if already stopped. **Requires authentication (operator+).** Creates audit event.

**Response (200):**
```json
{
  "ok": true,
  "message": "Container stopped"
}
```

### Restart Container
```
POST /api/v1/docker/containers/{id}/restart/
```

Restarts a container (stop + start). **Requires authentication (operator+).** Creates audit event.

**Response (200):**
```json
{
  "ok": true,
  "message": "Container restarted"
}
```

## Request Correlation

All API responses include an `X-Request-ID` header containing a unique UUID for request tracing. This ID is also stored in audit events for correlation.

## Image Endpoints (Phase 5)

Image pull and remove operations run as background tasks via Celery.

### List Images
```
GET /api/v1/docker/images/
```

Returns a list of Docker images. **Requires authentication (viewer+).**

**Response (200):**
```json
{
  "results": [
    {
      "id": "abc123",
      "fullId": "sha256:abc123def456...",
      "tags": ["nginx:latest", "nginx:1.25"],
      "size": 192000000,
      "created": "2024-01-15T10:00:00Z",
      "labels": {"maintainer": "NGINX Docker Maintainers"}
    }
  ],
  "count": 1
}
```

### Pull Image
```
POST /api/v1/docker/images/pull/
```

Queues a Docker image pull operation. **Requires authentication (operator+).** Creates audit event when task completes.

**Request:**
```json
{
  "image": "nginx:latest"
}
```

**Response (202):**
```json
{
  "status": "queued",
  "task_id": "abc123-def456-..."
}
```

**Response (400):**
```json
{
  "error": {
    "code": "invalid_image_name",
    "message": "Image name contains invalid characters"
  }
}
```

Note: Only alphanumeric characters, dots, underscores, hyphens, slashes, and colons are allowed in image names. Maximum length is 200 characters.

### Remove Image
```
POST /api/v1/docker/images/{id}/remove/
```

Queues a Docker image removal operation. **Requires authentication (admin only).** Creates audit event when task completes.

**Request (optional):**
```json
{
  "force": false
}
```

**Response (202):**
```json
{
  "status": "queued",
  "task_id": "abc123-def456-..."
}
```

## Volume Endpoints (Phase 5)

### List Volumes
```
GET /api/v1/docker/volumes/
```

Returns a list of Docker volumes. Does not include host mount paths for security. **Requires authentication (viewer+).**

**Response (200):**
```json
{
  "results": [
    {
      "name": "my-data",
      "driver": "local",
      "scope": "local",
      "created": "2024-01-10T12:00:00Z",
      "labels": {}
    }
  ],
  "count": 1
}
```

## Network Endpoints (Phase 5)

### List Networks
```
GET /api/v1/docker/networks/
```

Returns a list of Docker networks. **Requires authentication (viewer+).**

**Response (200):**
```json
{
  "results": [
    {
      "id": "net123",
      "name": "bridge",
      "driver": "bridge",
      "scope": "local",
      "internal": false,
      "subnets": ["172.17.0.0/16"],
      "labels": {}
    }
  ],
  "count": 1
}
```

## Background Tasks

Phase 5 introduces Celery for background task processing. Image pull and remove operations run asynchronously.

**Task Flow:**
1. API endpoint validates request and enqueues task
2. Returns immediately with `{"status": "queued", "task_id": "..."}`
3. Celery worker executes operation in background
4. AuditEvent created on completion (success or failure)

**Note:** Task status polling is not yet implemented. Future phases may add a `/api/v1/tasks/{id}/` endpoint.

## Future Endpoints (Not Yet Implemented)

See `backend_specs_guideline.md` for the full API specification including:

- Container create/remove endpoints
- Volume/network create/remove endpoints
- Task status polling
- Audit read endpoints
