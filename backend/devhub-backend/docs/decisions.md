# Architecture Decision Records

This document tracks design decisions made during DevHub backend development.

## Phase 1 Decisions

### ADR-001: Settings Structure

**Decision:** Split Django settings into `base.py`, `local.py`, and `prod.py`.

**Rationale:**
- `base.py` contains shared settings for all environments
- `local.py` has development-specific settings (DEBUG=True, browsable API)
- `prod.py` has production security settings (HTTPS, secure cookies)
- Follows 12-factor app principles with `django-environ`

### ADR-002: Test Database

**Decision:** Use SQLite in-memory for tests instead of requiring PostgreSQL.

**Rationale:**
- Tests can run without Docker
- Faster test execution
- CI/CD friendly
- Production runtime still uses PostgreSQL via docker compose

### ADR-003: OpenAPI via drf-spectacular

**Decision:** Use `drf-spectacular` for OpenAPI schema generation.

**Rationale:**
- Well-maintained and actively developed
- Good Django REST Framework integration
- Supports OpenAPI 3.0
- Built-in Swagger UI

### ADR-004: Redis as Optional Service

**Decision:** Define Redis in docker-compose.yml but make it optional (using profiles).

**Rationale:**
- Not needed for Phase 1
- Ready for Celery integration in future phases
- Keeps initial setup simple

## Phase 2 Decisions

### ADR-005: JWT with Cookie Refresh

**Decision:** Use `djangorestframework-simplejwt` with refresh token stored in HttpOnly cookie.

**Rationale:**
- Access token returned in JSON, used via Authorization header
- Refresh token stored in HttpOnly cookie (not exposed to JavaScript)
- Token rotation and blacklisting enabled for security
- Simple, well-maintained library

## Phase 3 Decisions

### ADR-006: Docker Access Method

**Decision:** Support both direct socket and socket proxy access, with socket proxy RECOMMENDED for production.

**Access Modes:**
1. **Direct Socket** (local dev default): `DOCKER_HOST=unix:///var/run/docker.sock`
   - Requires mounting Docker socket into container
   - Simple setup for local development
   - Not recommended for production (security concerns)

2. **Socket Proxy** (recommended for production): `DOCKER_HOST=tcp://docker-socket-proxy:2375`
   - Uses a filtering proxy (e.g., `tecnativa/docker-socket-proxy`)
   - Proxy controls which Docker API endpoints are accessible
   - Better security isolation
   - Can limit to read-only operations

**Rationale:**
- Socket proxy provides an additional security layer
- Can restrict to specific Docker operations (info, version, list containers)
- Prevents accidental exposure of dangerous operations
- DevHub never exposes raw Docker Engine API to browser

**Local Development:**
- DEFAULT: Socket proxy enabled in the root docker-compose for safer Docker API access
- Optional: Direct socket mount is still available for trusted single-user setups (documented as insecure)

### ADR-007: Docker SDK vs Direct HTTP

**Decision:** Use Python Docker SDK (`docker` package).

**Rationale:**
- Official Docker SDK for Python
- Clean abstraction over both unix socket and TCP connections
- Well-tested, maintained by Docker Inc.
- Works with both direct socket and proxy transparently

### ADR-008: Sanitized Docker Responses

**Decision:** Return only a sanitized subset of Docker info/version data.

**Rationale:**
- Never expose sensitive host information (paths, env vars, security config)
- Safe-by-design: even if DockerService is misused, no secrets leak
- Frontend receives only the fields it needs
- Easy to audit what data is exposed

**Allowed Fields (info):**
- id, name, operatingSystem, osType, architecture
- serverVersion, containers, containersRunning, containersPaused, containersStopped
- images, memTotal, ncpu

**Allowed Fields (version):**
- version, apiVersion, gitCommit, goVersion, os, arch

## Phase 4 Decisions

### ADR-009: AuditEvent Model

**Decision:** Implement immutable audit log with UUID primary key and append-only semantics.

**Schema:**
- `id` UUID (primary key)
- `created_at` datetime (auto, indexed)
- `actor` FK to User (nullable for system actions)
- `ip_address`, `user_agent` (request context)
- `action` string (e.g., "container.start", "container.stop")
- `resource_type`, `resource_id`, `resource_name`
- `request_id` (correlation ID)
- `status` enum (success/error)
- `error_message` (nullable, sanitized)
- `metadata` JSON (sanitized, no secrets)

**Rationale:**
- UUID allows distributed generation without collisions
- Immutable records ensure audit integrity
- Sanitization prevents accidental secret logging
- Request ID enables correlation across logs

### ADR-010: Request Correlation

**Decision:** Generate UUID request_id per request via middleware, expose via X-Request-ID header.

**Rationale:**
- Enables tracing requests across audit logs and application logs
- Standard header format (X-Request-ID)
- Thread-local storage makes it accessible throughout request lifecycle

### ADR-011: Container Lifecycle Permissions

**Decision:** Viewer can read, Operator+ can mutate (start/stop/restart).

**Permission Matrix:**
| Action | Viewer | Operator | Admin |
|--------|--------|----------|-------|
| List containers | ✓ | ✓ | ✓ |
| View container detail | ✓ | ✓ | ✓ |
| View container logs | ✓ | ✓ | ✓ |
| Start container | ✗ | ✓ | ✓ |
| Stop container | ✗ | ✓ | ✓ |
| Restart container | ✗ | ✓ | ✓ |

**Rationale:**
- Viewers need read access for monitoring
- Operators need lifecycle control for incident response
- Admins inherit all operator permissions

### ADR-012: Idempotent Lifecycle Operations

**Decision:** Start/stop operations return success if container is already in target state.

**Rationale:**
- Prevents errors from retry logic
- Simplifies frontend state management
- Follows REST best practices for idempotent operations

### ADR-013: Log Truncation and Safety Limits

**Decision:** Enforce size limits on log responses and audit metadata.

**Defaults:**
- `CONTAINER_LOGS_MAX_TAIL`: 2000 lines
- `CONTAINER_LOGS_MAX_SIZE`: 64KB response cap
- `AUDIT_METADATA_MAX_SIZE`: 32KB per string field
- `AUDIT_ERROR_MESSAGE_MAX_SIZE`: 4KB

**Rationale:**
- Prevents DB bloat from large log storage
- Protects against memory exhaustion
- Truncation indicator allows UI to show partial data

### ADR-014: Container Response Sanitization

**Decision:** Only return safe container fields; exclude source paths from mounts.

**Allowed Fields (list):**
- id, name, image, state, status, created
- ports (containerPort, hostPort, protocol)
- labels (filtered - no secret-prefixed keys)

**Allowed Fields (detail):**
- All list fields plus:
- fullId, mounts (target + type + readOnly only), networks (name + IP)
- restartPolicy

**Excluded:**
- Mount source paths (exposes host filesystem structure)
- Environment variables
- Command/entrypoint details
- Host config details

**Rationale:**
- Safe-by-design approach
- Never expose potential secrets or host paths
- Frontend receives only what it needs to display

## Phase 5 Decisions

### ADR-015: Celery + Redis for Background Tasks

**Decision:** Use Celery with Redis as broker/backend for long-running operations.

**Configuration:**
- `CELERY_BROKER_URL`: Default `redis://redis:6379/0`
- `CELERY_RESULT_BACKEND`: Default `redis://redis:6379/1`
- Worker runs as separate container in docker-compose

**Rationale:**
- Image pull can take minutes - must not block HTTP request
- Standard Django + Celery pattern
- Redis is lightweight and sufficient for our needs
- Task results stored for potential status checks

### ADR-016: Image Operations as Background Tasks

**Decision:** Image pull and remove operations run as Celery tasks, not in request handlers.

**Flow:**
1. API endpoint validates input and enqueues task
2. Returns immediately with `{"status": "queued", "task_id": "..."}`
3. Worker executes operation
4. AuditEvent created on completion (success or failure)

**Rationale:**
- Image pulls can take minutes
- API remains responsive
- Audit events capture actual outcome, not just intent
- Task ID allows future status polling (not implemented yet)

### ADR-017: Image Name Validation

**Decision:** Validate image names with strict allow-pattern before queueing.

**Pattern:** `^[a-zA-Z0-9._/:@-]+$`
**Max Length:** 200 characters

**Rationale:**
- Prevent command injection via malformed image names
- Block special characters that could be misused
- Validation happens before task is queued (fail fast)

### ADR-018: Image/Volume/Network Permissions

**Decision:** Read operations are viewer+, image pull is operator+, image remove is admin only.

**Permission Matrix:**
| Action | Viewer | Operator | Admin |
|--------|--------|----------|-------|
| List images | ✓ | ✓ | ✓ |
| Pull image | ✗ | ✓ | ✓ |
| Remove image | ✗ | ✗ | ✓ |
| List volumes | ✓ | ✓ | ✓ |
| List networks | ✓ | ✓ | ✓ |

**Rationale:**
- Image removal is destructive - admin only
- Image pull can consume resources - operator+ required
- Read operations safe for all authenticated users

### ADR-019: Task Audit Correlation

**Decision:** Use Celery task ID as request_id in audit events for background tasks.

**Rationale:**
- Tasks don't have HTTP request context
- Task ID provides unique correlation for tracing
- Stored in `request_id` field with `user_agent: "celery-worker"`

### ADR-020: Volume/Network Sanitization

**Decision:** Only return safe fields from volumes and networks.

**Volume Fields:**
- name, driver, scope, created, labels (filtered)
- **Excluded:** mountpoint (host path)

**Network Fields:**
- id, name, driver, scope, internal, subnets, labels (filtered)
- **Excluded:** gateway IPs, container attachments

**Rationale:**
- Never expose host filesystem paths
- Safe-by-design approach consistent with container responses

## Phase 6 Decisions

### ADR-021: Argon2 Password Hashing

**Decision:** Use Argon2 as the primary password hasher, with PBKDF2 as fallback.

**Configuration:**
```python
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]
```

**Rationale:**
- Argon2 is more resistant to GPU/ASIC attacks than PBKDF2
- Winner of the Password Hashing Competition (2015)
- PBKDF2 fallback allows gradual migration of existing hashes
- Hashes upgrade automatically on next login

### ADR-022: Login Attempt Throttling (django-axes)

**Decision:** Use `django-axes` for login attempt tracking and lockout.

**Defaults:**
- `AXES_FAILURE_LIMIT`: 5 failed attempts
- `AXES_COOLOFF_TIME`: 15 minutes lockout
- `AXES_LOCKOUT_PARAMETERS`: username + IP address

**Rationale:**
- Protects against brute-force attacks
- Per-user and per-IP tracking prevents both targeted and distributed attacks
- Cooloff period allows legitimate users to retry after timeout
- Admin can reset lockouts via management command

### ADR-023: DRF Throttling

**Decision:** Enable global throttling with scoped overrides for sensitive endpoints.

**Default Rates:**
| Scope | Rate | Endpoints |
|-------|------|-----------|
| `anon` | 30/min | All (unauthenticated) |
| `user` | 120/min | All (authenticated) |
| `login` | 10/min | `/api/v1/auth/login/` |
| `docker_mutation` | 30/min | Container start/stop/restart, image pull/remove |

**Rationale:**
- Anonymous rate is lower to discourage abuse
- Login has strict limit to complement axes protection
- Docker mutations are resource-intensive, need separate throttle
- All rates configurable via environment variables

### ADR-024: Production Security Headers

**Decision:** Enforce security headers in production settings.

**Headers:**
| Setting | Default | Notes |
|---------|---------|-------|
| `SECURE_SSL_REDIRECT` | True | Redirect HTTP to HTTPS |
| `SECURE_HSTS_SECONDS` | 60 | Start low, raise to 31536000 after testing |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` | True | Include all subdomains |
| `SECURE_HSTS_PRELOAD` | False | Enable after HSTS is stable |
| `SECURE_CONTENT_TYPE_NOSNIFF` | True | Prevent MIME sniffing |
| `SECURE_REFERRER_POLICY` | same-origin | Don't leak URLs to other origins |
| `X_FRAME_OPTIONS` | DENY | Prevent clickjacking |
| `SESSION_COOKIE_SECURE` | True | Cookies over HTTPS only |
| `CSRF_COOKIE_SECURE` | True | Cookies over HTTPS only |

**Rationale:**
- Defense in depth against common web attacks
- HSTS starts at 60s to allow recovery from misconfigurations
- All settings assume TLS termination at reverse proxy

### ADR-025: Production Safety Checks

**Decision:** Fail fast on startup if critical settings are missing/unsafe in production.

**Checks:**
1. `SECRET_KEY` must be set and not the default placeholder
2. `DEBUG` must be `False` in production settings
3. `ALLOWED_HOSTS` must be explicitly configured

**Rationale:**
- Prevents accidental deployment with insecure defaults
- Clear error messages guide operators to fix issues
- Fail-fast is better than running insecurely

### ADR-026: Structured Logging

**Decision:** Use `python-json-logger` for JSON-formatted logs with request correlation.

**Log Format:**
```json
{
  "timestamp": "2024-01-15T10:00:00.000Z",
  "level": "INFO",
  "name": "apps.docker_manager.views",
  "message": "Container started",
  "request_id": "abc123-def456"
}
```

**Filters:**
- `RequestIDFilter`: Adds request_id from middleware
- `SanitizeFilter`: Removes passwords, tokens, secrets from logs

**Rationale:**
- JSON format works well with log aggregators (ELK, Loki, etc.)
- Request ID enables distributed tracing
- Sanitization prevents accidental secret leakage in logs

### ADR-027: Consistent Error Response Format

**Decision:** Global DRF exception handler ensures all errors follow same format.

**Format:**
```json
{
  "error": {
    "code": "error_code",
    "message": "Human-readable message",
    "details": {}
  }
}
```

**Special Cases:**
- Throttled (429): includes `retry_after` in details
- Validation errors: includes field-level details
- Axes lockout (403): specific `account_locked` code

**Rationale:**
- Consistent format simplifies frontend error handling
- Error codes enable programmatic handling
- Details provide context without leaking internals

## Phase 7 Decisions

### ADR-028: Test Coverage Strategy

**Decision:** Target ~70%+ test coverage for application code with comprehensive mocking.

**Strategy:**
- All tests run without real Docker/Redis dependencies
- Mock DockerService for all Docker endpoint tests
- Use Celery eager mode (`CELERY_TASK_ALWAYS_EAGER=True`) for task tests
- SQLite in-memory database for fast test execution

**Test Categories:**
| Category | Focus |
|----------|-------|
| Auth | Login success/failure, refresh rotation, logout blacklist, roles |
| Permissions | Viewer/operator/admin enforcement across all endpoints |
| Docker | 503 mapping, container CRUD, logs truncation, lifecycle idempotency |
| Celery | Task enqueue behavior, audit event creation |
| Audit | Event immutability, request_id propagation |

**Rationale:**
- CI-friendly: tests run anywhere without external services
- Fast: SQLite in-memory + mocks = sub-second tests
- Comprehensive: covers security boundaries and error cases

### ADR-029: CI Pipeline Definition

**Decision:** Define a standard CI pipeline that runs lint, test, and schema validation.

**Commands:**
```bash
make ci  # Runs: lint + test + schema-validate
```

**Individual Commands:**
1. `ruff check .` - Linting
2. `pytest` - Tests
3. `python manage.py spectacular --validate --fail-on-warn` - OpenAPI validation

**Rationale:**
- Single command for CI systems
- Schema validation catches API documentation drift
- Fails fast on any error

### ADR-030: Bootstrap Command Enhancement

**Decision:** Extend `devhub_bootstrap_roles` to support password updates for existing users.

**Behavior:**
| Flag | Existing User | New User |
|------|---------------|----------|
| `--create-admin` | Ensure in admin group | Create + add to group |
| `--create-admin --update-password` | Update password + ensure group | Create + add to group |

**Rationale:**
- Idempotent: safe to run multiple times
- Supports password rotation without manual intervention
- Explicit flag prevents accidental password changes

### ADR-031: Dependency Health Check Command

**Decision:** Add `devhub_check` management command for operational health checks.

**Checks:**
1. **Database** - Execute simple query, report engine type
2. **Redis** - Ping broker URL, report connection status
3. **Docker** - Get version via DockerService, report version info

**Exit Codes:**
- `0` - All required dependencies OK
- `1` - Critical dependency failed (DB or Docker)

**Security:**
- MUST NOT leak connection strings, passwords, or paths
- Only reports: connection status, engine type, version numbers

**Rationale:**
- Useful for deployment scripts and health probes
- Safe-by-design: no secrets in output
- Verbose mode available for debugging

### ADR-032: OpenAPI Schema Polish

**Decision:** Enhance OpenAPI schema with security schemes, tags, and examples.

**Security Scheme:**
```yaml
securitySchemes:
  bearerAuth:
    type: http
    scheme: bearer
    bearerFormat: JWT
```

**Tags:**
| Tag | Endpoints |
|-----|-----------|
| auth | login, logout, refresh, me |
| system | health, version |
| docker-system | info, version |
| docker-containers | list, detail, logs, start, stop, restart |
| docker-images | list, pull, remove |
| docker-volumes | list |
| docker-networks | list |

**Rationale:**
- Security scheme enables "Authorize" button in Swagger UI
- Tags organize endpoints logically
- Schema validation in CI prevents documentation drift

## Future Decisions (To Be Made)

- [ ] Container create payload validation (Phase 8+)
- [ ] Container remove operations (Phase 8+)
- [ ] Volume/network create/remove operations (Phase 8+)
- [ ] Task status polling endpoint (Phase 8+)
- [ ] Audit log read endpoints (Phase 8+)
