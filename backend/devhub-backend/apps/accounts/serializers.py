"""
Serializers for accounts app authentication endpoints.
"""

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import serializers


class LoginSerializer(serializers.Serializer):
    """Serializer for login request."""

    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        username = attrs.get("username")
        password = attrs.get("password")

        # Pass request for django-axes login tracking
        request = self.context.get("request")
        user = authenticate(request=request, username=username, password=password)

        if not user:
            raise serializers.ValidationError(
                {"non_field_errors": ["Invalid credentials"]}
            )

        if not user.is_active:
            raise serializers.ValidationError(
                {"non_field_errors": ["Invalid credentials"]}
            )

        attrs["user"] = user
        return attrs


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user data in auth responses."""

    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "roles"]
        read_only_fields = fields

    def get_roles(self, obj) -> list[str]:
        """Return list of group names as roles."""
        return list(obj.groups.values_list("name", flat=True))


class LoginResponseSerializer(serializers.Serializer):
    """Serializer for login response (for OpenAPI docs)."""

    access = serializers.CharField()
    user = UserSerializer()


class RefreshResponseSerializer(serializers.Serializer):
    """Serializer for refresh response (for OpenAPI docs)."""

    access = serializers.CharField()


class LogoutResponseSerializer(serializers.Serializer):
    """Serializer for logout response (for OpenAPI docs)."""

    ok = serializers.BooleanField()


class AuthErrorSerializer(serializers.Serializer):
    """Serializer for auth error response (for OpenAPI docs)."""

    class ErrorDetail(serializers.Serializer):
        code = serializers.CharField()
        message = serializers.CharField()
        details = serializers.DictField(required=False)

    error = ErrorDetail()
