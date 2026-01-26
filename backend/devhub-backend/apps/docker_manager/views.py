"""
Views for Docker manager API endpoints.

All endpoints require authentication with at least viewer role.
Lifecycle operations (start/stop/restart) require operator role or higher.
"""

from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.accounts.permissions import IsAdmin, IsOperatorOrHigher, IsViewerOrHigher
from apps.audit.services import AuditService
from apps.core.throttles import DockerMutationThrottle

from .serializers import (
    ContainerActionResponseSerializer,
    ContainerDetailSerializer,
    ContainerListResponseSerializer,
    ContainerLogsQuerySerializer,
    ContainerLogsResponseSerializer,
    ContainerSummarySerializer,
    DockerErrorSerializer,
    DockerSystemInfoSerializer,
    DockerVersionSerializer,
    ImageListResponseSerializer,
    ImagePullRequestSerializer,
    ImageRemoveRequestSerializer,
    NetworkListResponseSerializer,
    TaskQueuedResponseSerializer,
    VolumeListResponseSerializer,
)
from .services import (
    ContainerNotFoundError,
    ContainerOperationError,
    DockerConnectionError,
    DockerService,
    DockerServiceError,
    InvalidImageNameError,
)
from .services.docker_service import get_docker_service


def _get_service() -> DockerService:
    """Get DockerService instance. Separated for easy mocking in tests."""
    return get_docker_service()


def _docker_error_response(error_type: str = "docker_unavailable", message: str = ""):
    """Create a standard Docker error response."""
    messages = {
        "docker_unavailable": "Docker engine is not available",
        "docker_error": "Failed to retrieve Docker information",
        "container_not_found": "Container not found",
        "operation_failed": "Container operation failed",
        "image_not_found": "Image not found",
        "invalid_image_name": "Invalid image name",
    }
    return {
        "error": {
            "code": error_type,
            "message": message or messages.get(error_type, "Docker error"),
        }
    }


# =============================================================================
# System Endpoints (Phase 3)
# =============================================================================


@extend_schema_view(
    get=extend_schema(
        tags=["docker-system"],
        summary="Get Docker system information",
        description=(
            "Returns sanitized Docker system information. "
            "Only includes safe fields (no secrets, paths, or security config). "
            "Requires authentication with at least viewer role."
        ),
        responses={
            200: DockerSystemInfoSerializer,
            401: DockerErrorSerializer,
            503: DockerErrorSerializer,
        },
    ),
)
class SystemInfoView(APIView):
    """
    Get Docker system information.

    Returns a sanitized subset of `docker info` output containing:
    - Host identification (id, name)
    - OS/architecture info
    - Container counts (total, running, paused, stopped)
    - Resource info (images, memory, CPUs)

    Never exposes: paths, environment variables, security options, network details.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsViewerOrHigher]

    def get(self, request):
        """Get Docker system information."""
        try:
            service = _get_service()
            info = service.get_system_info()
            serializer = DockerSystemInfoSerializer(info)
            return Response(serializer.data)

        except DockerConnectionError:
            return Response(
                _docker_error_response("docker_unavailable"),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except DockerServiceError:
            return Response(
                _docker_error_response("docker_error"),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


@extend_schema_view(
    get=extend_schema(
        tags=["docker-system"],
        summary="Get Docker version information",
        description=(
            "Returns Docker version information. "
            "Requires authentication with at least viewer role."
        ),
        responses={
            200: DockerVersionSerializer,
            401: DockerErrorSerializer,
            503: DockerErrorSerializer,
        },
    ),
)
class SystemVersionView(APIView):
    """
    Get Docker version information.

    Returns version info including:
    - Docker version
    - API version
    - Git commit (optional)
    - Go version (optional)
    - OS/architecture
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsViewerOrHigher]

    def get(self, request):
        """Get Docker version information."""
        try:
            service = _get_service()
            version = service.get_version()
            serializer = DockerVersionSerializer(version)
            return Response(serializer.data)

        except DockerConnectionError:
            return Response(
                _docker_error_response("docker_unavailable"),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except DockerServiceError:
            return Response(
                _docker_error_response("docker_error"),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


# =============================================================================
# Container Endpoints (Phase 4)
# =============================================================================


@extend_schema_view(
    get=extend_schema(
        tags=["docker-containers"],
        summary="List containers",
        description=(
            "Returns a list of all containers with optional filtering. "
            "Requires authentication with at least viewer role."
        ),
        parameters=[
            OpenApiParameter(
                name="status",
                type=str,
                location=OpenApiParameter.QUERY,
                description="Filter by status: running, exited, paused, or all (default: all)",
                required=False,
                enum=["running", "exited", "paused", "all"],
            ),
            OpenApiParameter(
                name="search",
                type=str,
                location=OpenApiParameter.QUERY,
                description="Search string to match against name, image, or ID",
                required=False,
            ),
        ],
        responses={
            200: ContainerListResponseSerializer,
            401: DockerErrorSerializer,
            503: DockerErrorSerializer,
        },
    ),
)
class ContainerListView(APIView):
    """
    List Docker containers.

    Supports filtering by status and search term.
    Returns sanitized container information (no secrets or sensitive paths).
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsViewerOrHigher]

    def get(self, request):
        """List containers with optional filters."""
        try:
            service = _get_service()

            # Get query parameters
            status_filter = request.query_params.get("status")
            search = request.query_params.get("search")

            containers = service.list_containers(status=status_filter, search=search)

            return Response({
                "results": containers,
                "count": len(containers),
            })

        except DockerConnectionError:
            return Response(
                _docker_error_response("docker_unavailable"),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except DockerServiceError:
            return Response(
                _docker_error_response("docker_error"),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


@extend_schema_view(
    get=extend_schema(
        tags=["docker-containers"],
        summary="Get container details",
        description=(
            "Returns detailed information about a specific container. "
            "Requires authentication with at least viewer role."
        ),
        responses={
            200: ContainerDetailSerializer,
            401: DockerErrorSerializer,
            404: DockerErrorSerializer,
            503: DockerErrorSerializer,
        },
    ),
)
class ContainerDetailView(APIView):
    """
    Get detailed information about a container.

    Returns sanitized container details including mounts and networks.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsViewerOrHigher]

    def get(self, request, container_id: str):
        """Get container details."""
        try:
            service = _get_service()
            container = service.get_container(container_id)
            serializer = ContainerDetailSerializer(container)
            return Response(serializer.data)

        except ContainerNotFoundError:
            return Response(
                _docker_error_response("container_not_found"),
                status=status.HTTP_404_NOT_FOUND,
            )
        except DockerConnectionError:
            return Response(
                _docker_error_response("docker_unavailable"),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except DockerServiceError:
            return Response(
                _docker_error_response("docker_error"),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


@extend_schema_view(
    get=extend_schema(
        tags=["docker-containers"],
        summary="Get container logs",
        description=(
            "Returns container logs with optional tail and since filters. "
            "Requires authentication with at least viewer role. "
            "Logs are truncated to prevent excessive response sizes."
        ),
        parameters=[
            OpenApiParameter(
                name="tail",
                type=int,
                location=OpenApiParameter.QUERY,
                description="Number of lines to return (default: 200, max: 2000)",
                required=False,
            ),
            OpenApiParameter(
                name="since",
                type=str,
                location=OpenApiParameter.QUERY,
                description="Return logs since timestamp (ISO format or Unix timestamp)",
                required=False,
            ),
        ],
        responses={
            200: ContainerLogsResponseSerializer,
            401: DockerErrorSerializer,
            404: DockerErrorSerializer,
            503: DockerErrorSerializer,
        },
    ),
)
class ContainerLogsView(APIView):
    """
    Get container logs.

    Returns logs with tail and since filtering.
    Output is truncated to maximum size from settings.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsViewerOrHigher]

    def get(self, request, container_id: str):
        """Get container logs."""
        try:
            # Validate query parameters
            query_serializer = ContainerLogsQuerySerializer(data=request.query_params)
            query_serializer.is_valid(raise_exception=True)

            tail = query_serializer.validated_data.get("tail", 200)
            since = query_serializer.validated_data.get("since")

            service = _get_service()
            logs = service.get_container_logs(
                container_id,
                tail=tail,
                since=since if since else None,
            )

            truncated = "[TRUNCATED]" in logs

            return Response({
                "logs": logs,
                "truncated": truncated,
            })

        except ContainerNotFoundError:
            return Response(
                _docker_error_response("container_not_found"),
                status=status.HTTP_404_NOT_FOUND,
            )
        except DockerConnectionError:
            return Response(
                _docker_error_response("docker_unavailable"),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except DockerServiceError:
            return Response(
                _docker_error_response("docker_error"),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class BaseContainerActionView(APIView):
    """
    Base class for container lifecycle actions.

    Provides common error handling and audit logging.
    Rate limited by DockerMutationThrottle (DEFAULT: 30/min).
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsOperatorOrHigher]
    throttle_classes = [DockerMutationThrottle]

    action_name: str = ""  # Override in subclass
    action_verb: str = ""  # e.g., "started", "stopped"

    def _get_container_info(self, service: DockerService, container_id: str) -> dict:
        """Get container info for audit logging."""
        try:
            return service.get_container(container_id)
        except Exception:
            return {"id": container_id, "name": ""}

    def _perform_action(self, service: DockerService, container_id: str) -> None:
        """Override in subclass to perform the actual action."""
        raise NotImplementedError

    def post(self, request, container_id: str):
        """Perform container action with audit logging."""
        audit = AuditService(request)
        service = _get_service()

        # Get container info for audit
        container_info = self._get_container_info(service, container_id)
        container_name = container_info.get("name", "")

        try:
            self._perform_action(service, container_id)

            # Log success
            audit.log_success(
                action=f"container.{self.action_name}",
                resource_type="container",
                resource_id=container_id,
                resource_name=container_name,
                metadata={"action": self.action_name},
            )

            return Response({
                "ok": True,
                "message": f"Container {self.action_verb}",
            })

        except ContainerNotFoundError:
            # Log failure
            audit.log_error(
                action=f"container.{self.action_name}",
                resource_type="container",
                resource_id=container_id,
                resource_name=container_name,
                error_message="Container not found",
            )
            return Response(
                _docker_error_response("container_not_found"),
                status=status.HTTP_404_NOT_FOUND,
            )
        except ContainerOperationError as e:
            # Log failure
            audit.log_error(
                action=f"container.{self.action_name}",
                resource_type="container",
                resource_id=container_id,
                resource_name=container_name,
                error_message=str(e),
            )
            return Response(
                {
                    "error": {
                        "code": "operation_failed",
                        "message": f"Failed to {self.action_name} container",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except DockerConnectionError:
            # Log failure
            audit.log_error(
                action=f"container.{self.action_name}",
                resource_type="container",
                resource_id=container_id,
                resource_name=container_name,
                error_message="Docker engine unavailable",
            )
            return Response(
                _docker_error_response("docker_unavailable"),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except DockerServiceError as e:
            # Log failure
            audit.log_error(
                action=f"container.{self.action_name}",
                resource_type="container",
                resource_id=container_id,
                resource_name=container_name,
                error_message=str(e),
            )
            return Response(
                _docker_error_response("docker_error"),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


@extend_schema_view(
    post=extend_schema(
        tags=["docker-containers"],
        summary="Start a container",
        description=(
            "Starts a stopped container. Idempotent - returns success if already running. "
            "Requires authentication with operator role or higher. "
            "Creates an audit event."
        ),
        request=None,
        responses={
            200: ContainerActionResponseSerializer,
            400: DockerErrorSerializer,
            401: DockerErrorSerializer,
            403: DockerErrorSerializer,
            404: DockerErrorSerializer,
            503: DockerErrorSerializer,
        },
    ),
)
class ContainerStartView(BaseContainerActionView):
    """Start a container."""

    action_name = "start"
    action_verb = "started"

    def _perform_action(self, service: DockerService, container_id: str) -> None:
        service.start_container(container_id)


@extend_schema_view(
    post=extend_schema(
        tags=["docker-containers"],
        summary="Stop a container",
        description=(
            "Stops a running container. Idempotent - returns success if already stopped. "
            "Requires authentication with operator role or higher. "
            "Creates an audit event."
        ),
        request=None,
        responses={
            200: ContainerActionResponseSerializer,
            400: DockerErrorSerializer,
            401: DockerErrorSerializer,
            403: DockerErrorSerializer,
            404: DockerErrorSerializer,
            503: DockerErrorSerializer,
        },
    ),
)
class ContainerStopView(BaseContainerActionView):
    """Stop a container."""

    action_name = "stop"
    action_verb = "stopped"

    def _perform_action(self, service: DockerService, container_id: str) -> None:
        service.stop_container(container_id)


@extend_schema_view(
    post=extend_schema(
        tags=["docker-containers"],
        summary="Restart a container",
        description=(
            "Restarts a container (stop + start). "
            "Requires authentication with operator role or higher. "
            "Creates an audit event."
        ),
        request=None,
        responses={
            200: ContainerActionResponseSerializer,
            400: DockerErrorSerializer,
            401: DockerErrorSerializer,
            403: DockerErrorSerializer,
            404: DockerErrorSerializer,
            503: DockerErrorSerializer,
        },
    ),
)
class ContainerRestartView(BaseContainerActionView):
    """Restart a container."""

    action_name = "restart"
    action_verb = "restarted"

    def _perform_action(self, service: DockerService, container_id: str) -> None:
        service.restart_container(container_id)


# =============================================================================
# Image Endpoints (Phase 5)
# =============================================================================


@extend_schema_view(
    get=extend_schema(
        tags=["docker-images"],
        summary="List Docker images",
        description=(
            "Returns a list of all Docker images. "
            "Requires authentication with at least viewer role."
        ),
        responses={
            200: ImageListResponseSerializer,
            401: DockerErrorSerializer,
            503: DockerErrorSerializer,
        },
    ),
)
class ImageListView(APIView):
    """
    List Docker images.

    Returns sanitized image information (no sensitive labels).
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsViewerOrHigher]

    def get(self, request):
        """List all images."""
        try:
            service = _get_service()
            images = service.list_images()

            return Response({
                "results": images,
                "count": len(images),
            })

        except DockerConnectionError:
            return Response(
                _docker_error_response("docker_unavailable"),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except DockerServiceError:
            return Response(
                _docker_error_response("docker_error"),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


@extend_schema_view(
    post=extend_schema(
        tags=["docker-images"],
        summary="Pull a Docker image",
        description=(
            "Queues a Docker image pull operation. "
            "The pull runs in the background via Celery. "
            "Requires authentication with operator role or higher. "
            "Creates an audit event when the task completes."
        ),
        request=ImagePullRequestSerializer,
        responses={
            202: TaskQueuedResponseSerializer,
            400: DockerErrorSerializer,
            401: DockerErrorSerializer,
            403: DockerErrorSerializer,
        },
        examples=[
            {
                "name": "Pull nginx:latest",
                "value": {"image": "nginx:latest"},
            },
            {
                "name": "Pull specific version",
                "value": {"image": "python:3.12-slim"},
            },
        ],
    ),
)
class ImagePullView(APIView):
    """
    Pull a Docker image.

    Enqueues the pull as a background task. Returns immediately with task ID.
    Rate limited by DockerMutationThrottle (DEFAULT: 30/min).
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsOperatorOrHigher]
    throttle_classes = [DockerMutationThrottle]

    def post(self, request):
        """Queue image pull."""
        from .tasks import docker_pull_image

        serializer = ImagePullRequestSerializer(data=request.data)

        if not serializer.is_valid():
            # Extract first error message
            errors = serializer.errors
            first_field = next(iter(errors))
            first_error = errors[first_field][0] if errors[first_field] else "Validation error"
            return Response(
                _docker_error_response("invalid_image_name", str(first_error)),
                status=status.HTTP_400_BAD_REQUEST,
            )

        image = serializer.validated_data["image"]
        user_id = request.user.id if request.user.is_authenticated else None

        # Queue the task
        task = docker_pull_image.delay(image, requested_by_user_id=user_id)

        return Response(
            {
                "status": "queued",
                "task_id": task.id,
            },
            status=status.HTTP_202_ACCEPTED,
        )


@extend_schema_view(
    post=extend_schema(
        tags=["docker-images"],
        summary="Remove a Docker image",
        description=(
            "Queues a Docker image removal operation. "
            "The removal runs in the background via Celery. "
            "Requires authentication with admin role. "
            "Creates an audit event when the task completes."
        ),
        request=ImageRemoveRequestSerializer,
        responses={
            202: TaskQueuedResponseSerializer,
            400: DockerErrorSerializer,
            401: DockerErrorSerializer,
            403: DockerErrorSerializer,
        },
        examples=[
            {
                "name": "Remove image",
                "value": {"force": False},
            },
            {
                "name": "Force remove",
                "value": {"force": True},
            },
        ],
    ),
)
class ImageRemoveView(APIView):
    """
    Remove a Docker image.

    Enqueues the removal as a background task. Returns immediately with task ID.
    Admin only. Rate limited by DockerMutationThrottle (DEFAULT: 30/min).
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdmin]
    throttle_classes = [DockerMutationThrottle]

    def post(self, request, image_id: str):
        """Queue image removal."""
        from .tasks import docker_remove_image

        # Validate image_id format (non-empty, reasonable length)
        if not image_id or len(image_id) > 128:
            return Response(
                _docker_error_response("invalid_image_name", "Invalid image ID"),
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ImageRemoveRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        force = serializer.validated_data.get("force", False)
        user_id = request.user.id if request.user.is_authenticated else None

        # Queue the task
        task = docker_remove_image.delay(
            image_id,
            requested_by_user_id=user_id,
            force=force,
        )

        return Response(
            {
                "status": "queued",
                "task_id": task.id,
            },
            status=status.HTTP_202_ACCEPTED,
        )


# =============================================================================
# Volume Endpoints (Phase 5)
# =============================================================================


@extend_schema_view(
    get=extend_schema(
        tags=["docker-volumes"],
        summary="List Docker volumes",
        description=(
            "Returns a list of all Docker volumes. "
            "Does not include host mount paths for security. "
            "Requires authentication with at least viewer role."
        ),
        responses={
            200: VolumeListResponseSerializer,
            401: DockerErrorSerializer,
            503: DockerErrorSerializer,
        },
    ),
)
class VolumeListView(APIView):
    """
    List Docker volumes.

    Returns sanitized volume information (no host paths).
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsViewerOrHigher]

    def get(self, request):
        """List all volumes."""
        try:
            service = _get_service()
            volumes = service.list_volumes()

            return Response({
                "results": volumes,
                "count": len(volumes),
            })

        except DockerConnectionError:
            return Response(
                _docker_error_response("docker_unavailable"),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except DockerServiceError:
            return Response(
                _docker_error_response("docker_error"),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


# =============================================================================
# Network Endpoints (Phase 5)
# =============================================================================


@extend_schema_view(
    get=extend_schema(
        tags=["docker-networks"],
        summary="List Docker networks",
        description=(
            "Returns a list of all Docker networks. "
            "Requires authentication with at least viewer role."
        ),
        responses={
            200: NetworkListResponseSerializer,
            401: DockerErrorSerializer,
            503: DockerErrorSerializer,
        },
    ),
)
class NetworkListView(APIView):
    """
    List Docker networks.

    Returns sanitized network information.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsViewerOrHigher]

    def get(self, request):
        """List all networks."""
        try:
            service = _get_service()
            networks = service.list_networks()

            return Response({
                "results": networks,
                "count": len(networks),
            })

        except DockerConnectionError:
            return Response(
                _docker_error_response("docker_unavailable"),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except DockerServiceError:
            return Response(
                _docker_error_response("docker_error"),
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
