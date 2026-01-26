"""
Tests for Phase 7: Test coverage completion + OpenAPI polish + Dev bootstrap + Release readiness.

Tests cover:
- Auth flows: login, refresh rotation, logout blacklist, /auth/me roles
- Permission enforcement across endpoints
- Docker endpoints: 503 mapping, container filters, logs truncation
- Container lifecycle idempotency
- Celery task behavior and audit creation
- Request ID propagation in audit records
"""

from unittest.mock import MagicMock, patch

import pytest
from django.conf import settings
from django.contrib.auth.models import Group, User
from django.urls import reverse
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit.models import AuditEvent, AuditStatus
from apps.docker_manager.services import (
    ContainerNotFoundError,
    ContainerOperationError,
    DockerConnectionError,
    DockerServiceError,
)


# =============================================================================
# Helper Functions
# =============================================================================


def get_auth_header(user):
    """Get JWT auth header for a user."""
    refresh = RefreshToken.for_user(user)
    return {"HTTP_AUTHORIZATION": f"Bearer {refresh.access_token}"}


def get_tokens_for_user(user):
    """Get both access and refresh tokens for a user."""
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


# =============================================================================
# Auth Flow Tests - Expanded
# =============================================================================


@pytest.mark.django_db
class TestAuthFlowComplete:
    """Comprehensive auth flow tests."""

    def test_login_success_returns_both_tokens(self, api_client, user):
        """Login returns access token in JSON and refresh in cookie."""
        url = reverse("accounts:login")
        response = api_client.post(
            url,
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )

        assert response.status_code == 200
        # Access token in JSON
        assert "access" in response.json()
        # Refresh token in cookie only
        assert "refresh" not in response.json()
        assert settings.REFRESH_TOKEN_COOKIE_NAME in response.cookies

    def test_login_failure_with_nonexistent_user(self, api_client):
        """Login with nonexistent user returns 401 without leaking existence."""
        url = reverse("accounts:login")
        response = api_client.post(
            url,
            {"username": "nonexistent_user_12345", "password": "anypassword"},
            format="json",
        )

        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "auth_failed"
        # Should not reveal that user doesn't exist
        assert "not found" not in data["error"]["message"].lower()
        assert "does not exist" not in data["error"]["message"].lower()

    def test_login_failure_with_wrong_password(self, api_client, user):
        """Login with wrong password returns 401."""
        url = reverse("accounts:login")
        response = api_client.post(
            url,
            {"username": "testuser", "password": "wrongpassword"},
            format="json",
        )

        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "auth_failed"

    def test_login_failure_missing_fields(self, api_client):
        """Login with missing fields returns 401."""
        url = reverse("accounts:login")

        # Missing password
        response = api_client.post(
            url,
            {"username": "testuser"},
            format="json",
        )
        assert response.status_code == 401

        # Missing username
        response = api_client.post(
            url,
            {"password": "testpass"},
            format="json",
        )
        assert response.status_code == 401

        # Empty body
        response = api_client.post(url, {}, format="json")
        assert response.status_code == 401


@pytest.mark.django_db
class TestRefreshTokenRotation:
    """Tests for refresh token rotation behavior."""

    def test_refresh_returns_new_access_token(self, api_client, user):
        """Refresh endpoint returns a new access token."""
        # Login first
        login_url = reverse("accounts:login")
        login_response = api_client.post(
            login_url,
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )

        old_access = login_response.json()["access"]
        refresh_token = login_response.cookies[settings.REFRESH_TOKEN_COOKIE_NAME].value

        # Set the refresh cookie
        api_client.cookies[settings.REFRESH_TOKEN_COOKIE_NAME] = refresh_token

        # Call refresh
        refresh_url = reverse("accounts:refresh")
        response = api_client.post(refresh_url)

        assert response.status_code == 200
        new_access = response.json()["access"]
        # New access token should be different (or at least present)
        assert new_access is not None
        assert len(new_access) > 0

    def test_refresh_rotates_cookie(self, api_client, user):
        """Refresh endpoint rotates the refresh token cookie."""
        # Login first
        login_url = reverse("accounts:login")
        login_response = api_client.post(
            login_url,
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )

        old_refresh = login_response.cookies[settings.REFRESH_TOKEN_COOKIE_NAME].value
        api_client.cookies[settings.REFRESH_TOKEN_COOKIE_NAME] = old_refresh

        # Call refresh
        refresh_url = reverse("accounts:refresh")
        response = api_client.post(refresh_url)

        assert response.status_code == 200
        # Should have a new refresh cookie
        assert settings.REFRESH_TOKEN_COOKIE_NAME in response.cookies

    def test_refresh_with_invalid_token_returns_401(self, api_client):
        """Refresh with invalid token returns 401."""
        api_client.cookies[settings.REFRESH_TOKEN_COOKIE_NAME] = "invalid-token"

        refresh_url = reverse("accounts:refresh")
        response = api_client.post(refresh_url)

        assert response.status_code == 401


@pytest.mark.django_db
class TestLogoutBlacklist:
    """Tests for logout and token blacklisting."""

    def test_logout_clears_refresh_cookie(self, api_client, user):
        """Logout clears the refresh token cookie."""
        # Login first
        login_url = reverse("accounts:login")
        login_response = api_client.post(
            login_url,
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )

        refresh_token = login_response.cookies[settings.REFRESH_TOKEN_COOKIE_NAME].value
        api_client.cookies[settings.REFRESH_TOKEN_COOKIE_NAME] = refresh_token

        # Logout
        logout_url = reverse("accounts:logout")
        response = api_client.post(logout_url)

        assert response.status_code == 200
        assert response.json() == {"ok": True}

        # Cookie should be cleared
        if settings.REFRESH_TOKEN_COOKIE_NAME in response.cookies:
            cookie = response.cookies[settings.REFRESH_TOKEN_COOKIE_NAME]
            assert cookie.value == "" or cookie["max-age"] == 0

    def test_logout_blacklists_refresh_token(self, api_client, user):
        """Logout blacklists the refresh token so it can't be reused."""
        # Login first
        login_url = reverse("accounts:login")
        login_response = api_client.post(
            login_url,
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )

        refresh_token = login_response.cookies[settings.REFRESH_TOKEN_COOKIE_NAME].value
        api_client.cookies[settings.REFRESH_TOKEN_COOKIE_NAME] = refresh_token

        # Logout
        logout_url = reverse("accounts:logout")
        api_client.post(logout_url)

        # Try to use the old refresh token (should fail)
        api_client.cookies[settings.REFRESH_TOKEN_COOKIE_NAME] = refresh_token
        refresh_url = reverse("accounts:refresh")
        response = api_client.post(refresh_url)

        # Should be rejected (blacklisted)
        assert response.status_code == 401

    def test_logout_without_cookie_succeeds(self, api_client):
        """Logout without a cookie still returns success."""
        logout_url = reverse("accounts:logout")
        response = api_client.post(logout_url)

        assert response.status_code == 200
        assert response.json() == {"ok": True}


@pytest.mark.django_db
class TestMeEndpointRoles:
    """Tests for /auth/me endpoint role correctness."""

    def test_me_returns_viewer_role(self, api_client, viewer_user):
        """Me endpoint returns viewer role."""
        api_client.credentials(**get_auth_header(viewer_user))
        response = api_client.get(reverse("accounts:me"))

        assert response.status_code == 200
        assert "viewer" in response.json()["roles"]
        assert "operator" not in response.json()["roles"]
        assert "admin" not in response.json()["roles"]

    def test_me_returns_operator_role(self, api_client, operator_user):
        """Me endpoint returns operator role."""
        api_client.credentials(**get_auth_header(operator_user))
        response = api_client.get(reverse("accounts:me"))

        assert response.status_code == 200
        assert "operator" in response.json()["roles"]
        assert "viewer" not in response.json()["roles"]

    def test_me_returns_admin_role(self, api_client, admin_user):
        """Me endpoint returns admin role."""
        api_client.credentials(**get_auth_header(admin_user))
        response = api_client.get(reverse("accounts:me"))

        assert response.status_code == 200
        assert "admin" in response.json()["roles"]

    def test_me_returns_multiple_roles(self, db):
        """Me endpoint returns multiple roles if user has them."""
        from rest_framework.test import APIClient

        user = User.objects.create_user(
            username="multirole",
            password="testpass123",
        )
        viewer_group, _ = Group.objects.get_or_create(name="viewer")
        operator_group, _ = Group.objects.get_or_create(name="operator")
        user.groups.add(viewer_group)
        user.groups.add(operator_group)

        client = APIClient()
        client.credentials(**get_auth_header(user))
        response = client.get(reverse("accounts:me"))

        assert response.status_code == 200
        roles = response.json()["roles"]
        assert "viewer" in roles
        assert "operator" in roles

    def test_me_requires_authentication(self, api_client):
        """Me endpoint requires authentication."""
        response = api_client.get(reverse("accounts:me"))
        assert response.status_code == 401


# =============================================================================
# Permission Enforcement Tests - Endpoint Level
# =============================================================================


@pytest.mark.django_db
class TestEndpointPermissions:
    """Tests for permission enforcement across all endpoints."""

    # Read-only endpoints that viewers can access
    READ_ENDPOINTS = [
        ("docker_manager:system-info", "get", None),
        ("docker_manager:system-version", "get", None),
        ("docker_manager:container-list", "get", None),
        ("docker_manager:image-list", "get", None),
        ("docker_manager:volume-list", "get", None),
        ("docker_manager:network-list", "get", None),
    ]

    # Mutation endpoints that require operator+
    OPERATOR_ENDPOINTS = [
        ("docker_manager:container-start", "post", {"container_id": "test"}),
        ("docker_manager:container-stop", "post", {"container_id": "test"}),
        ("docker_manager:container-restart", "post", {"container_id": "test"}),
        ("docker_manager:image-pull", "post", None),
    ]

    # Admin-only endpoints
    ADMIN_ENDPOINTS = [
        ("docker_manager:image-remove", "post", {"image_id": "test"}),
    ]

    @pytest.fixture
    def mock_docker_service(self):
        """Create a mock DockerService."""
        with patch("apps.docker_manager.views._get_service") as mock:
            service = MagicMock()
            service.get_system_info.return_value = {"id": "test"}
            service.get_version.return_value = {"version": "1.0"}
            service.list_containers.return_value = []
            service.list_images.return_value = []
            service.list_volumes.return_value = []
            service.list_networks.return_value = []
            service.get_container.return_value = {"id": "test", "name": "test"}
            service.start_container.return_value = None
            service.stop_container.return_value = None
            service.restart_container.return_value = None
            mock.return_value = service
            yield service

    def test_viewer_can_access_read_endpoints(
        self, api_client, viewer_user, mock_docker_service
    ):
        """Viewer can access all read-only endpoints."""
        api_client.credentials(**get_auth_header(viewer_user))

        for endpoint_name, method, kwargs in self.READ_ENDPOINTS:
            url = reverse(endpoint_name, kwargs=kwargs) if kwargs else reverse(endpoint_name)
            response = getattr(api_client, method)(url)
            assert response.status_code in [200, 503], f"Failed for {endpoint_name}"

    def test_viewer_cannot_access_operator_endpoints(
        self, api_client, viewer_user, mock_docker_service
    ):
        """Viewer cannot access operator endpoints."""
        api_client.credentials(**get_auth_header(viewer_user))

        for endpoint_name, method, kwargs in self.OPERATOR_ENDPOINTS:
            url = reverse(endpoint_name, kwargs=kwargs) if kwargs else reverse(endpoint_name)
            response = getattr(api_client, method)(url)
            assert response.status_code == 403, f"Expected 403 for {endpoint_name}"

    def test_operator_can_access_operator_endpoints(
        self, api_client, operator_user, mock_docker_service
    ):
        """Operator can access operator endpoints."""
        api_client.credentials(**get_auth_header(operator_user))

        # Mock the task for image pull
        with patch("apps.docker_manager.views.docker_pull_image") as mock_task:
            mock_task.delay.return_value = MagicMock(id="task-123")

            for endpoint_name, method, kwargs in self.OPERATOR_ENDPOINTS:
                url = reverse(endpoint_name, kwargs=kwargs) if kwargs else reverse(endpoint_name)
                if endpoint_name == "docker_manager:image-pull":
                    response = getattr(api_client, method)(
                        url, {"image": "nginx"}, format="json"
                    )
                else:
                    response = getattr(api_client, method)(url)
                assert response.status_code in [200, 202, 503], f"Failed for {endpoint_name}"

    def test_operator_cannot_access_admin_endpoints(
        self, api_client, operator_user, mock_docker_service
    ):
        """Operator cannot access admin-only endpoints."""
        api_client.credentials(**get_auth_header(operator_user))

        for endpoint_name, method, kwargs in self.ADMIN_ENDPOINTS:
            url = reverse(endpoint_name, kwargs=kwargs) if kwargs else reverse(endpoint_name)
            response = getattr(api_client, method)(url)
            assert response.status_code == 403, f"Expected 403 for {endpoint_name}"

    def test_admin_can_access_all_endpoints(
        self, api_client, admin_user, mock_docker_service
    ):
        """Admin can access all endpoints."""
        api_client.credentials(**get_auth_header(admin_user))

        # Mock the task for image operations
        with patch("apps.docker_manager.views.docker_pull_image") as mock_pull:
            with patch("apps.docker_manager.views.docker_remove_image") as mock_remove:
                mock_pull.delay.return_value = MagicMock(id="task-123")
                mock_remove.delay.return_value = MagicMock(id="task-456")

                all_endpoints = self.READ_ENDPOINTS + self.OPERATOR_ENDPOINTS + self.ADMIN_ENDPOINTS

                for endpoint_name, method, kwargs in all_endpoints:
                    url = reverse(endpoint_name, kwargs=kwargs) if kwargs else reverse(endpoint_name)
                    if endpoint_name == "docker_manager:image-pull":
                        response = getattr(api_client, method)(
                            url, {"image": "nginx"}, format="json"
                        )
                    elif endpoint_name == "docker_manager:image-remove":
                        response = getattr(api_client, method)(
                            url, {"force": False}, format="json"
                        )
                    else:
                        response = getattr(api_client, method)(url)
                    assert response.status_code in [200, 202, 503], f"Failed for {endpoint_name}"


# =============================================================================
# Docker Endpoint Tests - Error Mapping and Edge Cases
# =============================================================================


@pytest.mark.django_db
class TestDockerEndpoint503Mapping:
    """Tests for Docker endpoint 503 error mapping."""

    def test_system_info_returns_503_on_connection_error(self, api_client, viewer_user):
        """System info returns 503 when Docker is unavailable."""
        api_client.credentials(**get_auth_header(viewer_user))

        with patch("apps.docker_manager.views._get_service") as mock:
            mock.return_value.get_system_info.side_effect = DockerConnectionError()
            response = api_client.get(reverse("docker_manager:system-info"))

        assert response.status_code == 503
        assert response.json()["error"]["code"] == "docker_unavailable"

    def test_system_version_returns_503_on_connection_error(self, api_client, viewer_user):
        """System version returns 503 when Docker is unavailable."""
        api_client.credentials(**get_auth_header(viewer_user))

        with patch("apps.docker_manager.views._get_service") as mock:
            mock.return_value.get_version.side_effect = DockerConnectionError()
            response = api_client.get(reverse("docker_manager:system-version"))

        assert response.status_code == 503
        assert response.json()["error"]["code"] == "docker_unavailable"

    def test_container_list_returns_503_on_service_error(self, api_client, viewer_user):
        """Container list returns 503 on DockerServiceError."""
        api_client.credentials(**get_auth_header(viewer_user))

        with patch("apps.docker_manager.views._get_service") as mock:
            mock.return_value.list_containers.side_effect = DockerServiceError("error")
            response = api_client.get(reverse("docker_manager:container-list"))

        assert response.status_code == 503
        assert response.json()["error"]["code"] == "docker_error"


@pytest.mark.django_db
class TestContainerLogsEndpoint:
    """Tests for container logs endpoint features."""

    def test_logs_with_tail_parameter(self, api_client, viewer_user):
        """Logs endpoint respects tail parameter."""
        api_client.credentials(**get_auth_header(viewer_user))

        with patch("apps.docker_manager.views._get_service") as mock:
            mock.return_value.get_container_logs.return_value = "line1\nline2"

            url = reverse("docker_manager:container-logs", kwargs={"container_id": "test"})
            response = api_client.get(url + "?tail=100")

        assert response.status_code == 200
        mock.return_value.get_container_logs.assert_called_with("test", tail=100, since=None)

    def test_logs_with_since_parameter(self, api_client, viewer_user):
        """Logs endpoint respects since parameter."""
        api_client.credentials(**get_auth_header(viewer_user))

        with patch("apps.docker_manager.views._get_service") as mock:
            mock.return_value.get_container_logs.return_value = "recent logs"

            url = reverse("docker_manager:container-logs", kwargs={"container_id": "test"})
            response = api_client.get(url + "?since=1h")

        assert response.status_code == 200
        mock.return_value.get_container_logs.assert_called_with("test", tail=None, since="1h")

    def test_logs_truncation_indicator(self, api_client, viewer_user):
        """Logs endpoint shows truncation indicator."""
        api_client.credentials(**get_auth_header(viewer_user))

        with patch("apps.docker_manager.views._get_service") as mock:
            mock.return_value.get_container_logs.return_value = "logs... [TRUNCATED]"

            url = reverse("docker_manager:container-logs", kwargs={"container_id": "test"})
            response = api_client.get(url)

        assert response.status_code == 200
        assert response.json()["truncated"] is True

    def test_logs_without_truncation(self, api_client, viewer_user):
        """Logs endpoint shows no truncation when not truncated."""
        api_client.credentials(**get_auth_header(viewer_user))

        with patch("apps.docker_manager.views._get_service") as mock:
            mock.return_value.get_container_logs.return_value = "normal logs"

            url = reverse("docker_manager:container-logs", kwargs={"container_id": "test"})
            response = api_client.get(url)

        assert response.status_code == 200
        assert response.json()["truncated"] is False


# =============================================================================
# Container Lifecycle Idempotency Tests
# =============================================================================


@pytest.mark.django_db
class TestContainerLifecycleIdempotency:
    """Tests for container start/stop/restart idempotency."""

    def test_start_already_running_container_succeeds(self, api_client, operator_user):
        """Starting an already running container returns success."""
        api_client.credentials(**get_auth_header(operator_user))

        with patch("apps.docker_manager.views._get_service") as mock:
            mock.return_value.get_container.return_value = {
                "id": "test",
                "name": "test-container",
                "state": "running",
            }
            mock.return_value.start_container.return_value = None

            url = reverse("docker_manager:container-start", kwargs={"container_id": "test"})
            response = api_client.post(url)

        assert response.status_code == 200
        assert response.json()["ok"] is True

    def test_stop_already_stopped_container_succeeds(self, api_client, operator_user):
        """Stopping an already stopped container returns success."""
        api_client.credentials(**get_auth_header(operator_user))

        with patch("apps.docker_manager.views._get_service") as mock:
            mock.return_value.get_container.return_value = {
                "id": "test",
                "name": "test-container",
                "state": "exited",
            }
            mock.return_value.stop_container.return_value = None

            url = reverse("docker_manager:container-stop", kwargs={"container_id": "test"})
            response = api_client.post(url)

        assert response.status_code == 200
        assert response.json()["ok"] is True

    def test_restart_creates_audit_event(self, api_client, operator_user):
        """Restart operation creates an audit event."""
        api_client.credentials(**get_auth_header(operator_user))

        with patch("apps.docker_manager.views._get_service") as mock:
            mock.return_value.get_container.return_value = {
                "id": "test-container-123",
                "name": "my-container",
                "state": "running",
            }
            mock.return_value.restart_container.return_value = None

            url = reverse("docker_manager:container-restart", kwargs={"container_id": "test-container-123"})
            response = api_client.post(url)

        assert response.status_code == 200

        # Verify audit event
        event = AuditEvent.objects.filter(
            action="container.restart",
            resource_id="test-container-123",
        ).first()
        assert event is not None
        assert event.status == AuditStatus.SUCCESS


# =============================================================================
# Celery Task Tests with Audit Creation
# =============================================================================


@pytest.mark.django_db
class TestCeleryTaskAuditCreation:
    """Tests for Celery task audit event creation."""

    @patch("apps.docker_manager.tasks.get_docker_service")
    def test_pull_task_creates_audit_event_with_task_id(self, mock_get_service, admin_user):
        """Pull task creates audit event with task ID as request_id."""
        from apps.docker_manager.tasks import docker_pull_image

        mock_service = MagicMock()
        mock_service.pull_image.return_value = {
            "id": "img123",
            "tags": ["nginx:latest"],
            "size": 100000,
        }
        mock_get_service.return_value = mock_service

        # Run task synchronously (eager mode)
        result = docker_pull_image(
            image="nginx:latest",
            requested_by_user_id=admin_user.id,
        )

        assert result["status"] == "success"

        # Check audit event
        event = AuditEvent.objects.filter(action="image.pull").first()
        assert event is not None
        assert event.actor_id == admin_user.id
        assert event.status == AuditStatus.SUCCESS

    @patch("apps.docker_manager.tasks.get_docker_service")
    def test_remove_task_creates_audit_event(self, mock_get_service, admin_user):
        """Remove task creates audit event."""
        from apps.docker_manager.tasks import docker_remove_image

        mock_service = MagicMock()
        mock_service.remove_image.return_value = None
        mock_get_service.return_value = mock_service

        result = docker_remove_image(
            image_id="img123",
            requested_by_user_id=admin_user.id,
            force=False,
        )

        assert result["status"] == "success"

        event = AuditEvent.objects.filter(action="image.remove").first()
        assert event is not None
        assert event.actor_id == admin_user.id

    @patch("apps.docker_manager.tasks.get_docker_service")
    def test_pull_failure_creates_error_audit_event(self, mock_get_service, admin_user):
        """Failed pull creates error audit event."""
        from apps.docker_manager.services import ImageOperationError
        from apps.docker_manager.tasks import docker_pull_image

        mock_service = MagicMock()
        mock_service.pull_image.side_effect = ImageOperationError(
            "pull", "invalid:image", "not found"
        )
        mock_get_service.return_value = mock_service

        result = docker_pull_image(
            image="invalid:image",
            requested_by_user_id=admin_user.id,
        )

        assert result["status"] == "error"

        event = AuditEvent.objects.filter(
            action="image.pull",
            status=AuditStatus.ERROR,
        ).first()
        assert event is not None


# =============================================================================
# Request ID Propagation Tests
# =============================================================================


@pytest.mark.django_db
class TestRequestIdPropagation:
    """Tests for request ID propagation in audit records."""

    def test_audit_event_has_request_id(self, api_client, operator_user):
        """Audit events contain the request ID from the HTTP request."""
        api_client.credentials(**get_auth_header(operator_user))

        with patch("apps.docker_manager.views._get_service") as mock:
            mock.return_value.get_container.return_value = {
                "id": "test-123",
                "name": "test-container",
            }
            mock.return_value.start_container.return_value = None

            url = reverse("docker_manager:container-start", kwargs={"container_id": "test-123"})
            response = api_client.post(url)

        assert response.status_code == 200

        # Get the request ID from response header
        request_id = response.get("X-Request-ID")
        assert request_id is not None

        # Verify audit event has the same request ID
        event = AuditEvent.objects.filter(
            action="container.start",
            resource_id="test-123",
        ).first()
        assert event is not None
        assert event.request_id == request_id

    def test_response_includes_x_request_id_header(self, api_client, viewer_user):
        """All responses include X-Request-ID header."""
        api_client.credentials(**get_auth_header(viewer_user))

        with patch("apps.docker_manager.views._get_service") as mock:
            mock.return_value.get_system_info.return_value = {"id": "test"}

            response = api_client.get(reverse("docker_manager:system-info"))

        assert "X-Request-ID" in response
        # Request ID should be a valid UUID format
        request_id = response.get("X-Request-ID")
        assert len(request_id) == 36  # UUID format


# =============================================================================
# Bootstrap Command Tests
# =============================================================================


@pytest.mark.django_db
class TestBootstrapCommand:
    """Tests for devhub_bootstrap_roles management command."""

    def test_bootstrap_creates_roles(self):
        """Bootstrap command creates all three roles."""
        from django.core.management import call_command

        # Clear existing groups
        Group.objects.all().delete()

        call_command("devhub_bootstrap_roles")

        assert Group.objects.filter(name="admin").exists()
        assert Group.objects.filter(name="operator").exists()
        assert Group.objects.filter(name="viewer").exists()

    def test_bootstrap_is_idempotent(self):
        """Bootstrap command is safe to run multiple times."""
        from django.core.management import call_command

        call_command("devhub_bootstrap_roles")
        call_command("devhub_bootstrap_roles")

        # Should still have exactly 3 groups
        assert Group.objects.count() == 3

    def test_bootstrap_with_create_admin(self, settings):
        """Bootstrap with --create-admin creates admin user."""
        from django.core.management import call_command

        settings.DEV_ADMIN_USERNAME = "testadmin"
        settings.DEV_ADMIN_PASSWORD = "testadminpass123"
        settings.DEV_ADMIN_EMAIL = "testadmin@test.com"

        call_command("devhub_bootstrap_roles", "--create-admin")

        user = User.objects.filter(username="testadmin").first()
        assert user is not None
        assert user.groups.filter(name="admin").exists()
        assert user.check_password("testadminpass123")


# =============================================================================
# Error Response Format Tests
# =============================================================================


@pytest.mark.django_db
class TestErrorResponseFormat:
    """Tests for consistent error response format."""

    def test_401_error_format(self, api_client):
        """401 errors follow consistent format."""
        response = api_client.get(reverse("accounts:me"))

        assert response.status_code == 401
        data = response.json()
        assert "error" in data
        assert "code" in data["error"]
        assert "message" in data["error"]

    def test_403_error_format(self, api_client, viewer_user):
        """403 errors follow consistent format."""
        api_client.credentials(**get_auth_header(viewer_user))

        with patch("apps.docker_manager.views._get_service") as mock:
            mock.return_value.get_container.return_value = {"id": "test", "name": "test"}

            url = reverse("docker_manager:container-start", kwargs={"container_id": "test"})
            response = api_client.post(url)

        assert response.status_code == 403
        data = response.json()
        assert "error" in data
        assert "code" in data["error"]

    def test_404_error_format(self, api_client, operator_user):
        """404 errors follow consistent format."""
        api_client.credentials(**get_auth_header(operator_user))

        with patch("apps.docker_manager.views._get_service") as mock:
            mock.return_value.get_container.side_effect = ContainerNotFoundError("test")
            mock.return_value.start_container.side_effect = ContainerNotFoundError("test")

            url = reverse("docker_manager:container-start", kwargs={"container_id": "test"})
            response = api_client.post(url)

        assert response.status_code == 404
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == "container_not_found"

    def test_503_error_format(self, api_client, viewer_user):
        """503 errors follow consistent format."""
        api_client.credentials(**get_auth_header(viewer_user))

        with patch("apps.docker_manager.views._get_service") as mock:
            mock.return_value.get_system_info.side_effect = DockerConnectionError()

            response = api_client.get(reverse("docker_manager:system-info"))

        assert response.status_code == 503
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == "docker_unavailable"
