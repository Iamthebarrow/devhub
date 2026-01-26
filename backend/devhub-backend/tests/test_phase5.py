"""
Tests for Phase 5 features: Images, Volumes, Networks, and Celery tasks.

These tests mock DockerService and Celery tasks to avoid requiring
real Docker or Redis connections.
"""

from unittest.mock import MagicMock, patch

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mock_docker_service():
    """Mock DockerService for testing."""
    with patch("apps.docker_manager.views._get_service") as mock_get_service:
        mock_service = MagicMock()
        mock_get_service.return_value = mock_service
        yield mock_service


@pytest.fixture
def mock_image_list():
    """Sample image list data."""
    return [
        {
            "id": "abc123",
            "fullId": "sha256:abc123def456",
            "tags": ["nginx:latest", "nginx:1.25"],
            "size": 192000000,
            "created": "2024-01-15T10:00:00Z",
            "labels": {"maintainer": "NGINX Docker Maintainers"},
        },
        {
            "id": "def456",
            "fullId": "sha256:def456ghi789",
            "tags": ["python:3.12-slim"],
            "size": 150000000,
            "created": "2024-01-14T08:00:00Z",
            "labels": {},
        },
    ]


@pytest.fixture
def mock_volume_list():
    """Sample volume list data."""
    return [
        {
            "name": "my-data",
            "driver": "local",
            "scope": "local",
            "created": "2024-01-10T12:00:00Z",
            "labels": {},
        },
        {
            "name": "postgres-data",
            "driver": "local",
            "scope": "local",
            "created": "2024-01-09T09:00:00Z",
            "labels": {"app": "database"},
        },
    ]


@pytest.fixture
def mock_network_list():
    """Sample network list data."""
    return [
        {
            "id": "net123",
            "name": "bridge",
            "driver": "bridge",
            "scope": "local",
            "internal": False,
            "subnets": ["172.17.0.0/16"],
            "labels": {},
        },
        {
            "id": "net456",
            "name": "devhub_default",
            "driver": "bridge",
            "scope": "local",
            "internal": False,
            "subnets": ["172.18.0.0/16"],
            "labels": {"com.docker.compose.project": "devhub"},
        },
    ]


def get_auth_header(user):
    """Get JWT auth header for a user."""
    refresh = RefreshToken.for_user(user)
    return {"HTTP_AUTHORIZATION": f"Bearer {refresh.access_token}"}


# =============================================================================
# Image List Tests
# =============================================================================


@pytest.mark.django_db
class TestImageListView:
    """Tests for GET /api/v1/docker/images/"""

    def test_viewer_can_list_images(
        self, api_client, viewer_user, mock_docker_service, mock_image_list
    ):
        """Viewer role can list images."""
        mock_docker_service.list_images.return_value = mock_image_list

        response = api_client.get(
            reverse("docker_manager:image-list"),
            **get_auth_header(viewer_user),
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2
        assert len(response.data["results"]) == 2
        assert response.data["results"][0]["id"] == "abc123"

    def test_unauthenticated_cannot_list_images(self, api_client, mock_docker_service):
        """Unauthenticated requests are rejected."""
        response = api_client.get(reverse("docker_manager:image-list"))

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_docker_unavailable_returns_503(
        self, api_client, viewer_user, mock_docker_service
    ):
        """Returns 503 when Docker is unavailable."""
        from apps.docker_manager.services import DockerConnectionError

        mock_docker_service.list_images.side_effect = DockerConnectionError()

        response = api_client.get(
            reverse("docker_manager:image-list"),
            **get_auth_header(viewer_user),
        )

        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert response.data["error"]["code"] == "docker_unavailable"


# =============================================================================
# Image Pull Tests
# =============================================================================


@pytest.mark.django_db
class TestImagePullView:
    """Tests for POST /api/v1/docker/images/pull/"""

    @patch("apps.docker_manager.views.docker_pull_image")
    def test_operator_can_pull_image(
        self, mock_task, api_client, operator_user, mock_docker_service
    ):
        """Operator role can queue image pull."""
        mock_task.delay.return_value = MagicMock(id="task-123")

        response = api_client.post(
            reverse("docker_manager:image-pull"),
            {"image": "nginx:latest"},
            format="json",
            **get_auth_header(operator_user),
        )

        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.data["status"] == "queued"
        assert response.data["task_id"] == "task-123"
        mock_task.delay.assert_called_once_with(
            "nginx:latest", requested_by_user_id=operator_user.id
        )

    @patch("apps.docker_manager.views.docker_pull_image")
    def test_viewer_cannot_pull_image(
        self, mock_task, api_client, viewer_user, mock_docker_service
    ):
        """Viewer role cannot pull images."""
        response = api_client.post(
            reverse("docker_manager:image-pull"),
            {"image": "nginx:latest"},
            format="json",
            **get_auth_header(viewer_user),
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        mock_task.delay.assert_not_called()

    @patch("apps.docker_manager.views.docker_pull_image")
    def test_admin_can_pull_image(
        self, mock_task, api_client, admin_user, mock_docker_service
    ):
        """Admin role can queue image pull."""
        mock_task.delay.return_value = MagicMock(id="task-456")

        response = api_client.post(
            reverse("docker_manager:image-pull"),
            {"image": "python:3.12"},
            format="json",
            **get_auth_header(admin_user),
        )

        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.data["task_id"] == "task-456"

    def test_invalid_image_name_rejected(
        self, api_client, operator_user, mock_docker_service
    ):
        """Invalid image names are rejected."""
        response = api_client.post(
            reverse("docker_manager:image-pull"),
            {"image": "nginx<script>"},  # Invalid characters
            format="json",
            **get_auth_header(operator_user),
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "invalid" in response.data["error"]["code"].lower()


# =============================================================================
# Image Remove Tests
# =============================================================================


@pytest.mark.django_db
class TestImageRemoveView:
    """Tests for POST /api/v1/docker/images/{id}/remove/"""

    @patch("apps.docker_manager.views.docker_remove_image")
    def test_admin_can_remove_image(
        self, mock_task, api_client, admin_user, mock_docker_service
    ):
        """Admin role can queue image removal."""
        mock_task.delay.return_value = MagicMock(id="task-789")

        response = api_client.post(
            reverse("docker_manager:image-remove", kwargs={"image_id": "abc123"}),
            {"force": False},
            format="json",
            **get_auth_header(admin_user),
        )

        assert response.status_code == status.HTTP_202_ACCEPTED
        assert response.data["status"] == "queued"
        assert response.data["task_id"] == "task-789"
        mock_task.delay.assert_called_once_with(
            "abc123", requested_by_user_id=admin_user.id, force=False
        )

    @patch("apps.docker_manager.views.docker_remove_image")
    def test_operator_cannot_remove_image(
        self, mock_task, api_client, operator_user, mock_docker_service
    ):
        """Operator role cannot remove images."""
        response = api_client.post(
            reverse("docker_manager:image-remove", kwargs={"image_id": "abc123"}),
            {"force": False},
            format="json",
            **get_auth_header(operator_user),
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        mock_task.delay.assert_not_called()

    @patch("apps.docker_manager.views.docker_remove_image")
    def test_viewer_cannot_remove_image(
        self, mock_task, api_client, viewer_user, mock_docker_service
    ):
        """Viewer role cannot remove images."""
        response = api_client.post(
            reverse("docker_manager:image-remove", kwargs={"image_id": "abc123"}),
            {"force": False},
            format="json",
            **get_auth_header(viewer_user),
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        mock_task.delay.assert_not_called()

    @patch("apps.docker_manager.views.docker_remove_image")
    def test_force_remove(
        self, mock_task, api_client, admin_user, mock_docker_service
    ):
        """Force removal flag is passed to task."""
        mock_task.delay.return_value = MagicMock(id="task-force")

        response = api_client.post(
            reverse("docker_manager:image-remove", kwargs={"image_id": "abc123"}),
            {"force": True},
            format="json",
            **get_auth_header(admin_user),
        )

        assert response.status_code == status.HTTP_202_ACCEPTED
        mock_task.delay.assert_called_once_with(
            "abc123", requested_by_user_id=admin_user.id, force=True
        )


# =============================================================================
# Volume List Tests
# =============================================================================


@pytest.mark.django_db
class TestVolumeListView:
    """Tests for GET /api/v1/docker/volumes/"""

    def test_viewer_can_list_volumes(
        self, api_client, viewer_user, mock_docker_service, mock_volume_list
    ):
        """Viewer role can list volumes."""
        mock_docker_service.list_volumes.return_value = mock_volume_list

        response = api_client.get(
            reverse("docker_manager:volume-list"),
            **get_auth_header(viewer_user),
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2
        assert response.data["results"][0]["name"] == "my-data"

    def test_unauthenticated_cannot_list_volumes(
        self, api_client, mock_docker_service
    ):
        """Unauthenticated requests are rejected."""
        response = api_client.get(reverse("docker_manager:volume-list"))

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# =============================================================================
# Network List Tests
# =============================================================================


@pytest.mark.django_db
class TestNetworkListView:
    """Tests for GET /api/v1/docker/networks/"""

    def test_viewer_can_list_networks(
        self, api_client, viewer_user, mock_docker_service, mock_network_list
    ):
        """Viewer role can list networks."""
        mock_docker_service.list_networks.return_value = mock_network_list

        response = api_client.get(
            reverse("docker_manager:network-list"),
            **get_auth_header(viewer_user),
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 2
        assert response.data["results"][0]["name"] == "bridge"

    def test_unauthenticated_cannot_list_networks(
        self, api_client, mock_docker_service
    ):
        """Unauthenticated requests are rejected."""
        response = api_client.get(reverse("docker_manager:network-list"))

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# =============================================================================
# Celery Task Tests (with mocked DockerService)
# =============================================================================


@pytest.mark.django_db
class TestDockerPullImageTask:
    """Tests for docker_pull_image Celery task."""

    @patch("apps.docker_manager.tasks.get_docker_service")
    def test_pull_success_creates_audit_event(
        self, mock_get_service, admin_user
    ):
        """Successful pull creates success audit event."""
        from apps.audit.models import AuditEvent, AuditStatus
        from apps.docker_manager.tasks import docker_pull_image

        mock_service = MagicMock()
        mock_service.pull_image.return_value = {
            "id": "abc123",
            "tags": ["nginx:latest"],
            "size": 100000000,
        }
        mock_get_service.return_value = mock_service

        # Run task synchronously
        result = docker_pull_image(
            image="nginx:latest",
            requested_by_user_id=admin_user.id,
        )

        assert result["status"] == "success"
        assert result["image"] == "nginx:latest"

        # Check audit event was created
        audit_event = AuditEvent.objects.filter(
            action="image.pull",
            resource_id="abc123",
        ).first()

        assert audit_event is not None
        assert audit_event.status == AuditStatus.SUCCESS
        assert audit_event.actor_id == admin_user.id

    @patch("apps.docker_manager.tasks.get_docker_service")
    def test_pull_failure_creates_error_audit_event(
        self, mock_get_service, admin_user
    ):
        """Failed pull creates error audit event."""
        from apps.audit.models import AuditEvent, AuditStatus
        from apps.docker_manager.services import ImageOperationError
        from apps.docker_manager.tasks import docker_pull_image

        mock_service = MagicMock()
        mock_service.pull_image.side_effect = ImageOperationError(
            "pull", "nginx:invalid", "image not found"
        )
        mock_get_service.return_value = mock_service

        result = docker_pull_image(
            image="nginx:invalid",
            requested_by_user_id=admin_user.id,
        )

        assert result["status"] == "error"
        assert result["error"] == "pull_failed"

        # Check error audit event was created
        audit_event = AuditEvent.objects.filter(
            action="image.pull",
            resource_id="nginx:invalid",
            status=AuditStatus.ERROR,
        ).first()

        assert audit_event is not None
        assert audit_event.error_message is not None


@pytest.mark.django_db
class TestDockerRemoveImageTask:
    """Tests for docker_remove_image Celery task."""

    @patch("apps.docker_manager.tasks.get_docker_service")
    def test_remove_success_creates_audit_event(
        self, mock_get_service, admin_user
    ):
        """Successful removal creates success audit event."""
        from apps.audit.models import AuditEvent, AuditStatus
        from apps.docker_manager.tasks import docker_remove_image

        mock_service = MagicMock()
        mock_service.remove_image.return_value = None
        mock_get_service.return_value = mock_service

        result = docker_remove_image(
            image_id="abc123",
            requested_by_user_id=admin_user.id,
            force=False,
        )

        assert result["status"] == "success"
        assert result["image_id"] == "abc123"

        # Check audit event was created
        audit_event = AuditEvent.objects.filter(
            action="image.remove",
            resource_id="abc123",
        ).first()

        assert audit_event is not None
        assert audit_event.status == AuditStatus.SUCCESS

    @patch("apps.docker_manager.tasks.get_docker_service")
    def test_remove_not_found_creates_error_audit_event(
        self, mock_get_service, admin_user
    ):
        """Image not found creates error audit event."""
        from apps.audit.models import AuditEvent, AuditStatus
        from apps.docker_manager.services import ImageNotFoundError
        from apps.docker_manager.tasks import docker_remove_image

        mock_service = MagicMock()
        mock_service.remove_image.side_effect = ImageNotFoundError("nonexistent")
        mock_get_service.return_value = mock_service

        result = docker_remove_image(
            image_id="nonexistent",
            requested_by_user_id=admin_user.id,
            force=False,
        )

        assert result["status"] == "error"
        assert result["error"] == "image_not_found"

        # Check error audit event
        audit_event = AuditEvent.objects.filter(
            action="image.remove",
            resource_id="nonexistent",
            status=AuditStatus.ERROR,
        ).first()

        assert audit_event is not None


# =============================================================================
# Image Name Validation Tests
# =============================================================================


@pytest.mark.django_db
class TestImageNameValidation:
    """Tests for image name validation."""

    def test_valid_image_names(self, api_client, operator_user):
        """Valid image names are accepted."""
        from apps.docker_manager.serializers import ImagePullRequestSerializer

        valid_names = [
            "nginx",
            "nginx:latest",
            "nginx:1.25.3",
            "library/nginx",
            "myregistry.com/myimage:v1",
            "docker.io/library/nginx:latest",
            "ghcr.io/owner/repo:tag",
            "python:3.12-slim",
            "node:20-alpine3.18",
        ]

        for name in valid_names:
            serializer = ImagePullRequestSerializer(data={"image": name})
            assert serializer.is_valid(), f"Expected '{name}' to be valid"

    def test_invalid_image_names(self, api_client, operator_user):
        """Invalid image names are rejected."""
        from apps.docker_manager.serializers import ImagePullRequestSerializer

        invalid_names = [
            "nginx<script>alert(1)</script>",
            "nginx$(whoami)",
            "nginx`id`",
            "nginx|cat /etc/passwd",
            "nginx;rm -rf /",
            "nginx && cat /etc/shadow",
        ]

        for name in invalid_names:
            serializer = ImagePullRequestSerializer(data={"image": name})
            assert not serializer.is_valid(), f"Expected '{name}' to be invalid"
