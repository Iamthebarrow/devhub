"""
Core API views for health and version endpoints.
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema


@extend_schema(
    summary="Health check",
    description="Returns the health status of the API.",
    responses={200: {"type": "object", "properties": {"status": {"type": "string"}}}},
    tags=["System"],
)
@api_view(["GET"])
@permission_classes([AllowAny])
def health(request: Request) -> Response:
    """
    Health check endpoint.

    Returns {"status": "ok"} if the API is running.
    """
    return Response({"status": "ok"}, status=status.HTTP_200_OK)


@extend_schema(
    summary="API version",
    description="Returns the name and version of the API.",
    responses={
        200: {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "api": {"type": "string"},
            },
        }
    },
    tags=["System"],
)
@api_view(["GET"])
@permission_classes([AllowAny])
def version(request: Request) -> Response:
    """
    Version endpoint.

    Returns the API name and version.
    """
    return Response({"name": "devhub", "api": "v1"}, status=status.HTTP_200_OK)
