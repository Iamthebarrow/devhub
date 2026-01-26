"""
Custom exception handler for Django REST Framework.

Ensures consistent error response format across the API.
"""

import logging

from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    NotAuthenticated,
    Throttled,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler that formats all errors consistently.

    Error format:
    {
        "error": {
            "code": "error_code",
            "message": "Human-readable message",
            "details": {}  # Optional additional details
        }
    }

    This handler:
    - Maintains the existing error format from earlier phases
    - Adds proper handling for throttling (429)
    - Adds handling for django-axes lockout (403)
    - Logs errors appropriately
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    # If response is None, it's an unhandled exception
    if response is None:
        # Handle Django's built-in exceptions
        if isinstance(exc, Http404):
            response = Response(
                _error_response("not_found", "Resource not found"),
                status=status.HTTP_404_NOT_FOUND,
            )
        elif isinstance(exc, PermissionDenied):
            response = Response(
                _error_response("permission_denied", "Permission denied"),
                status=status.HTTP_403_FORBIDDEN,
            )
        else:
            # Unexpected error - log it and return generic message
            logger.exception("Unhandled exception: %s", exc)
            response = Response(
                _error_response("internal_error", "An unexpected error occurred"),
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return response

    # Handle specific DRF exceptions with consistent format
    if isinstance(exc, Throttled):
        # Throttle error - return 429 with wait time
        wait_time = exc.wait
        message = "Request was throttled"
        if wait_time:
            message = f"Request was throttled. Expected available in {int(wait_time)} seconds"
        response.data = _error_response(
            "throttled",
            message,
            {"retry_after": wait_time} if wait_time else None,
        )
        return response

    if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
        # Don't override auth errors - they may already have custom format
        # Check if already in our format
        if "error" not in response.data:
            response.data = _error_response("auth_failed", str(exc.detail))
        return response

    # Check if this is an axes lockout (403 from axes)
    # Axes returns a PermissionDenied via its middleware
    request = context.get("request")
    if request and response.status_code == 403:
        from axes.helpers import get_client_username

        # Check if this looks like an axes lockout
        if hasattr(request, "_axes_failed"):
            username = get_client_username(request, None) or "user"
            response.data = _error_response(
                "account_locked",
                f"Account locked due to too many failed login attempts. "
                f"Please try again later.",
            )
            return response

    # For other DRF exceptions, convert to consistent format if needed
    if response is not None and "error" not in response.data:
        # Handle validation errors
        if hasattr(exc, "detail"):
            detail = exc.detail
            if isinstance(detail, dict):
                # Validation errors - extract first error
                first_field = next(iter(detail), None)
                if first_field:
                    first_error = detail[first_field]
                    if isinstance(first_error, list):
                        first_error = first_error[0] if first_error else "Validation error"
                    message = f"{first_field}: {first_error}"
                else:
                    message = "Validation error"
                response.data = _error_response("validation_error", message, detail)
            elif isinstance(detail, list):
                message = detail[0] if detail else "Validation error"
                response.data = _error_response("validation_error", str(message))
            else:
                response.data = _error_response(_get_error_code(exc), str(detail))

    return response


def _error_response(code: str, message: str, details: dict | None = None) -> dict:
    """Create a consistent error response format."""
    error = {"code": code, "message": message}
    if details:
        error["details"] = details
    return {"error": error}


def _get_error_code(exc: APIException) -> str:
    """Get error code from exception."""
    if hasattr(exc, "default_code"):
        return exc.default_code
    return "error"
