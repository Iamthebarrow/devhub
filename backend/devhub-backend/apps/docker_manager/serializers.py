"""
Serializers for Docker manager API responses.
"""

from rest_framework import serializers


class DockerSystemInfoSerializer(serializers.Serializer):
    """
    Serializer for Docker system info response.

    Contains only a sanitized subset of fields - no secrets or sensitive paths.
    """

    id = serializers.CharField(
        required=False,
        help_text="Unique ID of the Docker daemon",
    )
    name = serializers.CharField(
        required=False,
        help_text="Name of the Docker host",
    )
    operatingSystem = serializers.CharField(
        required=False,
        help_text="Operating system of the Docker host",
    )
    osType = serializers.CharField(
        required=False,
        help_text="OS type (e.g., linux, windows)",
    )
    architecture = serializers.CharField(
        required=False,
        help_text="Architecture (e.g., x86_64, aarch64)",
    )
    serverVersion = serializers.CharField(
        required=False,
        help_text="Docker server version",
    )
    containers = serializers.IntegerField(
        required=False,
        help_text="Total number of containers",
    )
    containersRunning = serializers.IntegerField(
        required=False,
        help_text="Number of running containers",
    )
    containersPaused = serializers.IntegerField(
        required=False,
        help_text="Number of paused containers",
    )
    containersStopped = serializers.IntegerField(
        required=False,
        help_text="Number of stopped containers",
    )
    images = serializers.IntegerField(
        required=False,
        help_text="Total number of images",
    )
    memTotal = serializers.IntegerField(
        required=False,
        help_text="Total memory in bytes",
    )
    ncpu = serializers.IntegerField(
        required=False,
        help_text="Number of CPUs",
    )


class DockerVersionSerializer(serializers.Serializer):
    """
    Serializer for Docker version response.

    Contains only a sanitized subset of version information.
    """

    version = serializers.CharField(
        required=False,
        help_text="Docker version",
    )
    apiVersion = serializers.CharField(
        required=False,
        help_text="Docker API version",
    )
    gitCommit = serializers.CharField(
        required=False,
        help_text="Git commit hash of Docker build",
    )
    goVersion = serializers.CharField(
        required=False,
        help_text="Go version used to build Docker",
    )
    os = serializers.CharField(
        required=False,
        help_text="Operating system",
    )
    arch = serializers.CharField(
        required=False,
        help_text="Architecture",
    )


class DockerErrorSerializer(serializers.Serializer):
    """Serializer for Docker error responses."""

    error = serializers.DictField(
        child=serializers.CharField(),
        help_text="Error details",
    )


# =============================================================================
# Container Serializers (Phase 4)
# =============================================================================


class ContainerPortSerializer(serializers.Serializer):
    """Serializer for container port binding."""

    containerPort = serializers.IntegerField(help_text="Container port number")
    hostPort = serializers.IntegerField(
        allow_null=True, required=False, help_text="Host port number"
    )
    hostIp = serializers.CharField(
        allow_blank=True, required=False, help_text="Host IP binding"
    )
    protocol = serializers.CharField(help_text="Protocol (tcp/udp)")


class ContainerMountSerializer(serializers.Serializer):
    """Serializer for container mount (sanitized - no source paths)."""

    target = serializers.CharField(help_text="Mount target path in container")
    type = serializers.CharField(help_text="Mount type (bind/volume/tmpfs)")
    readOnly = serializers.BooleanField(help_text="Whether mount is read-only")


class ContainerNetworkSerializer(serializers.Serializer):
    """Serializer for container network connection."""

    name = serializers.CharField(help_text="Network name")
    ipAddress = serializers.CharField(
        allow_blank=True, help_text="Container IP in this network"
    )


class RestartPolicySerializer(serializers.Serializer):
    """Serializer for container restart policy."""

    name = serializers.CharField(help_text="Restart policy name")
    maximumRetryCount = serializers.IntegerField(
        help_text="Max retry count for on-failure policy"
    )


class ContainerSummarySerializer(serializers.Serializer):
    """
    Serializer for container list response.

    Contains safe subset of container fields for list view.
    """

    id = serializers.CharField(help_text="Short container ID")
    name = serializers.CharField(help_text="Container name")
    image = serializers.CharField(help_text="Image name")
    state = serializers.CharField(help_text="Container state (running/exited/etc)")
    status = serializers.CharField(help_text="Human-readable status")
    created = serializers.CharField(help_text="Creation timestamp")
    ports = ContainerPortSerializer(many=True, help_text="Port bindings")
    labels = serializers.DictField(
        child=serializers.CharField(),
        help_text="Container labels (secrets filtered)",
    )


class ContainerDetailSerializer(ContainerSummarySerializer):
    """
    Serializer for container detail response.

    Extends summary with additional safe fields.
    """

    fullId = serializers.CharField(help_text="Full container ID")
    mounts = ContainerMountSerializer(
        many=True, help_text="Container mounts (sanitized)"
    )
    networks = ContainerNetworkSerializer(many=True, help_text="Network connections")
    restartPolicy = RestartPolicySerializer(help_text="Restart policy")


class ContainerListResponseSerializer(serializers.Serializer):
    """Response wrapper for container list."""

    results = ContainerSummarySerializer(many=True)
    count = serializers.IntegerField(help_text="Total number of containers")


class ContainerLogsResponseSerializer(serializers.Serializer):
    """Response for container logs."""

    logs = serializers.CharField(help_text="Log output")
    truncated = serializers.BooleanField(
        help_text="Whether logs were truncated", default=False
    )


class ContainerActionResponseSerializer(serializers.Serializer):
    """Response for container lifecycle actions (start/stop/restart)."""

    ok = serializers.BooleanField(help_text="Whether action succeeded")
    message = serializers.CharField(
        required=False, help_text="Optional status message"
    )


class ContainerLogsQuerySerializer(serializers.Serializer):
    """Query parameters for container logs endpoint."""

    tail = serializers.IntegerField(
        required=False,
        default=200,
        min_value=1,
        help_text="Number of lines to return (default 200, max from settings)",
    )
    since = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Return logs since this timestamp (ISO format or Unix timestamp)",
    )


# =============================================================================
# Image Serializers (Phase 5)
# =============================================================================


class ImageSummarySerializer(serializers.Serializer):
    """
    Serializer for image list response.

    Contains safe subset of image fields.
    """

    id = serializers.CharField(help_text="Short image ID")
    fullId = serializers.CharField(help_text="Full image ID")
    tags = serializers.ListField(
        child=serializers.CharField(),
        help_text="Image tags (e.g., nginx:latest)",
    )
    size = serializers.IntegerField(help_text="Image size in bytes")
    created = serializers.CharField(help_text="Creation timestamp")
    labels = serializers.DictField(
        child=serializers.CharField(),
        required=False,
        help_text="Image labels (secrets filtered)",
    )


class ImageListResponseSerializer(serializers.Serializer):
    """Response wrapper for image list."""

    results = ImageSummarySerializer(many=True)
    count = serializers.IntegerField(help_text="Total number of images")


class ImagePullRequestSerializer(serializers.Serializer):
    """Request body for image pull."""

    image = serializers.CharField(
        help_text="Image name with optional tag (e.g., nginx:latest)",
        max_length=200,
    )

    def validate_image(self, value):
        """Validate image name format."""
        import re

        from django.conf import settings

        pattern = getattr(settings, "IMAGE_NAME_PATTERN", None)
        if pattern and not pattern.match(value):
            raise serializers.ValidationError(
                "Image name contains invalid characters. "
                "Only alphanumeric, dots, underscores, hyphens, slashes, and colons allowed."
            )
        return value


class ImageRemoveRequestSerializer(serializers.Serializer):
    """Request body for image remove."""

    force = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Force removal even if image is in use",
    )


class TaskQueuedResponseSerializer(serializers.Serializer):
    """Response for queued background tasks."""

    status = serializers.CharField(help_text="Task status (e.g., 'queued')")
    task_id = serializers.CharField(help_text="Celery task ID for tracking")


# =============================================================================
# Volume Serializers (Phase 5)
# =============================================================================


class VolumeSummarySerializer(serializers.Serializer):
    """
    Serializer for volume list response.

    Does NOT include mountpoint to avoid exposing host paths.
    """

    name = serializers.CharField(help_text="Volume name")
    driver = serializers.CharField(help_text="Volume driver")
    scope = serializers.CharField(help_text="Volume scope (local/global)")
    created = serializers.CharField(
        required=False, allow_blank=True, help_text="Creation timestamp"
    )
    labels = serializers.DictField(
        child=serializers.CharField(),
        required=False,
        help_text="Volume labels (secrets filtered)",
    )


class VolumeListResponseSerializer(serializers.Serializer):
    """Response wrapper for volume list."""

    results = VolumeSummarySerializer(many=True)
    count = serializers.IntegerField(help_text="Total number of volumes")


# =============================================================================
# Network Serializers (Phase 5)
# =============================================================================


class NetworkSummarySerializer(serializers.Serializer):
    """
    Serializer for network list response.
    """

    id = serializers.CharField(help_text="Short network ID")
    name = serializers.CharField(help_text="Network name")
    driver = serializers.CharField(help_text="Network driver")
    scope = serializers.CharField(help_text="Network scope (local/swarm/global)")
    internal = serializers.BooleanField(help_text="Whether network is internal-only")
    subnets = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        help_text="Network subnets",
    )
    labels = serializers.DictField(
        child=serializers.CharField(),
        required=False,
        help_text="Network labels (secrets filtered)",
    )


class NetworkListResponseSerializer(serializers.Serializer):
    """Response wrapper for network list."""

    results = NetworkSummarySerializer(many=True)
    count = serializers.IntegerField(help_text="Total number of networks")
