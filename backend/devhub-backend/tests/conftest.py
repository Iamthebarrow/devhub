"""
Pytest configuration and fixtures for DevHub backend tests.
"""

import os

import pytest

# Set up Django settings for tests
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")


def pytest_configure():
    """Configure Django settings before running tests."""
    # Override database to use SQLite for faster tests
    from django.conf import settings

    settings.DATABASES["default"] = {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }

    # Use database backend for axes in tests (no Redis dependency)
    settings.AXES_HANDLER = "axes.handlers.database.AxesDatabaseHandler"

    # Use local memory cache for tests
    settings.CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "test-cache",
        },
    }


@pytest.fixture
def api_client():
    """Return a Django REST Framework API client."""
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def user(db):
    """Create a test user."""
    from django.contrib.auth.models import User

    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123",
    )


@pytest.fixture
def admin_user(db):
    """Create a test admin user with admin role."""
    from django.contrib.auth.models import Group, User

    user = User.objects.create_user(
        username="adminuser",
        email="admin@example.com",
        password="adminpass123",
    )
    admin_group, _ = Group.objects.get_or_create(name="admin")
    user.groups.add(admin_group)
    return user


@pytest.fixture
def operator_user(db):
    """Create a test operator user with operator role."""
    from django.contrib.auth.models import Group, User

    user = User.objects.create_user(
        username="operatoruser",
        email="operator@example.com",
        password="operatorpass123",
    )
    operator_group, _ = Group.objects.get_or_create(name="operator")
    user.groups.add(operator_group)
    return user


@pytest.fixture
def viewer_user(db):
    """Create a test viewer user with viewer role."""
    from django.contrib.auth.models import Group, User

    user = User.objects.create_user(
        username="vieweruser",
        email="viewer@example.com",
        password="viewerpass123",
    )
    viewer_group, _ = Group.objects.get_or_create(name="viewer")
    user.groups.add(viewer_group)
    return user


@pytest.fixture
def authenticated_client(api_client, user):
    """Return an API client authenticated with a test user."""
    from rest_framework_simplejwt.tokens import RefreshToken

    refresh = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return api_client


@pytest.fixture
def roles(db):
    """Create the standard DevHub roles (groups)."""
    from django.contrib.auth.models import Group

    roles = ["admin", "operator", "viewer"]
    groups = []
    for role in roles:
        group, _ = Group.objects.get_or_create(name=role)
        groups.append(group)
    return groups
