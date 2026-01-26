"""
Management command to check DevHub service dependencies.

Usage:
    python manage.py devhub_check
    python manage.py devhub_check --verbose

Checks:
- Database connectivity
- Redis connectivity (if configured)
- Docker connectivity

Exits with code 0 if all required services are reachable.
Exits with code 1 if any critical dependency is missing.

IMPORTANT: This command MUST NOT leak secrets or sensitive configuration.
"""

import sys

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Check DevHub service dependencies (DB, Redis, Docker)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--verbose",
            "-v",
            action="store_true",
            help="Show detailed output for each check",
        )
        parser.add_argument(
            "--fail-fast",
            action="store_true",
            help="Exit immediately on first failure",
        )

    def handle(self, *args, **options):
        verbose = options["verbose"]
        fail_fast = options["fail_fast"]

        self.stdout.write("DevHub Dependency Check")
        self.stdout.write("=" * 40)

        all_ok = True

        # Check database
        db_ok = self._check_database(verbose)
        if not db_ok:
            all_ok = False
            if fail_fast:
                sys.exit(1)

        # Check Redis (optional but recommended)
        redis_ok = self._check_redis(verbose)
        if not redis_ok:
            # Redis failure is a warning, not a critical failure
            self.stdout.write(
                self.style.WARNING("  (Redis is optional for dev, required for production)")
            )

        # Check Docker
        docker_ok = self._check_docker(verbose)
        if not docker_ok:
            all_ok = False
            if fail_fast:
                sys.exit(1)

        # Summary
        self.stdout.write("=" * 40)
        if all_ok:
            self.stdout.write(self.style.SUCCESS("All required dependencies OK"))
            sys.exit(0)
        else:
            self.stdout.write(self.style.ERROR("Some dependencies failed"))
            sys.exit(1)

    def _check_database(self, verbose: bool) -> bool:
        """Check database connectivity."""
        self.stdout.write("\nDatabase:")
        try:
            # Try to execute a simple query
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()

            # Get database name (safe info)
            db_name = settings.DATABASES["default"].get("NAME", "unknown")
            db_engine = settings.DATABASES["default"].get("ENGINE", "unknown")

            # Sanitize engine name for display
            engine_short = db_engine.split(".")[-1] if db_engine else "unknown"

            self.stdout.write(self.style.SUCCESS(f"  [OK] Connected"))
            if verbose:
                self.stdout.write(f"       Engine: {engine_short}")
                self.stdout.write(f"       Database: {db_name}")
            return True
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  [FAIL] Cannot connect to database"))
            if verbose:
                # Don't leak connection details, just error type
                self.stdout.write(f"       Error type: {type(e).__name__}")
            return False

    def _check_redis(self, verbose: bool) -> bool:
        """Check Redis connectivity."""
        self.stdout.write("\nRedis:")

        # Get Redis URL (don't display it - may contain password)
        broker_url = getattr(settings, "CELERY_BROKER_URL", None)
        if not broker_url:
            self.stdout.write(self.style.WARNING("  [SKIP] CELERY_BROKER_URL not configured"))
            return True  # Not a failure if not configured

        try:
            import redis

            # Parse URL safely without exposing credentials
            from urllib.parse import urlparse
            parsed = urlparse(broker_url)
            host = parsed.hostname or "localhost"
            port = parsed.port or 6379

            client = redis.Redis.from_url(broker_url, socket_timeout=5)
            client.ping()

            self.stdout.write(self.style.SUCCESS(f"  [OK] Connected"))
            if verbose:
                self.stdout.write(f"       Host: {host}:{port}")
            return True
        except ImportError:
            self.stdout.write(self.style.WARNING("  [SKIP] redis package not installed"))
            return True
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  [FAIL] Cannot connect to Redis"))
            if verbose:
                self.stdout.write(f"       Error type: {type(e).__name__}")
            return False

    def _check_docker(self, verbose: bool) -> bool:
        """Check Docker connectivity."""
        self.stdout.write("\nDocker:")

        docker_host = getattr(settings, "DOCKER_HOST", None)
        if not docker_host:
            self.stdout.write(self.style.WARNING("  [SKIP] DOCKER_HOST not configured"))
            return True

        try:
            from apps.docker_manager.services import DockerService

            service = DockerService()
            version_info = service.get_version()

            # Only display safe version info
            version = version_info.get("version", "unknown")
            api_version = version_info.get("apiVersion", "unknown")

            self.stdout.write(self.style.SUCCESS(f"  [OK] Connected"))
            if verbose:
                # Sanitize DOCKER_HOST for display
                if docker_host.startswith("unix://"):
                    display_host = "unix socket"
                elif docker_host.startswith("tcp://"):
                    # Don't show full TCP URL, just indicate it's TCP
                    display_host = "tcp connection"
                else:
                    display_host = "configured"

                self.stdout.write(f"       Connection: {display_host}")
                self.stdout.write(f"       Version: {version}")
                self.stdout.write(f"       API Version: {api_version}")
            return True
        except ImportError:
            self.stdout.write(self.style.WARNING("  [SKIP] docker package not installed"))
            return True
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  [FAIL] Cannot connect to Docker"))
            if verbose:
                self.stdout.write(f"       Error type: {type(e).__name__}")
            return False
