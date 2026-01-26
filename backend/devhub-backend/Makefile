.PHONY: dev test lint format migrate shell superuser bootstrap clean help ci schema-validate check coverage

# DEFAULT: Show help
help:
	@echo "DevHub Backend - Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development server with docker compose"
	@echo "  make shell        - Open Django shell"
	@echo "  make migrate      - Run Django migrations"
	@echo ""
	@echo "Testing & Quality:"
	@echo "  make test         - Run tests with pytest"
	@echo "  make coverage     - Run tests with coverage report"
	@echo "  make lint         - Run ruff linter"
	@echo "  make format       - Format code with ruff"
	@echo "  make ci           - Run full CI pipeline (lint + test + schema validate)"
	@echo ""
	@echo "Schema & Docs:"
	@echo "  make schema-validate  - Validate OpenAPI schema"
	@echo ""
	@echo "Admin & Bootstrap:"
	@echo "  make superuser    - Create Django superuser"
	@echo "  make bootstrap    - Bootstrap roles and create admin user"
	@echo "  make check        - Run devhub_check (dependency health)"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean        - Stop and remove docker containers"
	@echo "  make install-hooks - Install pre-commit hooks"
	@echo ""

# =============================================================================
# Development Commands
# =============================================================================

# Start development environment
dev:
	docker compose up --build

# Run migrations
migrate:
	docker compose exec backend python manage.py migrate

# Open Django shell
shell:
	docker compose exec backend python manage.py shell

# Create superuser
superuser:
	docker compose exec backend python manage.py createsuperuser

# Bootstrap roles and create admin user
bootstrap:
	docker compose exec backend python manage.py devhub_bootstrap_roles --create-admin

# Run devhub_check for dependency health
check:
	docker compose exec backend python manage.py devhub_check --verbose

# =============================================================================
# Testing & Quality Commands
# =============================================================================

# Run tests (uses SQLite in-memory, no Docker required)
test:
	pytest

# Run tests with coverage
coverage:
	pytest --cov=apps --cov-report=term-missing --cov-report=html

# Run linter
lint:
	ruff check .

# Format code
format:
	ruff check --fix .
	ruff format .

# Validate OpenAPI schema
schema-validate:
	python manage.py spectacular --validate --fail-on-warn

# Full CI pipeline
ci: lint test schema-validate
	@echo ""
	@echo "=========================================="
	@echo "CI Pipeline Complete - All checks passed!"
	@echo "=========================================="

# =============================================================================
# Cleanup Commands
# =============================================================================

# Stop and clean up
clean:
	docker compose down -v

# Install pre-commit hooks
install-hooks:
	pre-commit install
