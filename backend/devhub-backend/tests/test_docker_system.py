"""
Tests for Docker system endpoints.

All tests mock the DockerService to avoid requiring a real Docker engine.
"""

from unittest.mock import MagicMock, patch

import pytest
from rest_framework import status

from apps.docker_manager.services import DockerConnectionError, DockerServiceError


# Mock data for tests
MOCK_SYSTEM_INFO = {
    "id": "ABC123",
    "name": "docker-host",
    "operatingSystem": "Ubuntu 22.04.3 LTS",
    "osType": "linux",
    "architecture": "x86_64",
    "serverVersion": "24.0.7",
    "containers": 10,
    "containersRunning": 5,
    "containersPaused": 1,
    "containersStopped": 4,
    "images": 25,
    "memTotal": 16777216000,
    "ncpu": 8,
}

MOCK_VERSION_INFO = {
    "version": "24.0.7",
    "apiVersion": "1.43",
    "gitCommit": "afdd53b",
    "goVersion": "go1.20.10",
    "os": "linux",
    "arch": "amd64",
}


@pytest.fixture
def mock_docker_service():
    """Create a mock DockerService."""
    mock_service = MagicMock()
    mock_service.get_system_info.return_value = MOCK_SYSTEM_INFO
    mock_service.get_version.return_value = MOCK_VERSION_INFO
    return mock_service


@pytest.mark.django_db
class TestDockerSystemInfoEndpoint:
    """Tests for GET /api/v1/docker/system/info/"""

    url = "/api/v1/docker/system/info/"

    def test_unauthenticated_returns_401(self, api_client):
        """Unauthenticated request returns 401."""
        response = api_client.get(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_viewer_can_access(self, api_client, viewer_user, mock_docker_service):
        """Viewer user can access system info."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(viewer_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_docker_service
        ):
            response = api_client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "docker-host"
        assert response.data["containers"] == 10
        assert response.data["containersRunning"] == 5

    def test_operator_can_access(self, api_client, operator_user, mock_docker_service):
        """Operator user can access system info."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(operator_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_docker_service
        ):
            response = api_client.get(self.url)

        assert response.status_code == status.HTTP_200_OK

    def test_admin_can_access(self, api_client, admin_user, mock_docker_service):
        """Admin user can access system info."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(admin_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_docker_service
        ):
            response = api_client.get(self.url)

        assert response.status_code == status.HTTP_200_OK

    def test_docker_unavailable_returns_503(self, api_client, viewer_user):
        """When Docker is unreachable, returns 503 with safe error."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(viewer_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        mock_service = MagicMock()
        mock_service.get_system_info.side_effect = DockerConnectionError(
            "Connection refused"
        )

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_service
        ):
            response = api_client.get(self.url)

        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert response.data["error"]["code"] == "docker_unavailable"
        # Should not expose internal error details
        assert "Connection refused" not in response.data["error"]["message"]

    def test_docker_error_returns_503(self, api_client, viewer_user):
        """When DockerService raises an error, returns 503 with safe error."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(viewer_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        mock_service = MagicMock()
        mock_service.get_system_info.side_effect = DockerServiceError(
            "Internal error details"
        )

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_service
        ):
            response = api_client.get(self.url)

        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert response.data["error"]["code"] == "docker_error"
        # Should not expose internal error details
        assert "Internal error details" not in response.data["error"]["message"]

    def test_response_contains_expected_fields(
        self, api_client, viewer_user, mock_docker_service
    ):
        """Response contains all expected sanitized fields."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(viewer_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_docker_service
        ):
            response = api_client.get(self.url)

        assert response.status_code == status.HTTP_200_OK

        # Check expected fields are present
        expected_fields = [
            "id",
            "name",
            "operatingSystem",
            "osType",
            "architecture",
            "serverVersion",
            "containers",
            "containersRunning",
            "containersPaused",
            "containersStopped",
            "images",
            "memTotal",
            "ncpu",
        ]
        for field in expected_fields:
            assert field in response.data


@pytest.mark.django_db
class TestDockerSystemVersionEndpoint:
    """Tests for GET /api/v1/docker/system/version/"""

    url = "/api/v1/docker/system/version/"

    def test_unauthenticated_returns_401(self, api_client):
        """Unauthenticated request returns 401."""
        response = api_client.get(self.url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_viewer_can_access(self, api_client, viewer_user, mock_docker_service):
        """Viewer user can access version info."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(viewer_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_docker_service
        ):
            response = api_client.get(self.url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["version"] == "24.0.7"
        assert response.data["apiVersion"] == "1.43"

    def test_docker_unavailable_returns_503(self, api_client, viewer_user):
        """When Docker is unreachable, returns 503 with safe error."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(viewer_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        mock_service = MagicMock()
        mock_service.get_version.side_effect = DockerConnectionError(
            "Connection refused"
        )

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_service
        ):
            response = api_client.get(self.url)

        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert response.data["error"]["code"] == "docker_unavailable"

    def test_response_contains_expected_fields(
        self, api_client, viewer_user, mock_docker_service
    ):
        """Response contains all expected version fields."""
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh = RefreshToken.for_user(viewer_user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        with patch(
            "apps.docker_manager.views._get_service", return_value=mock_docker_service
        ):
            response = api_client.get(self.url)

        assert response.status_code == status.HTTP_200_OK

        # Check expected fields are present
        expected_fields = [
            "version",
            "apiVersion",
            "gitCommit",
            "goVersion",
            "os",
            "arch",
        ]
        for field in expected_fields:
            assert field in response.data


@pytest.mark.django_db
class TestDockerServiceUnit:
    """Unit tests for DockerService class."""

    def test_sanitizes_system_info(self):
        """DockerService only returns allowed fields from system info."""
        from apps.docker_manager.services.docker_service import SYSTEM_INFO_ALLOWED_FIELDS

        # Verify we have the expected fields configured
        expected_docker_keys = {
            "ID",
            "Name",
            "OperatingSystem",
            "OSType",
            "Architecture",
            "ServerVersion",
            "Containers",
            "ContainersRunning",
            "ContainersPaused",
            "ContainersStopped",
            "Images",
            "MemTotal",
            "NCPU",
        }
        assert set(SYSTEM_INFO_ALLOWED_FIELDS.keys()) == expected_docker_keys

    def test_sanitizes_version_info(self):
        """DockerService only returns allowed fields from version info."""
        from apps.docker_manager.services.docker_service import VERSION_ALLOWED_FIELDS

        # Verify we have the expected fields configured
        expected_docker_keys = {
            "Version",
            "ApiVersion",
            "GitCommit",
            "GoVersion",
            "Os",
            "Arch",
        }
        assert set(VERSION_ALLOWED_FIELDS.keys()) == expected_docker_keys

    def test_connection_error_on_unreachable(self):
        """DockerService raises DockerConnectionError when Docker is unreachable."""
        from apps.docker_manager.services import DockerConnectionError, DockerService

        service = DockerService(docker_host="tcp://nonexistent:9999")

        with pytest.raises(DockerConnectionError):
            service.get_system_info()

    def test_is_available_returns_false_when_unreachable(self):
        """is_available returns False when Docker is unreachable."""
        from apps.docker_manager.services import DockerService

        service = DockerService(docker_host="tcp://nonexistent:9999")

        assert service.is_available() is False
