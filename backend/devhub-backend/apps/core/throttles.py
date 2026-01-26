"""
Custom throttle classes for DRF.

Provides scoped throttles for:
- Login endpoint
- Docker mutation endpoints (start/stop/restart, image pull/remove)
"""

from rest_framework.throttling import ScopedRateThrottle


class LoginThrottle(ScopedRateThrottle):
    """
    Throttle for login endpoint.

    Uses the 'login' scope from DEFAULT_THROTTLE_RATES.
    DEFAULT: 10/min
    """

    scope = "login"


class DockerMutationThrottle(ScopedRateThrottle):
    """
    Throttle for Docker mutation endpoints.

    Applies to:
    - Container start/stop/restart
    - Image pull/remove

    Uses the 'docker_mutation' scope from DEFAULT_THROTTLE_RATES.
    DEFAULT: 30/min
    """

    scope = "docker_mutation"
