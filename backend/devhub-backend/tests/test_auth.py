"""
Tests for authentication endpoints.
"""

import pytest
from django.conf import settings
from django.urls import reverse


@pytest.mark.django_db
class TestLoginEndpoint:
    """Tests for POST /api/v1/auth/login/"""

    def test_login_success_returns_access_token(self, api_client, user):
        """Login with valid credentials returns access token."""
        url = reverse("accounts:login")
        response = api_client.post(
            url,
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )

        assert response.status_code == 200
        assert "access" in response.json()
        assert response.json()["access"]  # Not empty

    def test_login_success_returns_user_data(self, api_client, user):
        """Login with valid credentials returns user info."""
        url = reverse("accounts:login")
        response = api_client.post(
            url,
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )

        data = response.json()
        assert "user" in data
        assert data["user"]["id"] == user.id
        assert data["user"]["username"] == "testuser"
        assert "roles" in data["user"]

    def test_login_success_sets_refresh_cookie(self, api_client, user):
        """Login sets refresh token as HttpOnly cookie."""
        url = reverse("accounts:login")
        response = api_client.post(
            url,
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )

        cookie_name = settings.REFRESH_TOKEN_COOKIE_NAME
        assert cookie_name in response.cookies
        cookie = response.cookies[cookie_name]
        assert cookie["httponly"]

    def test_login_success_returns_roles(self, api_client, viewer_user):
        """Login returns user roles in response."""
        url = reverse("accounts:login")
        response = api_client.post(
            url,
            {"username": "vieweruser", "password": "viewerpass123"},
            format="json",
        )

        data = response.json()
        assert "viewer" in data["user"]["roles"]

    def test_login_failure_returns_401(self, api_client, user):
        """Login with invalid credentials returns 401."""
        url = reverse("accounts:login")
        response = api_client.post(
            url,
            {"username": "testuser", "password": "wrongpassword"},
            format="json",
        )

        assert response.status_code == 401

    def test_login_failure_returns_safe_error_message(self, api_client, user):
        """Login failure does not leak whether username exists."""
        url = reverse("accounts:login")

        # Wrong password
        response1 = api_client.post(
            url,
            {"username": "testuser", "password": "wrongpassword"},
            format="json",
        )

        # Non-existent user
        response2 = api_client.post(
            url,
            {"username": "nonexistent", "password": "anypassword"},
            format="json",
        )

        # Both should have same error format
        assert response1.status_code == 401
        assert response2.status_code == 401

        data1 = response1.json()
        data2 = response2.json()

        assert "error" in data1
        assert "error" in data2
        assert data1["error"]["code"] == "auth_failed"
        assert data2["error"]["code"] == "auth_failed"
        # Same message for both cases
        assert data1["error"]["message"] == data2["error"]["message"]

    def test_login_refresh_token_not_in_json(self, api_client, user):
        """Refresh token should never be in JSON response."""
        url = reverse("accounts:login")
        response = api_client.post(
            url,
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )

        data = response.json()
        assert "refresh" not in data


@pytest.mark.django_db
class TestRefreshEndpoint:
    """Tests for POST /api/v1/auth/refresh/"""

    def test_refresh_success_returns_new_access_token(self, api_client, user):
        """Refresh with valid cookie returns new access token."""
        # First login to get refresh cookie
        login_url = reverse("accounts:login")
        login_response = api_client.post(
            login_url,
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )

        # Get refresh token from cookie
        cookie_name = settings.REFRESH_TOKEN_COOKIE_NAME
        refresh_token = login_response.cookies[cookie_name].value

        # Set cookie on client
        api_client.cookies[cookie_name] = refresh_token

        # Call refresh endpoint
        refresh_url = reverse("accounts:refresh")
        response = api_client.post(refresh_url)

        assert response.status_code == 200
        assert "access" in response.json()
        assert response.json()["access"]

    def test_refresh_without_cookie_returns_401(self, api_client):
        """Refresh without cookie returns 401."""
        url = reverse("accounts:refresh")
        response = api_client.post(url)

        assert response.status_code == 401
        assert "error" in response.json()

    def test_refresh_rotates_refresh_cookie(self, api_client, user):
        """Refresh should set a new refresh cookie."""
        # First login to get refresh cookie
        login_url = reverse("accounts:login")
        login_response = api_client.post(
            login_url,
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )

        cookie_name = settings.REFRESH_TOKEN_COOKIE_NAME
        old_refresh = login_response.cookies[cookie_name].value
        api_client.cookies[cookie_name] = old_refresh

        # Call refresh endpoint
        refresh_url = reverse("accounts:refresh")
        response = api_client.post(refresh_url)

        assert response.status_code == 200
        # Should have new refresh cookie
        assert cookie_name in response.cookies


@pytest.mark.django_db
class TestLogoutEndpoint:
    """Tests for POST /api/v1/auth/logout/"""

    def test_logout_clears_cookie(self, api_client, user):
        """Logout clears the refresh cookie."""
        # First login
        login_url = reverse("accounts:login")
        login_response = api_client.post(
            login_url,
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )

        cookie_name = settings.REFRESH_TOKEN_COOKIE_NAME
        refresh_token = login_response.cookies[cookie_name].value
        api_client.cookies[cookie_name] = refresh_token

        # Logout
        logout_url = reverse("accounts:logout")
        response = api_client.post(logout_url)

        assert response.status_code == 200
        assert response.json() == {"ok": True}

        # Cookie should be cleared (max-age=0 or deleted)
        if cookie_name in response.cookies:
            cookie = response.cookies[cookie_name]
            # Cookie is deleted (empty value or max-age=0)
            assert cookie.value == "" or cookie["max-age"] == 0

    def test_logout_without_cookie_succeeds(self, api_client):
        """Logout without cookie still returns success."""
        url = reverse("accounts:logout")
        response = api_client.post(url)

        assert response.status_code == 200
        assert response.json() == {"ok": True}


@pytest.mark.django_db
class TestMeEndpoint:
    """Tests for GET /api/v1/auth/me/"""

    def test_me_requires_authentication(self, api_client):
        """Me endpoint requires authentication."""
        url = reverse("accounts:me")
        response = api_client.get(url)

        assert response.status_code == 401

    def test_me_returns_user_data(self, api_client, viewer_user):
        """Me endpoint returns current user data."""
        # Login to get access token
        login_url = reverse("accounts:login")
        login_response = api_client.post(
            login_url,
            {"username": "vieweruser", "password": "viewerpass123"},
            format="json",
        )

        access_token = login_response.json()["access"]

        # Call me endpoint with auth header
        me_url = reverse("accounts:me")
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        response = api_client.get(me_url)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == viewer_user.id
        assert data["username"] == "vieweruser"
        assert data["email"] == "viewer@example.com"
        assert "roles" in data
        assert "viewer" in data["roles"]

    def test_me_returns_roles(self, api_client, admin_user):
        """Me endpoint returns user roles."""
        login_url = reverse("accounts:login")
        login_response = api_client.post(
            login_url,
            {"username": "adminuser", "password": "adminpass123"},
            format="json",
        )

        access_token = login_response.json()["access"]

        me_url = reverse("accounts:me")
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        response = api_client.get(me_url)

        assert response.status_code == 200
        assert "admin" in response.json()["roles"]
