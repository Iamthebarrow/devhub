"""
Docker manager services package.

Provides DockerService abstraction for safe Docker engine access.
"""

from .docker_service import DockerService
from .exceptions import (
    ContainerNotFoundError,
    ContainerOperationError,
    DockerConnectionError,
    DockerServiceError,
    ImageNotFoundError,
    ImageOperationError,
    InvalidImageNameError,
)

__all__ = [
    "DockerService",
    "DockerServiceError",
    "DockerConnectionError",
    "ContainerNotFoundError",
    "ContainerOperationError",
    "ImageNotFoundError",
    "ImageOperationError",
    "InvalidImageNameError",
]
