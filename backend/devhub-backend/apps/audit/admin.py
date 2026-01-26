"""
Django admin configuration for audit app.

AuditEvent is read-only in admin - no create, update, or delete operations.
"""

from django.contrib import admin

from .models import AuditEvent


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    """
    Read-only admin interface for AuditEvent.

    Provides list/detail views with filters but no modification capabilities.
    """

    # List display
    list_display = [
        "created_at",
        "actor",
        "action",
        "resource_type",
        "resource_name",
        "status",
        "request_id",
    ]

    # List filters
    list_filter = [
        "status",
        "action",
        "resource_type",
        ("created_at", admin.DateFieldListFilter),
        "actor",
    ]

    # Search fields
    search_fields = [
        "action",
        "resource_id",
        "resource_name",
        "request_id",
        "actor__username",
        "ip_address",
    ]

    # Ordering
    ordering = ["-created_at"]

    # Date hierarchy for easy navigation
    date_hierarchy = "created_at"

    # Read-only fields (all fields)
    readonly_fields = [
        "id",
        "created_at",
        "actor",
        "ip_address",
        "user_agent",
        "action",
        "resource_type",
        "resource_id",
        "resource_name",
        "request_id",
        "status",
        "error_message",
        "metadata",
    ]

    # Fieldsets for detail view
    fieldsets = [
        (
            "Event Info",
            {
                "fields": ["id", "created_at", "status", "action"],
            },
        ),
        (
            "Actor",
            {
                "fields": ["actor", "ip_address", "user_agent"],
            },
        ),
        (
            "Resource",
            {
                "fields": ["resource_type", "resource_id", "resource_name"],
            },
        ),
        (
            "Request",
            {
                "fields": ["request_id"],
            },
        ),
        (
            "Details",
            {
                "fields": ["error_message", "metadata"],
                "classes": ["collapse"],
            },
        ),
    ]

    # Disable add permission
    def has_add_permission(self, request):
        return False

    # Disable change permission
    def has_change_permission(self, request, obj=None):
        return False

    # Disable delete permission
    def has_delete_permission(self, request, obj=None):
        return False

    # Custom display for actor
    def get_queryset(self, request):
        return super().get_queryset(request).select_related("actor")
