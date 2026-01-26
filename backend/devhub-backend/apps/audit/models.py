"""
AuditEvent model for immutable audit logging.

All state-changing operations must write an AuditEvent record.
Records are append-only - no updates or deletes via API.
"""

import uuid

from django.conf import settings
from django.db import models


class AuditStatus(models.TextChoices):
    """Status of an audited operation."""

    SUCCESS = "success", "Success"
    ERROR = "error", "Error"


class AuditEvent(models.Model):
    """
    Immutable audit log entry.

    Records all state-changing operations in the system with:
    - Who performed the action (actor)
    - What action was performed
    - What resource was affected
    - Request context (IP, user-agent, request_id)
    - Outcome (success/error)
    - Sanitized metadata (no secrets)
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique identifier for the audit event",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="When the event was recorded",
    )

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_events",
        help_text="User who performed the action (null for system actions)",
    )

    ip_address = models.CharField(
        max_length=45,
        blank=True,
        default="",
        help_text="IP address of the request (supports IPv6)",
    )

    user_agent = models.TextField(
        blank=True,
        default="",
        help_text="User-Agent header from the request",
    )

    action = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Action performed (e.g., container.start, container.stop)",
    )

    resource_type = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Type of resource affected (e.g., container, image)",
    )

    resource_id = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Docker resource ID",
    )

    resource_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Human-readable resource name (best effort)",
    )

    request_id = models.CharField(
        max_length=64,
        db_index=True,
        help_text="Request correlation ID",
    )

    status = models.CharField(
        max_length=10,
        choices=AuditStatus.choices,
        db_index=True,
        help_text="Outcome of the operation",
    )

    error_message = models.TextField(
        null=True,
        blank=True,
        help_text="Error message if status is error (sanitized)",
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata (sanitized, no secrets)",
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Audit Event"
        verbose_name_plural = "Audit Events"
        indexes = [
            models.Index(fields=["actor", "-created_at"]),
            models.Index(fields=["action", "-created_at"]),
            models.Index(fields=["resource_type", "resource_id"]),
        ]

    def __str__(self) -> str:
        actor_name = self.actor.username if self.actor else "system"
        return f"{self.created_at.isoformat()} | {actor_name} | {self.action} | {self.status}"

    def save(self, *args, **kwargs):
        """Override save to prevent updates to existing records via model."""
        # Allow initial creation
        if self._state.adding:
            super().save(*args, **kwargs)
        else:
            # Prevent updates - audit records are immutable
            raise ValueError("AuditEvent records cannot be modified after creation")

    def delete(self, *args, **kwargs):
        """Override delete to prevent deletion via model."""
        raise ValueError("AuditEvent records cannot be deleted")
