"""
AuditService - Helper for creating audit log entries.

Provides a clean interface for recording audit events with proper
sanitization and truncation of metadata.
"""

import json
import logging
from typing import Any

from django.conf import settings
from django.contrib.auth.models import AbstractUser

from .middleware import get_request_context
from .models import AuditEvent, AuditStatus

logger = logging.getLogger(__name__)

# DEFAULT: Maximum size for metadata string fields (32KB)
METADATA_MAX_SIZE = getattr(settings, "AUDIT_METADATA_MAX_SIZE", 32 * 1024)

# DEFAULT: Maximum size for error messages (4KB)
ERROR_MESSAGE_MAX_SIZE = getattr(settings, "AUDIT_ERROR_MESSAGE_MAX_SIZE", 4 * 1024)

# Prefixes of labels/keys that may contain secrets
SECRET_KEY_PREFIXES = (
    "password",
    "secret",
    "token",
    "key",
    "credential",
    "auth",
    "api_key",
    "apikey",
)


def _truncate_string(value: str, max_size: int) -> str:
    """Truncate a string to max_size with indicator if truncated."""
    if len(value) <= max_size:
        return value
    return value[: max_size - 20] + "... [TRUNCATED]"


def _sanitize_value(key: str, value: Any) -> Any:
    """
    Sanitize a single value, redacting potential secrets.

    Args:
        key: The key name (used to detect secret fields).
        value: The value to sanitize.

    Returns:
        Sanitized value.
    """
    # Check if key suggests a secret
    key_lower = key.lower()
    if any(prefix in key_lower for prefix in SECRET_KEY_PREFIXES):
        return "[REDACTED]"

    # Recursively sanitize dicts
    if isinstance(value, dict):
        return _sanitize_dict(value)

    # Recursively sanitize lists
    if isinstance(value, list):
        return [_sanitize_value(f"item_{i}", v) for i, v in enumerate(value)]

    # Truncate long strings
    if isinstance(value, str):
        return _truncate_string(value, METADATA_MAX_SIZE)

    return value


def _sanitize_dict(data: dict) -> dict:
    """
    Recursively sanitize a dictionary, removing potential secrets.

    Args:
        data: Dictionary to sanitize.

    Returns:
        Sanitized dictionary.
    """
    if not isinstance(data, dict):
        return data

    result = {}
    for key, value in data.items():
        result[key] = _sanitize_value(key, value)

    return result


def _ensure_json_serializable(data: Any) -> Any:
    """Ensure data is JSON serializable."""
    try:
        json.dumps(data)
        return data
    except (TypeError, ValueError):
        return str(data)


class AuditService:
    """
    Service for creating audit log entries.

    Usage:
        audit = AuditService(request)
        audit.log_action(
            action="container.start",
            resource_type="container",
            resource_id="abc123",
            resource_name="my-container",
            status=AuditStatus.SUCCESS,
            metadata={"some": "data"}
        )
    """

    def __init__(self, request=None, user: AbstractUser | None = None):
        """
        Initialize AuditService.

        Args:
            request: The Django/DRF request object (optional).
            user: The user performing the action (if not from request).
        """
        self._request = request
        self._user = user

    def _get_actor(self) -> AbstractUser | None:
        """Get the actor (user) for the audit event."""
        if self._user:
            return self._user
        if self._request and hasattr(self._request, "user"):
            user = self._request.user
            if user and user.is_authenticated:
                return user
        return None

    def _get_context(self) -> dict:
        """Get request context (request_id, IP, user-agent)."""
        # Try to get from middleware thread-local storage
        context = get_request_context()

        # If we have a request, we can also extract from it
        if self._request:
            if hasattr(self._request, "request_id") and not context.get("request_id"):
                context["request_id"] = self._request.request_id

        # Ensure we have at least empty strings
        return {
            "request_id": context.get("request_id", ""),
            "client_ip": context.get("client_ip", ""),
            "user_agent": context.get("user_agent", ""),
        }

    def log_action(
        self,
        action: str,
        resource_type: str,
        resource_id: str,
        resource_name: str = "",
        status: str = AuditStatus.SUCCESS,
        error_message: str | None = None,
        metadata: dict | None = None,
    ) -> AuditEvent:
        """
        Create an audit log entry.

        Args:
            action: The action performed (e.g., "container.start").
            resource_type: Type of resource (e.g., "container").
            resource_id: Docker resource ID.
            resource_name: Human-readable name (optional).
            status: Success or error status.
            error_message: Error message if status is error (will be sanitized).
            metadata: Additional metadata (will be sanitized).

        Returns:
            The created AuditEvent instance.
        """
        context = self._get_context()
        actor = self._get_actor()

        # Sanitize metadata
        safe_metadata = {}
        if metadata:
            safe_metadata = _sanitize_dict(metadata)
            safe_metadata = _ensure_json_serializable(safe_metadata)

        # Sanitize error message
        safe_error = None
        if error_message:
            safe_error = _truncate_string(error_message, ERROR_MESSAGE_MAX_SIZE)
            # Remove any potential secrets from error messages
            for prefix in SECRET_KEY_PREFIXES:
                if prefix in safe_error.lower():
                    # If error message contains secret-related terms,
                    # be more aggressive about sanitization
                    safe_error = f"Error during {action} (details redacted for security)"
                    break

        try:
            event = AuditEvent.objects.create(
                actor=actor,
                ip_address=context["client_ip"],
                user_agent=_truncate_string(context["user_agent"], 500),
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                resource_name=resource_name[:255] if resource_name else "",
                request_id=context["request_id"],
                status=status,
                error_message=safe_error,
                metadata=safe_metadata,
            )
            return event
        except Exception as e:
            # Log the error but don't fail the request
            logger.error(f"Failed to create audit event: {e}")
            # Create a minimal event without the problematic fields
            try:
                event = AuditEvent.objects.create(
                    actor=actor,
                    action=action,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    request_id=context["request_id"],
                    status=status,
                    error_message="Audit metadata sanitization error",
                    metadata={},
                )
                return event
            except Exception as e2:
                logger.error(f"Failed to create fallback audit event: {e2}")
                raise

    def log_success(
        self,
        action: str,
        resource_type: str,
        resource_id: str,
        resource_name: str = "",
        metadata: dict | None = None,
    ) -> AuditEvent:
        """Convenience method for logging successful actions."""
        return self.log_action(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            status=AuditStatus.SUCCESS,
            metadata=metadata,
        )

    def log_error(
        self,
        action: str,
        resource_type: str,
        resource_id: str,
        error_message: str,
        resource_name: str = "",
        metadata: dict | None = None,
    ) -> AuditEvent:
        """Convenience method for logging failed actions."""
        return self.log_action(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            status=AuditStatus.ERROR,
            error_message=error_message,
            metadata=metadata,
        )
