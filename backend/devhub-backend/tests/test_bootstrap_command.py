"""
Tests for the devhub_bootstrap_roles management command.
"""

import pytest
from django.contrib.auth.models import Group, User
from django.core.management import call_command
from io import StringIO


@pytest.mark.django_db
class TestBootstrapRolesCommand:
    """Tests for devhub_bootstrap_roles management command."""

    def test_creates_roles(self):
        """Command creates admin, operator, viewer groups."""
        # Ensure groups don't exist
        Group.objects.filter(name__in=["admin", "operator", "viewer"]).delete()

        out = StringIO()
        call_command("devhub_bootstrap_roles", stdout=out)

        # Check groups were created
        assert Group.objects.filter(name="admin").exists()
        assert Group.objects.filter(name="operator").exists()
        assert Group.objects.filter(name="viewer").exists()

        output = out.getvalue()
        assert "Created role: admin" in output
        assert "Created role: operator" in output
        assert "Created role: viewer" in output

    def test_idempotent_no_error_on_second_run(self):
        """Running command twice doesn't error."""
        out1 = StringIO()
        out2 = StringIO()

        # Run twice
        call_command("devhub_bootstrap_roles", stdout=out1)
        call_command("devhub_bootstrap_roles", stdout=out2)

        # Second run should show roles exist
        output2 = out2.getvalue()
        assert "Role exists: admin" in output2
        assert "Role exists: operator" in output2
        assert "Role exists: viewer" in output2

    def test_groups_exist_after_double_run(self):
        """Groups still exist after running command twice."""
        call_command("devhub_bootstrap_roles")
        call_command("devhub_bootstrap_roles")

        assert Group.objects.filter(name="admin").count() == 1
        assert Group.objects.filter(name="operator").count() == 1
        assert Group.objects.filter(name="viewer").count() == 1

    def test_create_admin_without_env_vars_warns(self, settings):
        """--create-admin without env vars shows warning."""
        settings.DEV_ADMIN_USERNAME = ""
        settings.DEV_ADMIN_PASSWORD = ""

        out = StringIO()
        call_command("devhub_bootstrap_roles", "--create-admin", stdout=out)

        output = out.getvalue()
        assert "DEV_ADMIN_USERNAME" in output
        assert "Skipping" in output

    def test_create_admin_with_env_vars_creates_user(self, settings):
        """--create-admin with env vars creates admin user."""
        settings.DEV_ADMIN_USERNAME = "testadmin"
        settings.DEV_ADMIN_PASSWORD = "testpassword123"
        settings.DEV_ADMIN_EMAIL = "testadmin@test.com"

        # Ensure user doesn't exist
        User.objects.filter(username="testadmin").delete()

        out = StringIO()
        call_command("devhub_bootstrap_roles", "--create-admin", stdout=out)

        # Check user was created
        assert User.objects.filter(username="testadmin").exists()
        user = User.objects.get(username="testadmin")
        assert user.email == "testadmin@test.com"
        assert user.check_password("testpassword123")
        assert user.groups.filter(name="admin").exists()

        output = out.getvalue()
        assert "Created admin user: testadmin" in output

    def test_create_admin_idempotent(self, settings):
        """--create-admin doesn't duplicate user on second run."""
        settings.DEV_ADMIN_USERNAME = "testadmin2"
        settings.DEV_ADMIN_PASSWORD = "testpassword123"
        settings.DEV_ADMIN_EMAIL = "testadmin2@test.com"

        User.objects.filter(username="testadmin2").delete()

        call_command("devhub_bootstrap_roles", "--create-admin")
        call_command("devhub_bootstrap_roles", "--create-admin")

        assert User.objects.filter(username="testadmin2").count() == 1
