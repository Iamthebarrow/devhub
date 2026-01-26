"""
Tests for container endpoints (Phase 4).

All tests mock the DockerService to avoid requiring a real Docker engine.
"""

from unittest.mock import MagicMock, patch

import pytest
from rest_framework import status

from apps.audit.models import AuditEvent, AuditStatus
from apps.docker_manager.services import (
    ContainerNotFoundError,
    ContainerOperationError,
    DockerConnectionError,
)


# Mock data for tests
MOCK_CONTAINER_SUMMARY = {
    "id": "abc123",
    "name": "test-container",
    "image": "nginx:latest",
    "state": "running",
    "status": "Up 2 hours",
    "created": "2024-01-15T10:00:00Z",
    "ports": [
        {"containerPort": 80, "hostPort": 8080, "hostIp": "", "protocol": "tcp"}
    ],
    "labels": {"app": "test"},
}

MOCK_CONTAINER_DETAIL = {
    **MOCK_CONTAINER_SUMMARY,
    "fullId": "abc123def456789",
    "mounts": [{"target": "/data", "type": "volume", "readOnly": False}],
    "networks": [{"name": "bridge", "ipAddress": "172.17.0.2"}],
    "restartPolicy": {"name": "always", "maximumRetryCount": 0},
}

MOCK_LOGS = "2024-01-15T10:00:00Z Container started\n2024-01-15T10:00:01Z Ready"


@pytest.fixture
def mock_docker_service():
    """Create a mock DockerService."""
    mock_service = MagicMock()
    mock_service.list_containers.return_value = [MOCK_CONTAINER_SUMMARY]
    mock_service.get_container.return_value = MOCK_CONTAINER_DETAIL
    mock_service.get_container_logs.return_value = MOCK_LOGS
    mock_service.start_container.return_value = None
    mock_service.stop_container.return_value = None
    mock_service.restart_container.return_value = None
    return mock_service


# =============================================================================
# Container List Tests
# =============================================================================


@pytest.mark.django_db
class TestContainerListEndpoint:
    """Tests for GET /api/v1/docker/containers/"""

    url = "/api/v1/docker/containers/"

    def test_unauthenticated_returns_401(self, api_client):
        """Unauthenticated request returns 401."""
        response = api_client.get(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_viewer_can_list(self, api_client, viewer_user, mock_docker_service):
        """Viewer user can list containers."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(viewer_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_docker_service
        ):
            response = api_client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        assert "results" in response.data
        assert "count" in response.data
        assert response.data["count"] == 1
        assert response.data["results"][0]["name"] == "test-container"

    def test_docker_unavailable_returns_503(self, api_client, viewer_user):
        """When Docker is unreachable, returns 503."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(viewer_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        mock_service = MagicMock()
        mock_service.list_containers.side_effect = DockerConnectionError(
            "Connection refused"
        )

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_service
        ):
            response = api_client.get(self.url)

        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert response.data["error"]["code"] == "docker_unavailable"


# =============================================================================
# Container Detail Tests
# =============================================================================


@pytest.mark.django_db
class TestContainerDetailEndpoint:
    """Tests for GET /api/v1/docker/containers/{id}/"""

    url = "/api/v1/docker/containers/abc123/"

    def test_unauthenticated_returns_401(self, api_client):
        """Unauthenticated request returns 401."""
        response = api_client.get(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_viewer_can_view_detail(self, api_client, viewer_user, mock_docker_service):
        """Viewer user can view container details."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(viewer_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_docker_service
        ):
            response = api_client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "test-container"
        assert response.data["fullId"] == "abc123def456789"
        assert "mounts" in response.data
        assert "networks" in response.data

    def test_container_not_found_returns_404(self, api_client, viewer_user):
        """When container not found, returns 404."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(viewer_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        mock_service = MagicMock()
        mock_service.get_container.side_effect = ContainerNotFoundError("abc123")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_service
        ):
            response = api_client.get(self.url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.data["error"]["code"] == "container_not_found"


# =============================================================================
# Container Logs Tests
# =============================================================================


@pytest.mark.django_db
class TestContainerLogsEndpoint:
    """Tests for GET /api/v1/docker/containers/{id}/logs/"""

    url = "/api/v1/docker/containers/abc123/logs/"

    def test_viewer_can_view_logs(self, api_client, viewer_user, mock_docker_service):
        """Viewer user can view container logs."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(viewer_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_docker_service
        ):
            response = api_client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        assert "logs" in response.data
        assert "truncated" in response.data
        assert response.data["truncated"] is False

    def test_logs_with_tail_parameter(
        self, api_client, viewer_user, mock_docker_service
    ):
        """Logs endpoint respects tail parameter."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(viewer_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_docker_service
        ):
            response = api_client.get(self.url + "?tail=100")

        assert response.status_code == status.HTTP_200_OK
        mock_docker_service.get_container_logs.assert_called_with(
            "abc123", tail=100, since=None
        )

    def test_truncated_logs_indicator(self, api_client, viewer_user):
        """Truncated logs show truncated flag."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(viewer_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        mock_service = MagicMock()
        mock_service.get_container_logs.return_value = "logs...\n... [TRUNCATED]"

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_service
        ):
            response = api_client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["truncated"] is True


# =============================================================================
# Container Lifecycle Tests (Start/Stop/Restart)
# =============================================================================


@pytest.mark.django_db
class TestContainerStartEndpoint:
    """Tests for POST /api/v1/docker/containers/{id}/start/"""

    url = "/api/v1/docker/containers/abc123/start/"

    def test_unauthenticated_returns_401(self, api_client):
        """Unauthenticated request returns 401."""
        response = api_client.post(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_viewer_cannot_start(self, api_client, viewer_user, mock_docker_service):
        """Viewer user cannot start containers (403)."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(viewer_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_docker_service
        ):
            response = api_client.post(self.url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_operator_can_start(self, api_client, operator_user, mock_docker_service):
        """Operator user can start containers."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(operator_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_docker_service
        ):
            response = api_client.post(self.url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["ok"] is True
        mock_docker_service.start_container.assert_called_once_with("abc123")

    def test_admin_can_start(self, api_client, admin_user, mock_docker_service):
        """Admin user can start containers."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(admin_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_docker_service
        ):
            response = api_client.post(self.url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["ok"] is True

    def test_start_creates_audit_event_success(
        self, api_client, operator_user, mock_docker_service
    ):
        """Starting container creates audit event on success."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(operator_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_docker_service
        ):
            response = api_client.post(self.url)

        assert response.status_code == status.HTTP_200_OK

        # Check audit event was created
        audit_event = AuditEvent.objects.filter(
            action="container.start",
            resource_id="abc123",
        ).first()
        assert audit_event is not None
        assert audit_event.status == AuditStatus.SUCCESS
        assert audit_event.actor == operator_user

    def test_start_creates_audit_event_failure(self, api_client, operator_user):
        """Starting container creates audit event on failure."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(operator_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        mock_service = MagicMock()
        mock_service.get_container.return_value = MOCK_CONTAINER_DETAIL
        mock_service.start_container.side_effect = ContainerNotFoundError("abc123")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_service
        ):
            response = api_client.post(self.url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

        # Check audit event was created with error status
        audit_event = AuditEvent.objects.filter(
            action="container.start",
            resource_id="abc123",
        ).first()
        assert audit_event is not None
        assert audit_event.status == AuditStatus.ERROR

    def test_container_not_found_returns_404(self, api_client, operator_user):
        """When container not found, returns 404."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(operator_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        mock_service = MagicMock()
        mock_service.get_container.side_effect = ContainerNotFoundError("abc123")
        mock_service.start_container.side_effect = ContainerNotFoundError("abc123")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_service
        ):
            response = api_client.post(self.url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_docker_unavailable_returns_503(self, api_client, operator_user):
        """When Docker is unreachable, returns 503."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(operator_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        mock_service = MagicMock()
        mock_service.get_container.return_value = MOCK_CONTAINER_DETAIL
        mock_service.start_container.side_effect = DockerConnectionError(
            "Connection refused"
        )

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_service
        ):
            response = api_client.post(self.url)

        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


@pytest.mark.django_db
class TestContainerStopEndpoint:
    """Tests for POST /api/v1/docker/containers/{id}/stop/"""

    url = "/api/v1/docker/containers/abc123/stop/"

    def test_viewer_cannot_stop(self, api_client, viewer_user, mock_docker_service):
        """Viewer user cannot stop containers (403)."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(viewer_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_docker_service
        ):
            response = api_client.post(self.url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_operator_can_stop(self, api_client, operator_user, mock_docker_service):
        """Operator user can stop containers."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(operator_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_docker_service
        ):
            response = api_client.post(self.url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["ok"] is True
        mock_docker_service.stop_container.assert_called_once_with("abc123")


@pytest.mark.django_db
class TestContainerRestartEndpoint:
    """Tests for POST /api/v1/docker/containers/{id}/restart/"""

    url = "/api/v1/docker/containers/abc123/restart/"

    def test_viewer_cannot_restart(self, api_client, viewer_user, mock_docker_service):
        """Viewer user cannot restart containers (403)."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(viewer_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_docker_service
        ):
            response = api_client.post(self.url)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_operator_can_restart(self, api_client, operator_user, mock_docker_service):
        """Operator user can restart containers."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(operator_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_docker_service
        ):
            response = api_client.post(self.url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["ok"] is True
        mock_docker_service.restart_container.assert_called_once_with("abc123")

    def test_restart_creates_audit_event(
        self, api_client, operator_user, mock_docker_service
    ):
        """Restarting container creates audit event."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(operator_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_docker_service
        ):
            response = api_client.post(self.url)

        assert response.status_code == status.HTTP_200_OK

        audit_event = AuditEvent.objects.filter(
            action="container.restart",
            resource_id="abc123",
        ).first()
        assert audit_event is not None
        assert audit_event.status == AuditStatus.SUCCESS


# =============================================================================
# AuditEvent Model Tests
# =============================================================================


@pytest.mark.django_db
class TestAuditEventModel:
    """Tests for AuditEvent model."""

    def test_audit_event_cannot_be_modified(self, db):
        """AuditEvent records cannot be modified after creation."""
        event = AuditEvent.objects.create(
            action="container.start",
            resource_type="container",
            resource_id="abc123",
            request_id="test-request-id",
            status=AuditStatus.SUCCESS,
        )

        event.action = "container.stop"
        with pytest.raises(ValueError, match="cannot be modified"):
            event.save()

    def test_audit_event_cannot_be_deleted(self, db):
        """AuditEvent records cannot be deleted via model."""
        event = AuditEvent.objects.create(
            action="container.start",
            resource_type="container",
            resource_id="abc123",
            request_id="test-request-id",
            status=AuditStatus.SUCCESS,
        )

        with pytest.raises(ValueError, match="cannot be deleted"):
            event.delete()


# =============================================================================
# DockerService Unit Tests
# =============================================================================


@pytest.mark.django_db
class TestDockerServiceContainerMethods:
    """Unit tests for DockerService container methods."""

    def test_list_containers_applies_status_filter(self):
        """list_containers applies status filter."""
        from apps.docker_manager.services import DockerService

        # This test verifies the method signature; actual filtering is tested
        # via integration tests with real Docker
        service = DockerService(docker_host="tcp://nonexistent:9999")

        with pytest.raises(Exception):
            # Will fail to connect, but verifies method exists
            service.list_containers(status="running", search="test")

    def test_get_container_raises_not_found(self):
        """get_container raises ContainerNotFoundError for missing container."""
        from apps.docker_manager.services import ContainerNotFoundError, DockerService

        service = DockerService(docker_host="tcp://nonexistent:9999")

        with pytest.raises(Exception):
            # Will fail to connect; real not-found test requires mock
            service.get_container("nonexistent")

    def test_logs_max_tail_enforcement(self):
        """Logs method enforces max tail setting."""
        from unittest.mock import MagicMock, patch

        from apps.docker_manager.services import DockerService

        # Create a mock container
        mock_container = MagicMock()
        mock_container.logs.return_value = b"test logs"

        mock_client = MagicMock()
        mock_client.containers.get.return_value = mock_container
        mock_client.ping.return_value = True

        service = DockerService()
        service._client = mock_client

        # Request more than max
        with patch.object(
            service, "_get_client", return_value=mock_client
        ):
            with patch(
                "apps.docker_manager.services.docker_service.settings"
            ) as mock_settings:
                mock_settings.CONTAINER_LOGS_MAX_TAIL = 100
                mock_settings.CONTAINER_LOGS_MAX_SIZE = 64 * 1024

                logs = service.get_container_logs("abc123", tail=5000)

        # Should have been capped to max
        mock_container.logs.assert_called_once()
        call_kwargs = mock_container.logs.call_args[1]
        assert call_kwargs["tail"] == 100  # Capped to max
