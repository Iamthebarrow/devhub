"""
Base Django settings for DevHub backend.

All environment-specific settings should be in local.py or prod.py.
Uses django-environ for 12-factor configuration.
"""

import re
import sys
from datetime import timedelta
from pathlib import Path

import environ

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Initialize environ
env = environ.Env(
    # Set defaults
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, []),
    JWT_ACCESS_LIFETIME_MINUTES=(int, 10),
    JWT_REFRESH_LIFETIME_DAYS=(int, 14),
)

# Read .env file if it exists
environ.Env.read_env(BASE_DIR / ".env")

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env("DJANGO_SECRET_KEY")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env("DJANGO_DEBUG")

ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party apps
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    "axes",  # Login attempt throttling (Phase 6)
    # Local apps
    "apps.accounts",
    "apps.core",
    "apps.docker_manager",
    "apps.audit",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "apps.audit.middleware.RequestIDMiddleware",  # Request correlation
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "axes.middleware.AxesMiddleware",  # Login attempt tracking (Phase 6)
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Authentication backends (axes must be first for lockout to work)
AUTHENTICATION_BACKENDS = [
    "axes.backends.AxesStandaloneBackend",
    "django.contrib.auth.backends.ModelBackend",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Database
# https://docs.djangoproject.com/en/5.0/ref/settings/#databases
DATABASES = {
    "default": env.db("DATABASE_URL"),
}

# =============================================================================
# Password Security (Phase 6)
# =============================================================================

# Use Argon2 as primary password hasher (more secure than PBKDF2)
# Keep PBKDF2 as fallback for existing hashes
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
]

# Password validation
# https://docs.djangoproject.com/en/5.0/ref/settings/#auth-password-validators
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Internationalization
# https://docs.djangoproject.com/en/5.0/topics/i18n/
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.0/howto/static-files/
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Default primary key field type
# https://docs.djangoproject.com/en/5.0/ref/settings/#default-auto-field
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    # =============================================================================
    # Throttling (Phase 6)
    # =============================================================================
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        # DEFAULT: Anonymous users (not authenticated)
        "anon": env("THROTTLE_RATE_ANON", default="30/min"),
        # DEFAULT: Authenticated users
        "user": env("THROTTLE_RATE_USER", default="120/min"),
        # DEFAULT: Login endpoint (scoped)
        "login": env("THROTTLE_RATE_LOGIN", default="10/min"),
        # DEFAULT: Docker mutation endpoints (scoped)
        "docker_mutation": env("THROTTLE_RATE_DOCKER_MUTATION", default="30/min"),
    },
    # Global exception handler for consistent error format
    "EXCEPTION_HANDLER": "apps.core.exceptions.custom_exception_handler",
}

# drf-spectacular settings
SPECTACULAR_SETTINGS = {
    "TITLE": "DevHub API",
    "DESCRIPTION": """DevHub - Server management suite API.

## Authentication
All endpoints except `/api/v1/health/` and `/api/v1/version/` require authentication.
Use JWT Bearer tokens in the `Authorization` header.

### Getting a Token
1. POST to `/api/v1/auth/login/` with `{"username": "...", "password": "..."}`
2. Use the returned `access` token in the `Authorization: Bearer <token>` header
3. Refresh tokens are stored in HttpOnly cookies and rotated automatically

## Rate Limiting
- Anonymous: 30 requests/minute
- Authenticated: 120 requests/minute
- Login: 10 requests/minute
- Docker mutations: 30 requests/minute

## Roles
- **viewer**: Read-only access to Docker resources
- **operator**: Can start/stop/restart containers, pull images
- **admin**: Full access including destructive operations
""",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SWAGGER_UI_SETTINGS": {
        "persistAuthorization": True,
        "displayRequestDuration": True,
    },
    # Security scheme for JWT Bearer authentication
    "SECURITY": [{"bearerAuth": []}],
    "APPEND_COMPONENTS": {
        "securitySchemes": {
            "bearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
                "description": "JWT access token from /api/v1/auth/login/",
            }
        }
    },
    # Tag configuration for endpoint grouping
    "TAGS": [
        {"name": "auth", "description": "Authentication (login, logout, refresh, me)"},
        {"name": "system", "description": "System health and version"},
        {"name": "docker-system", "description": "Docker system info and version"},
        {"name": "docker-containers", "description": "Container management"},
        {"name": "docker-images", "description": "Image management"},
        {"name": "docker-volumes", "description": "Volume listing"},
        {"name": "docker-networks", "description": "Network listing"},
    ],
    # Schema generation settings
    "COMPONENT_SPLIT_REQUEST": True,
}

# CORS settings (base, override in local/prod)
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])

# SimpleJWT settings
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=env("JWT_ACCESS_LIFETIME_MINUTES")
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=env("JWT_REFRESH_LIFETIME_DAYS")
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# Refresh token cookie settings
REFRESH_TOKEN_COOKIE_NAME = "refresh_token"
REFRESH_TOKEN_COOKIE_PATH = "/"
REFRESH_TOKEN_COOKIE_SAMESITE = "Lax"
# Secure cookie setting is environment-specific (see local.py/prod.py)
REFRESH_TOKEN_COOKIE_SECURE = False  # Override in prod.py

# Dev admin bootstrap (optional)
DEV_ADMIN_USERNAME = env("DEV_ADMIN_USERNAME", default="")
DEV_ADMIN_PASSWORD = env("DEV_ADMIN_PASSWORD", default="")
DEV_ADMIN_EMAIL = env("DEV_ADMIN_EMAIL", default="")

# Docker access settings
# DOCKER_HOST can be:
#   - unix:///var/run/docker.sock (direct socket access)
#   - tcp://docker-socket-proxy:2375 (via socket proxy - recommended for production)
DOCKER_HOST = env("DOCKER_HOST", default="unix:///var/run/docker.sock")
DOCKER_TLS_VERIFY = env.bool("DOCKER_TLS_VERIFY", default=False)
DOCKER_CERT_PATH = env("DOCKER_CERT_PATH", default="")

# Container logs settings (Phase 4)
# DEFAULT: Maximum tail lines for logs endpoint
CONTAINER_LOGS_MAX_TAIL = env.int("CONTAINER_LOGS_MAX_TAIL", default=2000)
# DEFAULT: Maximum log response size in bytes (64KB)
CONTAINER_LOGS_MAX_SIZE = env.int("CONTAINER_LOGS_MAX_SIZE", default=64 * 1024)

# Audit settings (Phase 4)
# DEFAULT: Maximum size for audit metadata strings (32KB)
AUDIT_METADATA_MAX_SIZE = env.int("AUDIT_METADATA_MAX_SIZE", default=32 * 1024)
# DEFAULT: Maximum size for audit error messages (4KB)
AUDIT_ERROR_MESSAGE_MAX_SIZE = env.int("AUDIT_ERROR_MESSAGE_MAX_SIZE", default=4 * 1024)

# =============================================================================
# Celery Settings (Phase 5)
# =============================================================================

# DEFAULT: Redis broker URL
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://redis:6379/0")
# DEFAULT: Redis result backend URL
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="redis://redis:6379/1")

# Celery configuration
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes max per task

# For testing: enable eager mode when CELERY_TASK_ALWAYS_EAGER=True
CELERY_TASK_ALWAYS_EAGER = env.bool("CELERY_TASK_ALWAYS_EAGER", default=False)
CELERY_TASK_EAGER_PROPAGATES = True

# =============================================================================
# Image Validation Settings (Phase 5)
# =============================================================================

# DEFAULT: Regex pattern for validating image names
# Only allows alphanumeric, dots, underscores, hyphens, slashes, and colons
IMAGE_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9._/:@-]+$")
# DEFAULT: Maximum length for image name
IMAGE_NAME_MAX_LENGTH = 200

# =============================================================================
# Django-Axes Settings (Phase 6 - Login Throttling)
# =============================================================================

# DEFAULT: Number of failed attempts before lockout
AXES_FAILURE_LIMIT = env.int("AXES_FAILURE_LIMIT", default=5)
# DEFAULT: Lockout duration in minutes
AXES_COOLOFF_TIME = timedelta(minutes=env.int("AXES_COOLOFF_MINUTES", default=15))
# Lock based on username and IP combination
AXES_LOCKOUT_PARAMETERS = ["username", "ip_address"]
# Use cache backend for axes (Redis via Django cache)
AXES_HANDLER = "axes.handlers.cache.AxesCacheHandler"
# Only track login attempts (not admin or other URLs)
AXES_ONLY_USER_FAILURES = True
# Log verbose info about lockouts
AXES_VERBOSE = True
# Reset on successful login
AXES_RESET_ON_SUCCESS = True
# Return 403 on lockout instead of 429 (DRF throttles use 429, axes uses 403)
AXES_HTTP_RESPONSE_CODE = 403

# =============================================================================
# Structured Logging (Phase 6)
# =============================================================================

# List of sensitive fields to redact from logs
LOG_SENSITIVE_FIELDS = [
    "password",
    "token",
    "refresh",
    "access",
    "authorization",
    "cookie",
    "secret",
    "api_key",
    "apikey",
]

# Structured logging configuration using python-json-logger
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
            "rename_fields": {
                "asctime": "timestamp",
                "levelname": "level",
            },
        },
        "verbose": {
            "format": "{asctime} {levelname} {name} [{request_id}] {message}",
            "style": "{",
            "defaults": {"request_id": "-"},
        },
    },
    "filters": {
        "request_id": {
            "()": "apps.audit.logging.RequestIDFilter",
        },
        "sanitize": {
            "()": "apps.audit.logging.SanitizeFilter",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
            "filters": ["request_id", "sanitize"],
            "stream": sys.stdout,
        },
    },
    "root": {
        "handlers": ["console"],
        "level": env("LOG_LEVEL", default="INFO"),
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": env("DJANGO_LOG_LEVEL", default="INFO"),
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "apps": {
            "handlers": ["console"],
            "level": env("APP_LOG_LEVEL", default="INFO"),
            "propagate": False,
        },
        "celery": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "axes": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}

# =============================================================================
# Django Cache (for axes)
# =============================================================================

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": env("CACHE_REDIS_URL", default="redis://redis:6379/2"),
    },
}
