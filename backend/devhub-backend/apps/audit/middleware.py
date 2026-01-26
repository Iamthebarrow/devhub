"""
Request correlation middleware for audit logging.

Generates a unique request_id per request and makes it available throughout
the request lifecycle for correlation in audit logs and debugging.
"""

import uuid
from typing import Callable

from django.http import HttpRequest, HttpResponse


# Thread-local storage for request context
import threading

_request_context = threading.local()


def get_request_id() -> str:
    """
    Get the current request ID from thread-local storage.

    Returns:
        The current request ID, or empty string if not in a request context.
    """
    return getattr(_request_context, "request_id", "")


def get_client_ip(request: HttpRequest) -> str:
    """
    Extract client IP address from request.

    Handles X-Forwarded-For header for proxied requests.

    Args:
        request: The Django HTTP request.

    Returns:
        The client IP address.
    """
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        # Take the first IP in the chain (original client)
        ip = x_forwarded_for.split(",")[0].strip()
    else:
        ip = request.META.get("REMOTE_ADDR", "")
    return ip


def get_user_agent(request: HttpRequest) -> str:
    """
    Extract User-Agent header from request.

    Args:
        request: The Django HTTP request.

    Returns:
        The User-Agent string, or empty string if not present.
    """
    return request.META.get("HTTP_USER_AGENT", "")


class RequestIDMiddleware:
    """
    Middleware that generates a unique request_id for each request.

    - Generates a UUID for each incoming request
    - Stores it in thread-local storage for access during request processing
    - Adds X-Request-ID header to the response
    - Makes request context available for audit logging
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        # Generate unique request ID
        request_id = str(uuid.uuid4())

        # Store in thread-local storage
        _request_context.request_id = request_id
        _request_context.client_ip = get_client_ip(request)
        _request_context.user_agent = get_user_agent(request)

        # Also attach to request object for convenience
        request.request_id = request_id

        try:
            response = self.get_response(request)

            # Add request ID to response header
            response["X-Request-ID"] = request_id

            return response
        finally:
            # Clean up thread-local storage
            _request_context.request_id = ""
            _request_context.client_ip = ""
            _request_context.user_agent = ""


def get_request_context() -> dict:
    """
    Get the current request context from thread-local storage.

    Returns:
        Dict with request_id, client_ip, and user_agent.
    """
    return {
        "request_id": getattr(_request_context, "request_id", ""),
        "client_ip": getattr(_request_context, "client_ip", ""),
        "user_agent": getattr(_request_context, "user_agent", ""),
    }
