"""
Production settings for DevHub backend.

These settings are safe-by-default for production deployment.
Requires proper environment variables to be set.
"""

import sys

from .base import *  # noqa: F401, F403
from .base import SECRET_KEY, env

# =============================================================================
# Production Safety Checks (Phase 6)
# =============================================================================

# Fail fast if SECRET_KEY is not set or is the default development key
if not SECRET_KEY or SECRET_KEY == "your-secret-key-change-in-production":
    print(
        "ERROR: DJANGO_SECRET_KEY must be set to a secure value in production.",
        file=sys.stderr,
    )
    sys.exit(1)

# Fail fast if DEBUG is enabled in production
_debug_value = env.bool("DJANGO_DEBUG", default=False)
if _debug_value:
    print(
        "ERROR: DJANGO_DEBUG must be False in production settings.",
        file=sys.stderr,
    )
    sys.exit(1)

DEBUG = False

# =============================================================================
# Host Configuration
# =============================================================================

# Hosts must be explicitly set in production
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")
if not ALLOWED_HOSTS:
    print(
        "ERROR: DJANGO_ALLOWED_HOSTS must be set in production.",
        file=sys.stderr,
    )
    sys.exit(1)

# =============================================================================
# CORS and CSRF Configuration
# =============================================================================

# CORS - must be explicitly configured
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS")
if not CORS_ALLOWED_ORIGINS:
    print(
        "WARNING: CORS_ALLOWED_ORIGINS is empty. No cross-origin requests will be allowed.",
        file=sys.stderr,
    )
CORS_ALLOW_CREDENTIALS = True

# CSRF trusted origins
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS")
if not CSRF_TRUSTED_ORIGINS:
    print(
        "WARNING: CSRF_TRUSTED_ORIGINS is empty.",
        file=sys.stderr,
    )

# =============================================================================
# Security Headers (Phase 6)
# =============================================================================

# These expect the app to be behind a TLS-terminating reverse proxy

# HTTPS/SSL settings
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)

# Cookie security
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"

CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"

# HSTS settings
# DEFAULT: 60 seconds initially for testing; raise to 31536000 (1 year) after verification
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=60)
# DEFAULT: Include subdomains in HSTS
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", default=True)
# DEFAULT: Do not preload initially; enable after testing
SECURE_HSTS_PRELOAD = env.bool("SECURE_HSTS_PRELOAD", default=False)

# Content security
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# Referrer policy
SECURE_REFERRER_POLICY = "same-origin"

# =============================================================================
# REST Framework (Production)
# =============================================================================

# Production REST Framework settings (no browsable API)
# Inherit throttle settings from base.py
REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    # Throttling (inherited rates from base.py)
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

# =============================================================================
# JWT Cookie Settings
# =============================================================================

# Production: refresh token cookie must be Secure (HTTPS only)
REFRESH_TOKEN_COOKIE_SECURE = True
REFRESH_TOKEN_COOKIE_HTTPONLY = True
REFRESH_TOKEN_COOKIE_SAMESITE = "Lax"
