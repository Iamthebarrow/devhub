"""
DRF permission classes for role-based access control.

Roles (implemented via Django Groups):
- admin: full access
- operator: can start/stop/restart, view logs, pull images
- viewer: read-only access

Hierarchy: admin > operator > viewer
"""

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

# Role hierarchy (higher index = higher privilege)
ROLE_HIERARCHY = ["viewer", "operator", "admin"]


def get_user_roles(user) -> list[str]:
    """Get list of role names for a user."""
    if not user or not user.is_authenticated:
        return []
    return list(user.groups.values_list("name", flat=True))


def has_role_or_higher(user, minimum_role: str) -> bool:
    """
    Check if user has at least the specified role level.

    Args:
        user: Django User instance
        minimum_role: The minimum required role ('viewer', 'operator', or 'admin')

    Returns:
        True if user has the minimum role or higher
    """
    if not user or not user.is_authenticated:
        return False

    # Superusers always have access
    if user.is_superuser:
        return True

    user_roles = get_user_roles(user)

    if not user_roles:
        return False

    try:
        min_level = ROLE_HIERARCHY.index(minimum_role)
    except ValueError:
        # Unknown role, deny access
        return False

    # Check if any of the user's roles meet the minimum level
    for role in user_roles:
        try:
            role_level = ROLE_HIERARCHY.index(role)
            if role_level >= min_level:
                return True
        except ValueError:
            # Unknown role in user's groups, skip
            continue

    return False


class IsAdmin(BasePermission):
    """
    Permission class requiring admin role.

    Allows access to users with 'admin' group membership or superusers.
    """

    message = "Admin access required."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return has_role_or_higher(request.user, "admin")


class IsOperatorOrHigher(BasePermission):
    """
    Permission class requiring operator role or higher.

    Allows access to users with 'operator' or 'admin' group membership,
    or superusers.
    """

    message = "Operator or admin access required."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return has_role_or_higher(request.user, "operator")


class IsViewerOrHigher(BasePermission):
    """
    Permission class requiring viewer role or higher.

    Allows access to any authenticated user with 'viewer', 'operator',
    or 'admin' group membership, or superusers.
    """

    message = "Authenticated user with at least viewer role required."

    def has_permission(self, request: Request, view: APIView) -> bool:
        return has_role_or_higher(request.user, "viewer")
