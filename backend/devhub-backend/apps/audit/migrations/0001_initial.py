"""
Initial migration for the audit app.

Creates the AuditEvent model for immutable audit logging.
"""

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AuditEvent",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        help_text="Unique identifier for the audit event",
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(
                        auto_now_add=True,
                        db_index=True,
                        help_text="When the event was recorded",
                    ),
                ),
                (
                    "ip_address",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="IP address of the request (supports IPv6)",
                        max_length=45,
                    ),
                ),
                (
                    "user_agent",
                    models.TextField(
                        blank=True,
                        default="",
                        help_text="User-Agent header from the request",
                    ),
                ),
                (
                    "action",
                    models.CharField(
                        db_index=True,
                        help_text="Action performed (e.g., container.start, container.stop)",
                        max_length=100,
                    ),
                ),
                (
                    "resource_type",
                    models.CharField(
                        db_index=True,
                        help_text="Type of resource affected (e.g., container, image)",
                        max_length=50,
                    ),
                ),
                (
                    "resource_id",
                    models.CharField(
                        db_index=True,
                        help_text="Docker resource ID",
                        max_length=100,
                    ),
                ),
                (
                    "resource_name",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Human-readable resource name (best effort)",
                        max_length=255,
                    ),
                ),
                (
                    "request_id",
                    models.CharField(
                        db_index=True,
                        help_text="Request correlation ID",
                        max_length=64,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[("success", "Success"), ("error", "Error")],
                        db_index=True,
                        help_text="Outcome of the operation",
                        max_length=10,
                    ),
                ),
                (
                    "error_message",
                    models.TextField(
                        blank=True,
                        help_text="Error message if status is error (sanitized)",
                        null=True,
                    ),
                ),
                (
                    "metadata",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Additional metadata (sanitized, no secrets)",
                    ),
                ),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        help_text="User who performed the action (null for system actions)",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="audit_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Audit Event",
                "verbose_name_plural": "Audit Events",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="auditevent",
            index=models.Index(
                fields=["actor", "-created_at"],
                name="audit_audit_actor_i_3aef7d_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="auditevent",
            index=models.Index(
                fields=["action", "-created_at"],
                name="audit_audit_action_fa7d35_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="auditevent",
            index=models.Index(
                fields=["resource_type", "resource_id"],
                name="audit_audit_resourc_a1b2c3_idx",
            ),
        ),
    ]
