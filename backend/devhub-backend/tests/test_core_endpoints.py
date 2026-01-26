"""
Tests for core API endpoints (health and version).
"""

import pytest
from django.urls import reverse


@pytest.mark.django_db
class TestHealthEndpoint:
    """Tests for the health check endpoint."""

    def test_health_returns_200(self, api_client):
        """Health endpoint should return 200 OK."""
        url = reverse("core:health")
        response = api_client.get(url)

        assert response.status_code == 200

    def test_health_returns_ok_status(self, api_client):
        """Health endpoint should return {"status": "ok"}."""
        url = reverse("core:health")
        response = api_client.get(url)

        assert response.json() == {"status": "ok"}


@pytest.mark.django_db
class TestVersionEndpoint:
    """Tests for the version endpoint."""

    def test_version_returns_200(self, api_client):
        """Version endpoint should return 200 OK."""
        url = reverse("core:version")
        response = api_client.get(url)

        assert response.status_code == 200

    def test_version_returns_expected_json(self, api_client):
        """Version endpoint should return name and api keys."""
        url = reverse("core:version")
        response = api_client.get(url)
        data = response.json()

        assert "name" in data
        assert "api" in data
        assert data["name"] == "devhub"
        assert data["api"] == "v1"
