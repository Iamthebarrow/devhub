"""
Logging filters for structured logging with request correlation.

Provides:
- RequestIDFilter: Adds request_id to every log record
- SanitizeFilter: Removes sensitive data from log records
"""

import logging
import re
from typing import Any

from django.conf import settings


class RequestIDFilter(logging.Filter):
    """
    Logging filter that adds request_id to every log record.

    Uses the request_id from the audit middleware's thread-local storage.
    Falls back to "-" if no request context is available.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        """Add request_id to the log record."""
        from apps.audit.middleware import get_request_id

        record.request_id = get_request_id() or "-"
        return True


class SanitizeFilter(logging.Filter):
    """
    Logging filter that sanitizes sensitive data from log records.

    Removes or masks:
    - Passwords and secrets
    - Authorization headers and tokens
    - Cookies
    - Docker environment variables
    - Any field matching sensitive patterns
    """

    # Patterns for sensitive keys
    SENSITIVE_PATTERNS = [
        re.compile(r"password", re.IGNORECASE),
        re.compile(r"token", re.IGNORECASE),
        re.compile(r"secret", re.IGNORECASE),
        re.compile(r"api[_-]?key", re.IGNORECASE),
        re.compile(r"auth", re.IGNORECASE),
        re.compile(r"cookie", re.IGNORECASE),
        re.compile(r"credential", re.IGNORECASE),
        re.compile(r"private", re.IGNORECASE),
    ]

    # Mask to use for sensitive values
    MASK = "[REDACTED]"

    def filter(self, record: logging.LogRecord) -> bool:
        """Sanitize sensitive data from the log record."""
        # Sanitize the message if it's a string
        if isinstance(record.msg, str):
            record.msg = self._sanitize_string(record.msg)

        # Sanitize args if present
        if record.args:
            record.args = self._sanitize_args(record.args)

        # Sanitize extra fields
        for key in list(vars(record).keys()):
            if self._is_sensitive_key(key):
                setattr(record, key, self.MASK)

        return True

    def _is_sensitive_key(self, key: str) -> bool:
        """Check if a key matches any sensitive pattern."""
        for pattern in self.SENSITIVE_PATTERNS:
            if pattern.search(key):
                return True

        # Also check against configured sensitive fields
        sensitive_fields = getattr(settings, "LOG_SENSITIVE_FIELDS", [])
        return key.lower() in [f.lower() for f in sensitive_fields]

    def _sanitize_string(self, value: str) -> str:
        """Sanitize sensitive patterns in a string."""
        # Mask common patterns like "password=xxx" or "token: xxx"
        patterns = [
            (r'(["\']?(?:password|passwd|pwd)["\']?\s*[:=]\s*)["\']?[^"\'\s,}]+["\']?', r"\1" + self.MASK),
            (r'(["\']?(?:token|access_token|refresh_token)["\']?\s*[:=]\s*)["\']?[^"\'\s,}]+["\']?', r"\1" + self.MASK),
            (r'(["\']?(?:secret|api_key|apikey)["\']?\s*[:=]\s*)["\']?[^"\'\s,}]+["\']?', r"\1" + self.MASK),
            (r'(Authorization:\s*(?:Bearer|Basic)\s+)[^\s]+', r"\1" + self.MASK),
        ]

        result = value
        for pattern, replacement in patterns:
            result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)

        return result

    def _sanitize_args(self, args: tuple | dict) -> tuple | dict:
        """Sanitize arguments passed to log formatting."""
        if isinstance(args, dict):
            return {
                k: self.MASK if self._is_sensitive_key(k) else self._sanitize_value(v)
                for k, v in args.items()
            }
        elif isinstance(args, tuple):
            return tuple(self._sanitize_value(arg) for arg in args)
        return args

    def _sanitize_value(self, value: Any) -> Any:
        """Recursively sanitize a value."""
        if isinstance(value, str):
            return self._sanitize_string(value)
        elif isinstance(value, dict):
            return {
                k: self.MASK if self._is_sensitive_key(k) else self._sanitize_value(v)
                for k, v in value.items()
            }
        elif isinstance(value, (list, tuple)):
            sanitized = [self._sanitize_value(v) for v in value]
            return type(value)(sanitized) if isinstance(value, tuple) else sanitized
        return value


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger with proper configuration.

    This is a convenience wrapper that ensures the logger
    uses the correct Django configuration.

    Args:
        name: Logger name (typically __name__)

    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)
