"""
Local development settings for DevHub backend.

These settings are intended for local development only.
"""

from .base import *  # noqa: F401, F403
from .base import env

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env.bool("DJANGO_DEBUG", default=True)

# Allow localhost for development
ALLOWED_HOSTS = env.list(
    "DJANGO_ALLOWED_HOSTS",
    default=["localhost", "127.0.0.1", "0.0.0.0"],  # noqa: S104
)

# CORS settings for local development
# DEFAULT: Allow Vite dev server
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:3100", "http://127.0.0.1:3100"],
)
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = env.list(
    "CSRF_TRUSTED_ORIGINS",
    default=["http://localhost:3100", "http://127.0.0.1:3100"],
)

# Add browsable API renderer and JWT auth for development
# Include throttle settings but with more relaxed rates for development
REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    # Throttling enabled in development (with same defaults)
    # Set higher rates via env vars if needed for testing
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": env("THROTTLE_RATE_ANON", default="30/min"),
        "user": env("THROTTLE_RATE_USER", default="120/min"),
        "login": env("THROTTLE_RATE_LOGIN", default="10/min"),
        "docker_mutation": env("THROTTLE_RATE_DOCKER_MUTATION", default="30/min"),
    },
    "EXCEPTION_HANDLER": "apps.core.exceptions.custom_exception_handler",
}

# Local development: cookies don't need Secure flag (no HTTPS)
REFRESH_TOKEN_COOKIE_SECURE = False

# =============================================================================
# Django-Axes Settings Override (Development)
# =============================================================================

# Use database backend for axes in development (no Redis needed for cache)
# This is easier for local testing
AXES_HANDLER = "axes.handlers.database.AxesDatabaseHandler"

# =============================================================================
# Cache Settings Override (Development)
# =============================================================================

# Use local memory cache for development if Redis is not available
CACHES = {
    "default": {
        "BACKEND": env(
            "CACHE_BACKEND",
            default="django.core.cache.backends.locmem.LocMemCache",
        ),
        "LOCATION": env("CACHE_LOCATION", default="devhub-local-cache"),
    },
}
