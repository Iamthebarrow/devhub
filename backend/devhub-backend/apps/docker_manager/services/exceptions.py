"""
Custom exceptions for Docker service operations.
"""


class DockerServiceError(Exception):
    """Base exception for Docker service errors."""

    def __init__(self, message: str = "Docker service error"):
        self.message = message
        super().__init__(self.message)


class DockerConnectionError(DockerServiceError):
    """Raised when Docker engine is unreachable."""

    def __init__(self, message: str = "Unable to connect to Docker engine"):
        super().__init__(message)


class ContainerNotFoundError(DockerServiceError):
    """Raised when a container is not found."""

    def __init__(self, container_id: str):
        self.container_id = container_id
        super().__init__(f"Container not found: {container_id}")


class ContainerOperationError(DockerServiceError):
    """Raised when a container operation fails."""

    def __init__(self, operation: str, container_id: str, message: str = ""):
        self.operation = operation
        self.container_id = container_id
        detail = f": {message}" if message else ""
        super().__init__(f"Failed to {operation} container {container_id}{detail}")


# =============================================================================
# Image Exceptions (Phase 5)
# =============================================================================


class ImageNotFoundError(DockerServiceError):
    """Raised when an image is not found."""

    def __init__(self, image_id: str):
        self.image_id = image_id
        super().__init__(f"Image not found: {image_id}")


class ImageOperationError(DockerServiceError):
    """Raised when an image operation fails."""

    def __init__(self, operation: str, image: str, message: str = ""):
        self.operation = operation
        self.image = image
        detail = f": {message}" if message else ""
        super().__init__(f"Failed to {operation} image {image}{detail}")


class InvalidImageNameError(DockerServiceError):
    """Raised when an image name fails validation."""

    def __init__(self, image: str, reason: str = ""):
        self.image = image
        detail = f": {reason}" if reason else ""
        super().__init__(f"Invalid image name '{image}'{detail}")
