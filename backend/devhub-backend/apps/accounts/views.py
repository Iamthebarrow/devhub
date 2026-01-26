"""
Authentication views for DevHub.

Implements JWT authentication with refresh token stored in HttpOnly cookie.
"""

from django.conf import settings
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.throttles import LoginThrottle

from .serializers import (
    AuthErrorSerializer,
    LoginResponseSerializer,
    LoginSerializer,
    LogoutResponseSerializer,
    RefreshResponseSerializer,
    UserSerializer,
)


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Set the refresh token as an HttpOnly cookie."""
    response.set_cookie(
        key=settings.REFRESH_TOKEN_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.REFRESH_TOKEN_COOKIE_SECURE,
        samesite=settings.REFRESH_TOKEN_COOKIE_SAMESITE,
        path=settings.REFRESH_TOKEN_COOKIE_PATH,
        max_age=settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds(),
    )


def _clear_refresh_cookie(response: Response) -> None:
    """Clear the refresh token cookie."""
    response.delete_cookie(
        key=settings.REFRESH_TOKEN_COOKIE_NAME,
        path=settings.REFRESH_TOKEN_COOKIE_PATH,
        samesite=settings.REFRESH_TOKEN_COOKIE_SAMESITE,
    )


def _error_response(code: str, message: str, details: dict | None = None) -> dict:
    """Return a consistent error response format."""
    error = {"code": code, "message": message}
    if details:
        error["details"] = details
    return {"error": error}


@extend_schema_view(
    post=extend_schema(
        summary="Login",
        description="Authenticate user and return access token. "
        "Refresh token is set as HttpOnly cookie.",
        request=LoginSerializer,
        responses={
            200: LoginResponseSerializer,
            401: AuthErrorSerializer,
        },
        tags=["auth"],
    )
)
class LoginView(APIView):
    """
    Login endpoint.

    POST /api/v1/auth/login/
    - body: {"username": "...", "password": "..."}
    - returns: {"access": "<jwt>", "user": {...}}
    - sets refresh token as HttpOnly cookie

    Rate limited by:
    - LoginThrottle (scoped): DEFAULT 10/min
    - django-axes: lockout after 5 failed attempts within 15 minutes
    """

    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data)

        if not serializer.is_valid():
            # Return consistent error format without leaking info
            return Response(
                _error_response("auth_failed", "Invalid credentials"),
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user = serializer.validated_data["user"]

        # Generate tokens
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        # Build response with access token and user info
        user_data = UserSerializer(user).data
        response = Response(
            {"access": access_token, "user": user_data},
            status=status.HTTP_200_OK,
        )

        # Set refresh token as HttpOnly cookie (never in JSON)
        _set_refresh_cookie(response, refresh_token)

        return response


@extend_schema_view(
    post=extend_schema(
        summary="Refresh token",
        description="Get new access token using refresh token from cookie. "
        "Rotates the refresh token cookie.",
        responses={
            200: RefreshResponseSerializer,
            401: AuthErrorSerializer,
        },
        tags=["auth"],
    )
)
class RefreshView(APIView):
    """
    Refresh endpoint.

    POST /api/v1/auth/refresh/
    - uses refresh token from cookie
    - returns: {"access": "<jwt>"}
    - rotates refresh token cookie
    """

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        refresh_token = request.COOKIES.get(settings.REFRESH_TOKEN_COOKIE_NAME)

        if not refresh_token:
            return Response(
                _error_response("auth_failed", "No refresh token provided"),
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            refresh = RefreshToken(refresh_token)
            access_token = str(refresh.access_token)

            response = Response(
                {"access": access_token},
                status=status.HTTP_200_OK,
            )

            # Rotate refresh token (blacklist old, set new cookie)
            # This happens automatically due to ROTATE_REFRESH_TOKENS=True
            # and BLACKLIST_AFTER_ROTATION=True
            new_refresh_token = str(refresh)

            # If rotation is enabled, get the new token
            if settings.SIMPLE_JWT.get("ROTATE_REFRESH_TOKENS", False):
                # Blacklist the old token
                refresh.blacklist()
                # Generate new refresh token
                new_refresh = RefreshToken.for_user(refresh.access_token.payload)
                # Actually we need to get user from the token
                from django.contrib.auth.models import User

                user_id = refresh.access_token.payload.get("user_id")
                user = User.objects.get(id=user_id)
                new_refresh = RefreshToken.for_user(user)
                new_refresh_token = str(new_refresh)
                access_token = str(new_refresh.access_token)
                response = Response(
                    {"access": access_token},
                    status=status.HTTP_200_OK,
                )

            _set_refresh_cookie(response, new_refresh_token)

            return response

        except TokenError:
            return Response(
                _error_response("auth_failed", "Invalid or expired token"),
                status=status.HTTP_401_UNAUTHORIZED,
            )


@extend_schema_view(
    post=extend_schema(
        summary="Logout",
        description="Blacklist refresh token and clear cookie.",
        responses={
            200: LogoutResponseSerializer,
        },
        tags=["auth"],
    )
)
class LogoutView(APIView):
    """
    Logout endpoint.

    POST /api/v1/auth/logout/
    - blacklists current refresh token (if present)
    - clears refresh cookie
    - returns: {"ok": true}
    """

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        refresh_token = request.COOKIES.get(settings.REFRESH_TOKEN_COOKIE_NAME)

        response = Response({"ok": True}, status=status.HTTP_200_OK)

        if refresh_token:
            try:
                # Blacklist the refresh token
                token = RefreshToken(refresh_token)
                token.blacklist()
            except TokenError:
                # Token already invalid/blacklisted, that's fine
                pass

        # Always clear the cookie
        _clear_refresh_cookie(response)

        return response


@extend_schema_view(
    get=extend_schema(
        summary="Get current user",
        description="Returns the currently authenticated user's information.",
        responses={
            200: UserSerializer,
            401: AuthErrorSerializer,
        },
        tags=["auth"],
    )
)
class MeView(APIView):
    """
    Current user endpoint.

    GET /api/v1/auth/me/
    - requires authentication
    - returns: {"id": ..., "username": ..., "email": ..., "roles": [...]}
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)
