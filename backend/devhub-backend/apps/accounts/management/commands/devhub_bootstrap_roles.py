"""
Management command to bootstrap DevHub roles and optionally create/update an admin user.

Usage:
    python manage.py devhub_bootstrap_roles
    python manage.py devhub_bootstrap_roles --create-admin
    python manage.py devhub_bootstrap_roles --create-admin --update-password

This command is idempotent - safe to run multiple times.

Behavior:
- Creates admin, operator, viewer groups if they don't exist
- With --create-admin: creates admin user from DEV_ADMIN_* env vars
- With --update-password: also updates password if user already exists
"""

from django.conf import settings
from django.contrib.auth.models import Group, User
from django.core.management.base import BaseCommand

# DevHub roles
ROLES = ["admin", "operator", "viewer"]


class Command(BaseCommand):
    help = "Bootstrap DevHub roles (groups) and optionally create/update admin user"

    def add_arguments(self, parser):
        parser.add_argument(
            "--create-admin",
            action="store_true",
            help="Create admin user from DEV_ADMIN_* env vars",
        )
        parser.add_argument(
            "--update-password",
            action="store_true",
            help="Update password if admin user already exists (use with --create-admin)",
        )

    def handle(self, *args, **options):
        self.stdout.write("Bootstrapping DevHub roles...")

        # Create roles (groups)
        for role in ROLES:
            group, created = Group.objects.get_or_create(name=role)
            if created:
                self.stdout.write(self.style.SUCCESS(f"  Created role: {role}"))
            else:
                self.stdout.write(f"  Role exists: {role}")

        self.stdout.write(self.style.SUCCESS("Roles bootstrapped successfully."))

        # Optionally create admin user
        if options["create_admin"]:
            self._create_admin_user(update_password=options["update_password"])

    def _create_admin_user(self, update_password: bool = False):
        """
        Create or update admin user from environment variables.

        Args:
            update_password: If True, update password even if user exists.
        """
        username = getattr(settings, "DEV_ADMIN_USERNAME", "")
        password = getattr(settings, "DEV_ADMIN_PASSWORD", "")
        email = getattr(settings, "DEV_ADMIN_EMAIL", "")

        if not username or not password:
            self.stdout.write(
                self.style.WARNING(
                    "DEV_ADMIN_USERNAME and DEV_ADMIN_PASSWORD must be set "
                    "to create admin user. Skipping."
                )
            )
            return

        user, created = User.objects.get_or_create(
            username=username,
            defaults={"email": email, "is_staff": True},
        )

        admin_group = Group.objects.get(name="admin")

        if created:
            user.set_password(password)
            user.save()
            user.groups.add(admin_group)
            self.stdout.write(
                self.style.SUCCESS(f"Created admin user: {username}")
            )
        else:
            # User already exists
            changes = []

            # Update password if requested
            if update_password:
                user.set_password(password)
                user.save()
                changes.append("password updated")

            # Update email if different
            if email and user.email != email:
                user.email = email
                user.save()
                changes.append("email updated")

            # Ensure user is in admin group
            if admin_group not in user.groups.all():
                user.groups.add(admin_group)
                changes.append("added to admin group")

            # Ensure is_staff is set
            if not user.is_staff:
                user.is_staff = True
                user.save()
                changes.append("is_staff set")

            if changes:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Updated admin user {username}: {', '.join(changes)}"
                    )
                )
            else:
                self.stdout.write(f"Admin user exists (no changes): {username}")
