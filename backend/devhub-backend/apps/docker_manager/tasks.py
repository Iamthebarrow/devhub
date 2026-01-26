"""
Celery tasks for Docker operations.

Long-running operations (image pull, remove) run as background tasks.
All tasks create audit events for success/failure.
"""

import logging
import uuid

from celery import shared_task
from django.contrib.auth import get_user_model

from apps.audit.models import AuditEvent, AuditStatus

from .services import (
    DockerConnectionError,
    DockerServiceError,
    ImageNotFoundError,
    ImageOperationError,
    InvalidImageNameError,
)
from .services.docker_service import get_docker_service

logger = logging.getLogger(__name__)

User = get_user_model()


def _create_task_audit_event(
    user_id: int | None,
    action: str,
    resource_type: str,
    resource_id: str,
    resource_name: str = "",
    status: str = AuditStatus.SUCCESS,
    error_message: str | None = None,
    metadata: dict | None = None,
    task_id: str = "",
) -> AuditEvent:
    """
    Create an audit event from a Celery task (no request context).

    Args:
        user_id: ID of the user who triggered the task.
        action: Action performed (e.g., "image.pull").
        resource_type: Type of resource.
        resource_id: Docker resource ID.
        resource_name: Human-readable name.
        status: Success or error.
        error_message: Error message if failed.
        metadata: Additional metadata.
        task_id: Celery task ID for correlation.

    Returns:
        Created AuditEvent.
    """
    from django.conf import settings

    # Get user if provided
    actor = None
    if user_id:
        try:
            actor = User.objects.get(id=user_id)
        except User.DoesNotExist:
            logger.warning(f"User {user_id} not found for audit event")

    # Sanitize metadata
    safe_metadata = metadata or {}

    # Truncate error message
    max_error_size = getattr(settings, "AUDIT_ERROR_MESSAGE_MAX_SIZE", 4 * 1024)
    if error_message and len(error_message) > max_error_size:
        error_message = error_message[: max_error_size - 20] + "... [TRUNCATED]"

    # Use task_id as request_id for correlation
    request_id = task_id or str(uuid.uuid4())

    return AuditEvent.objects.create(
        actor=actor,
        ip_address="",  # No request in background task
        user_agent="celery-worker",
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        resource_name=resource_name[:255] if resource_name else "",
        request_id=request_id,
        status=status,
        error_message=error_message,
        metadata=safe_metadata,
    )


@shared_task(bind=True, max_retries=0)
def docker_pull_image(self, image: str, requested_by_user_id: int | None = None):
    """
    Pull a Docker image in the background.

    Args:
        image: Image name with optional tag (e.g., "nginx:latest").
        requested_by_user_id: ID of the user who requested the pull.

    Returns:
        Dict with pull result summary.
    """
    task_id = self.request.id or str(uuid.uuid4())
    logger.info(f"[{task_id}] Starting image pull: {image}")

    try:
        service = get_docker_service()
        result = service.pull_image(image)

        # Create success audit event
        _create_task_audit_event(
            user_id=requested_by_user_id,
            action="image.pull",
            resource_type="image",
            resource_id=result.get("id", image),
            resource_name=image,
            status=AuditStatus.SUCCESS,
            metadata={
                "image": image,
                "tags": result.get("tags", []),
                "size": result.get("size", 0),
            },
            task_id=task_id,
        )

        logger.info(f"[{task_id}] Image pull completed: {image}")
        return {
            "status": "success",
            "image": image,
            "id": result.get("id"),
            "tags": result.get("tags", []),
        }

    except InvalidImageNameError as e:
        error_msg = str(e)
        logger.warning(f"[{task_id}] Invalid image name: {error_msg}")

        _create_task_audit_event(
            user_id=requested_by_user_id,
            action="image.pull",
            resource_type="image",
            resource_id=image,
            resource_name=image,
            status=AuditStatus.ERROR,
            error_message=error_msg,
            metadata={"image": image},
            task_id=task_id,
        )

        return {"status": "error", "error": "invalid_image_name", "message": error_msg}

    except ImageOperationError as e:
        error_msg = str(e)
        logger.error(f"[{task_id}] Image pull failed: {error_msg}")

        _create_task_audit_event(
            user_id=requested_by_user_id,
            action="image.pull",
            resource_type="image",
            resource_id=image,
            resource_name=image,
            status=AuditStatus.ERROR,
            error_message=error_msg,
            metadata={"image": image},
            task_id=task_id,
        )

        return {"status": "error", "error": "pull_failed", "message": error_msg}

    except DockerConnectionError as e:
        error_msg = "Docker engine unavailable"
        logger.error(f"[{task_id}] Docker connection error: {e}")

        _create_task_audit_event(
            user_id=requested_by_user_id,
            action="image.pull",
            resource_type="image",
            resource_id=image,
            resource_name=image,
            status=AuditStatus.ERROR,
            error_message=error_msg,
            metadata={"image": image},
            task_id=task_id,
        )

        return {"status": "error", "error": "docker_unavailable", "message": error_msg}

    except Exception as e:
        error_msg = f"Unexpected error: {e}"
        logger.exception(f"[{task_id}] Unexpected error during image pull")

        _create_task_audit_event(
            user_id=requested_by_user_id,
            action="image.pull",
            resource_type="image",
            resource_id=image,
            resource_name=image,
            status=AuditStatus.ERROR,
            error_message=error_msg,
            metadata={"image": image},
            task_id=task_id,
        )

        return {"status": "error", "error": "unexpected_error", "message": error_msg}


@shared_task(bind=True, max_retries=0)
def docker_remove_image(
    self,
    image_id: str,
    requested_by_user_id: int | None = None,
    force: bool = False,
):
    """
    Remove a Docker image in the background.

    Args:
        image_id: Image ID or name:tag.
        requested_by_user_id: ID of the user who requested the removal.
        force: Force removal even if image is in use.

    Returns:
        Dict with removal result.
    """
    task_id = self.request.id or str(uuid.uuid4())
    logger.info(f"[{task_id}] Starting image removal: {image_id} (force={force})")

    try:
        service = get_docker_service()
        service.remove_image(image_id, force=force)

        # Create success audit event
        _create_task_audit_event(
            user_id=requested_by_user_id,
            action="image.remove",
            resource_type="image",
            resource_id=image_id,
            resource_name=image_id,
            status=AuditStatus.SUCCESS,
            metadata={"image_id": image_id, "force": force},
            task_id=task_id,
        )

        logger.info(f"[{task_id}] Image removal completed: {image_id}")
        return {"status": "success", "image_id": image_id}

    except ImageNotFoundError as e:
        error_msg = str(e)
        logger.warning(f"[{task_id}] Image not found: {error_msg}")

        _create_task_audit_event(
            user_id=requested_by_user_id,
            action="image.remove",
            resource_type="image",
            resource_id=image_id,
            resource_name=image_id,
            status=AuditStatus.ERROR,
            error_message=error_msg,
            metadata={"image_id": image_id, "force": force},
            task_id=task_id,
        )

        return {"status": "error", "error": "image_not_found", "message": error_msg}

    except ImageOperationError as e:
        error_msg = str(e)
        logger.error(f"[{task_id}] Image removal failed: {error_msg}")

        _create_task_audit_event(
            user_id=requested_by_user_id,
            action="image.remove",
            resource_type="image",
            resource_id=image_id,
            resource_name=image_id,
            status=AuditStatus.ERROR,
            error_message=error_msg,
            metadata={"image_id": image_id, "force": force},
            task_id=task_id,
        )

        return {"status": "error", "error": "remove_failed", "message": error_msg}

    except DockerConnectionError as e:
        error_msg = "Docker engine unavailable"
        logger.error(f"[{task_id}] Docker connection error: {e}")

        _create_task_audit_event(
            user_id=requested_by_user_id,
            action="image.remove",
            resource_type="image",
            resource_id=image_id,
            resource_name=image_id,
            status=AuditStatus.ERROR,
            error_message=error_msg,
            metadata={"image_id": image_id, "force": force},
            task_id=task_id,
        )

        return {"status": "error", "error": "docker_unavailable", "message": error_msg}

    except Exception as e:
        error_msg = f"Unexpected error: {e}"
        logger.exception(f"[{task_id}] Unexpected error during image removal")

        _create_task_audit_event(
            user_id=requested_by_user_id,
            action="image.remove",
            resource_type="image",
            resource_id=image_id,
            resource_name=image_id,
            status=AuditStatus.ERROR,
            error_message=error_msg,
            metadata={"image_id": image_id, "force": force},
            task_id=task_id,
        )

        return {"status": "error", "error": "unexpected_error", "message": error_msg}
