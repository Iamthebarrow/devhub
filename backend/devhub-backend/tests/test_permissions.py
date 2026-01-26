"""
Tests for role-based permission classes.
"""

import pytest
from django.contrib.auth.models import User

from apps.accounts.permissions import (
    IsAdmin,
    IsOperatorOrHigher,
    IsViewerOrHigher,
    has_role_or_higher,
)


class MockRequest:
    """Mock request object for permission testing."""

    def __init__(self, user):
        self.user = user


class MockView:
    """Mock view object for permission testing."""

    pass


@pytest.mark.django_db
class TestHasRoleOrHigher:
    """Tests for has_role_or_higher utility function."""

    def test_unauthenticated_user_returns_false(self):
        """Unauthenticated user has no roles."""
        assert has_role_or_higher(None, "viewer") is False

    def test_viewer_has_viewer_role(self, viewer_user):
        """Viewer user passes viewer check."""
        assert has_role_or_higher(viewer_user, "viewer") is True

    def test_viewer_does_not_have_operator_role(self, viewer_user):
        """Viewer user fails operator check."""
        assert has_role_or_higher(viewer_user, "operator") is False

    def test_viewer_does_not_have_admin_role(self, viewer_user):
        """Viewer user fails admin check."""
        assert has_role_or_higher(viewer_user, "admin") is False

    def test_operator_has_viewer_role(self, operator_user):
        """Operator user passes viewer check."""
        assert has_role_or_higher(operator_user, "viewer") is True

    def test_operator_has_operator_role(self, operator_user):
        """Operator user passes operator check."""
        assert has_role_or_higher(operator_user, "operator") is True

    def test_operator_does_not_have_admin_role(self, operator_user):
        """Operator user fails admin check."""
        assert has_role_or_higher(operator_user, "admin") is False

    def test_admin_has_all_roles(self, admin_user):
        """Admin user passes all checks."""
        assert has_role_or_higher(admin_user, "viewer") is True
        assert has_role_or_higher(admin_user, "operator") is True
        assert has_role_or_higher(admin_user, "admin") is True

    def test_superuser_has_all_roles(self, db):
        """Superuser passes all checks."""
        superuser = User.objects.create_superuser(
            username="superuser",
            email="super@test.com",
            password="superpass",
        )
        assert has_role_or_higher(superuser, "viewer") is True
        assert has_role_or_higher(superuser, "operator") is True
        assert has_role_or_higher(superuser, "admin") is True


@pytest.mark.django_db
class TestIsViewerOrHigher:
    """Tests for IsViewerOrHigher permission class."""

    def test_allows_viewer(self, viewer_user):
        """Viewer user is allowed."""
        permission = IsViewerOrHigher()
        request = MockRequest(viewer_user)
        assert permission.has_permission(request, MockView()) is True

    def test_allows_operator(self, operator_user):
        """Operator user is allowed."""
        permission = IsViewerOrHigher()
        request = MockRequest(operator_user)
        assert permission.has_permission(request, MockView()) is True

    def test_allows_admin(self, admin_user):
        """Admin user is allowed."""
        permission = IsViewerOrHigher()
        request = MockRequest(admin_user)
        assert permission.has_permission(request, MockView()) is True

    def test_denies_unauthenticated(self):
        """Unauthenticated user is denied."""
        permission = IsViewerOrHigher()
        request = MockRequest(None)
        assert permission.has_permission(request, MockView()) is False


@pytest.mark.django_db
class TestIsOperatorOrHigher:
    """Tests for IsOperatorOrHigher permission class."""

    def test_denies_viewer(self, viewer_user):
        """Viewer user is denied."""
        permission = IsOperatorOrHigher()
        request = MockRequest(viewer_user)
        assert permission.has_permission(request, MockView()) is False

    def test_allows_operator(self, operator_user):
        """Operator user is allowed."""
        permission = IsOperatorOrHigher()
        request = MockRequest(operator_user)
        assert permission.has_permission(request, MockView()) is True

    def test_allows_admin(self, admin_user):
        """Admin user is allowed."""
        permission = IsOperatorOrHigher()
        request = MockRequest(admin_user)
        assert permission.has_permission(request, MockView()) is True


@pytest.mark.django_db
class TestIsAdmin:
    """Tests for IsAdmin permission class."""

    def test_denies_viewer(self, viewer_user):
        """Viewer user is denied."""
        permission = IsAdmin()
        request = MockRequest(viewer_user)
        assert permission.has_permission(request, MockView()) is False

    def test_denies_operator(self, operator_user):
        """Operator user is denied."""
        permission = IsAdmin()
        request = MockRequest(operator_user)
        assert permission.has_permission(request, MockView()) is False

    def test_allows_admin(self, admin_user):
        """Admin user is allowed."""
        permission = IsAdmin()
        request = MockRequest(admin_user)
        assert permission.has_permission(request, MockView()) is True
