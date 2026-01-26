"""
DockerService - Abstraction layer for safe Docker engine access.

This service provides a controlled interface to the Docker engine,
returning only sanitized subsets of information. It never exposes
raw Docker API data, secrets, or sensitive host paths.

Supports both:
- Direct socket access: unix:///var/run/docker.sock
- Socket proxy (recommended): tcp://docker-socket-proxy:2375
"""

from typing import Any

import docker
from docker.errors import DockerException, NotFound

from .exceptions import (
    ContainerNotFoundError,
    ContainerOperationError,
    DockerConnectionError,
    DockerServiceError,
    ImageNotFoundError,
    ImageOperationError,
    InvalidImageNameError,
)


# Fields to include in system info response (sanitized subset)
SYSTEM_INFO_ALLOWED_FIELDS = {
    "ID": "id",
    "Name": "name",
    "OperatingSystem": "operatingSystem",
    "OSType": "osType",
    "Architecture": "architecture",
    "ServerVersion": "serverVersion",
    "Containers": "containers",
    "ContainersRunning": "containersRunning",
    "ContainersPaused": "containersPaused",
    "ContainersStopped": "containersStopped",
    "Images": "images",
    "MemTotal": "memTotal",
    "NCPU": "ncpu",
}

# Fields to include in version response (sanitized subset)
VERSION_ALLOWED_FIELDS = {
    "Version": "version",
    "ApiVersion": "apiVersion",
    "GitCommit": "gitCommit",
    "GoVersion": "goVersion",
    "Os": "os",
    "Arch": "arch",
}

# Label prefixes that may contain secrets (will be excluded)
SECRET_LABEL_PREFIXES = (
    "password",
    "secret",
    "token",
    "key",
    "credential",
    "auth",
    "api_key",
    "apikey",
)


def _is_secret_label(key: str) -> bool:
    """Check if a label key might contain secrets."""
    key_lower = key.lower()
    return any(prefix in key_lower for prefix in SECRET_LABEL_PREFIXES)


def _sanitize_labels(labels: dict | None) -> dict:
    """Remove potentially secret labels."""
    if not labels:
        return {}
    return {k: v for k, v in labels.items() if not _is_secret_label(k)}


def _parse_port_bindings(ports: dict | None) -> list[dict]:
    """
    Parse Docker port bindings to a safe format.

    Args:
        ports: Docker SDK port bindings dict.

    Returns:
        List of safe port binding dicts.
    """
    if not ports:
        return []

    result = []
    for container_port, host_bindings in ports.items():
        # container_port format: "80/tcp" or "443/udp"
        port_parts = container_port.split("/")
        port_num = port_parts[0]
        protocol = port_parts[1] if len(port_parts) > 1 else "tcp"

        if host_bindings:
            for binding in host_bindings:
                result.append({
                    "containerPort": int(port_num),
                    "hostPort": int(binding.get("HostPort", 0)) if binding.get("HostPort") else None,
                    "hostIp": binding.get("HostIp", ""),
                    "protocol": protocol,
                })
        else:
            result.append({
                "containerPort": int(port_num),
                "hostPort": None,
                "hostIp": "",
                "protocol": protocol,
            })

    return result


def _sanitize_mounts(mounts: list | None) -> list[dict]:
    """
    Sanitize mount information - only include target and read-only flag.

    Does NOT include source paths to avoid exposing host filesystem structure.
    """
    if not mounts:
        return []

    result = []
    for mount in mounts:
        result.append({
            "target": mount.get("Destination", ""),
            "type": mount.get("Type", ""),
            "readOnly": not mount.get("RW", True),
        })
    return result


def _sanitize_networks(networks: dict | None) -> list[dict]:
    """
    Sanitize network information for container.
    """
    if not networks:
        return []

    result = []
    for name, config in networks.items():
        result.append({
            "name": name,
            "ipAddress": config.get("IPAddress", ""),
        })
    return result


class DockerService:
    """
    Service for interacting with Docker engine safely.

    This service wraps the Docker SDK and provides:
    - Safe-by-design API (only returns sanitized data)
    - Consistent error handling
    - Support for both socket and proxy access modes
    """

    def __init__(
        self,
        docker_host: str | None = None,
        tls_verify: bool = False,
        cert_path: str | None = None,
    ):
        """
        Initialize DockerService.

        Args:
            docker_host: Docker host URL. Can be:
                - unix:///var/run/docker.sock (direct socket)
                - tcp://docker-socket-proxy:2375 (via proxy)
                If None, uses DOCKER_HOST from environment/settings.
            tls_verify: Whether to verify TLS certificates.
            cert_path: Path to TLS certificates (if tls_verify=True).
        """
        self._docker_host = docker_host
        self._tls_verify = tls_verify
        self._cert_path = cert_path
        self._client: docker.DockerClient | None = None

    def _get_client(self) -> docker.DockerClient:
        """
        Get or create Docker client.

        Raises:
            DockerConnectionError: If unable to connect to Docker engine.
        """
        if self._client is not None:
            return self._client

        try:
            kwargs: dict[str, Any] = {}

            if self._docker_host:
                kwargs["base_url"] = self._docker_host

            if self._tls_verify and self._cert_path:
                tls_config = docker.tls.TLSConfig(
                    client_cert=(
                        f"{self._cert_path}/cert.pem",
                        f"{self._cert_path}/key.pem",
                    ),
                    ca_cert=f"{self._cert_path}/ca.pem",
                    verify=True,
                )
                kwargs["tls"] = tls_config

            self._client = docker.DockerClient(**kwargs)

            # Test connection with a ping
            self._client.ping()

            return self._client

        except DockerException as e:
            raise DockerConnectionError(
                f"Unable to connect to Docker engine: {e}"
            ) from e
        except Exception as e:
            raise DockerConnectionError(
                f"Unexpected error connecting to Docker: {e}"
            ) from e

    def get_system_info(self) -> dict[str, Any]:
        """
        Get sanitized Docker system information.

        Returns only safe fields, never exposing:
        - Host paths
        - Environment variables
        - Security options
        - Network details

        Returns:
            Dict with sanitized system info fields.

        Raises:
            DockerConnectionError: If Docker engine is unreachable.
            DockerServiceError: For other Docker-related errors.
        """
        try:
            client = self._get_client()
            raw_info = client.info()

            # Extract only allowed fields
            sanitized = {}
            for docker_key, api_key in SYSTEM_INFO_ALLOWED_FIELDS.items():
                if docker_key in raw_info:
                    sanitized[api_key] = raw_info[docker_key]

            return sanitized

        except DockerConnectionError:
            raise
        except DockerException as e:
            raise DockerServiceError(f"Failed to get system info: {e}") from e
        except Exception as e:
            raise DockerServiceError(f"Unexpected error: {e}") from e

    def get_version(self) -> dict[str, Any]:
        """
        Get sanitized Docker version information.

        Returns only safe fields (version, API version, etc.).

        Returns:
            Dict with sanitized version info fields.

        Raises:
            DockerConnectionError: If Docker engine is unreachable.
            DockerServiceError: For other Docker-related errors.
        """
        try:
            client = self._get_client()
            raw_version = client.version()

            # Extract only allowed fields
            sanitized = {}
            for docker_key, api_key in VERSION_ALLOWED_FIELDS.items():
                if docker_key in raw_version:
                    sanitized[api_key] = raw_version[docker_key]

            return sanitized

        except DockerConnectionError:
            raise
        except DockerException as e:
            raise DockerServiceError(f"Failed to get version: {e}") from e
        except Exception as e:
            raise DockerServiceError(f"Unexpected error: {e}") from e

    def is_available(self) -> bool:
        """
        Check if Docker engine is available.

        Returns:
            True if Docker is reachable, False otherwise.
        """
        try:
            client = self._get_client()
            client.ping()
            return True
        except (DockerConnectionError, DockerServiceError):
            return False

    # =========================================================================
    # Container Methods (Phase 4)
    # =========================================================================

    def list_containers(
        self,
        status: str | None = None,
        search: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        List containers with optional filtering.

        Args:
            status: Filter by status ('running', 'exited', 'paused', or None for all).
            search: Search string to match against name, image, or ID.

        Returns:
            List of sanitized container dicts.

        Raises:
            DockerConnectionError: If Docker engine is unreachable.
            DockerServiceError: For other Docker-related errors.
        """
        try:
            client = self._get_client()

            # Build filters
            filters = {}
            if status and status != "all":
                filters["status"] = status

            # Get all containers (including stopped)
            containers = client.containers.list(all=True, filters=filters if filters else None)

            result = []
            for container in containers:
                sanitized = self._sanitize_container_summary(container)

                # Apply search filter (client-side)
                if search:
                    search_lower = search.lower()
                    name = sanitized.get("name", "").lower()
                    image = sanitized.get("image", "").lower()
                    container_id = sanitized.get("id", "").lower()

                    if not (search_lower in name or search_lower in image or search_lower in container_id):
                        continue

                result.append(sanitized)

            return result

        except DockerConnectionError:
            raise
        except DockerException as e:
            raise DockerServiceError(f"Failed to list containers: {e}") from e
        except Exception as e:
            raise DockerServiceError(f"Unexpected error: {e}") from e

    def get_container(self, container_id: str) -> dict[str, Any]:
        """
        Get detailed information about a specific container.

        Args:
            container_id: Container ID or name.

        Returns:
            Sanitized container detail dict.

        Raises:
            ContainerNotFoundError: If container doesn't exist.
            DockerConnectionError: If Docker engine is unreachable.
            DockerServiceError: For other Docker-related errors.
        """
        try:
            client = self._get_client()
            container = client.containers.get(container_id)
            return self._sanitize_container_detail(container)

        except NotFound:
            raise ContainerNotFoundError(container_id)
        except DockerConnectionError:
            raise
        except DockerException as e:
            raise DockerServiceError(f"Failed to get container: {e}") from e
        except Exception as e:
            raise DockerServiceError(f"Unexpected error: {e}") from e

    def get_container_logs(
        self,
        container_id: str,
        tail: int = 200,
        since: str | None = None,
    ) -> str:
        """
        Get container logs.

        Args:
            container_id: Container ID or name.
            tail: Number of lines to return (DEFAULT: 200, MAX from settings).
            since: Return logs since this timestamp (ISO format or Unix timestamp).

        Returns:
            Log output as string (truncated to max size from settings).

        Raises:
            ContainerNotFoundError: If container doesn't exist.
            DockerConnectionError: If Docker engine is unreachable.
            DockerServiceError: For other Docker-related errors.
        """
        from django.conf import settings

        max_tail = getattr(settings, "CONTAINER_LOGS_MAX_TAIL", 2000)
        max_size = getattr(settings, "CONTAINER_LOGS_MAX_SIZE", 64 * 1024)

        # Enforce max tail
        tail = min(tail, max_tail)

        try:
            client = self._get_client()
            container = client.containers.get(container_id)

            # Build logs kwargs
            kwargs: dict[str, Any] = {
                "stdout": True,
                "stderr": True,
                "tail": tail,
                "timestamps": True,
            }

            if since:
                kwargs["since"] = since

            logs = container.logs(**kwargs)

            # Decode if bytes
            if isinstance(logs, bytes):
                logs = logs.decode("utf-8", errors="replace")

            # Truncate to max size
            if len(logs) > max_size:
                logs = logs[:max_size] + "\n... [TRUNCATED]"

            return logs

        except NotFound:
            raise ContainerNotFoundError(container_id)
        except DockerConnectionError:
            raise
        except DockerException as e:
            raise DockerServiceError(f"Failed to get container logs: {e}") from e
        except Exception as e:
            raise DockerServiceError(f"Unexpected error: {e}") from e

    def start_container(self, container_id: str) -> None:
        """
        Start a container. Idempotent - returns success if already running.

        Args:
            container_id: Container ID or name.

        Raises:
            ContainerNotFoundError: If container doesn't exist.
            ContainerOperationError: If start operation fails.
            DockerConnectionError: If Docker engine is unreachable.
        """
        try:
            client = self._get_client()
            container = client.containers.get(container_id)

            # Idempotent: if already running, return success
            if container.status == "running":
                return

            container.start()

        except NotFound:
            raise ContainerNotFoundError(container_id)
        except DockerConnectionError:
            raise
        except DockerException as e:
            raise ContainerOperationError("start", container_id, str(e)) from e
        except Exception as e:
            raise ContainerOperationError("start", container_id, str(e)) from e

    def stop_container(self, container_id: str, timeout: int = 10) -> None:
        """
        Stop a container. Idempotent - returns success if already stopped.

        Args:
            container_id: Container ID or name.
            timeout: Seconds to wait before killing (default 10).

        Raises:
            ContainerNotFoundError: If container doesn't exist.
            ContainerOperationError: If stop operation fails.
            DockerConnectionError: If Docker engine is unreachable.
        """
        try:
            client = self._get_client()
            container = client.containers.get(container_id)

            # Idempotent: if already stopped/exited, return success
            if container.status in ("exited", "created", "dead"):
                return

            container.stop(timeout=timeout)

        except NotFound:
            raise ContainerNotFoundError(container_id)
        except DockerConnectionError:
            raise
        except DockerException as e:
            raise ContainerOperationError("stop", container_id, str(e)) from e
        except Exception as e:
            raise ContainerOperationError("stop", container_id, str(e)) from e

    def restart_container(self, container_id: str, timeout: int = 10) -> None:
        """
        Restart a container.

        Args:
            container_id: Container ID or name.
            timeout: Seconds to wait for stop before killing (default 10).

        Raises:
            ContainerNotFoundError: If container doesn't exist.
            ContainerOperationError: If restart operation fails.
            DockerConnectionError: If Docker engine is unreachable.
        """
        try:
            client = self._get_client()
            container = client.containers.get(container_id)
            container.restart(timeout=timeout)

        except NotFound:
            raise ContainerNotFoundError(container_id)
        except DockerConnectionError:
            raise
        except DockerException as e:
            raise ContainerOperationError("restart", container_id, str(e)) from e
        except Exception as e:
            raise ContainerOperationError("restart", container_id, str(e)) from e

    def _sanitize_container_summary(self, container) -> dict[str, Any]:
        """
        Sanitize container for list response.

        Returns safe subset of container fields.
        """
        attrs = container.attrs

        # Get image name safely
        image = attrs.get("Image", "")
        if attrs.get("Config", {}).get("Image"):
            image = attrs["Config"]["Image"]

        # Get container name (strip leading /)
        name = attrs.get("Name", "")
        if name.startswith("/"):
            name = name[1:]
        # For list view, names might be in a list
        if not name and attrs.get("Names"):
            names = attrs["Names"]
            name = names[0] if names else ""
            if name.startswith("/"):
                name = name[1:]

        return {
            "id": container.short_id,
            "name": name,
            "image": image,
            "state": attrs.get("State", {}).get("Status", container.status) if isinstance(attrs.get("State"), dict) else container.status,
            "status": attrs.get("Status", ""),
            "created": attrs.get("Created", ""),
            "ports": _parse_port_bindings(attrs.get("NetworkSettings", {}).get("Ports")),
            "labels": _sanitize_labels(attrs.get("Labels")),
        }

    def _sanitize_container_detail(self, container) -> dict[str, Any]:
        """
        Sanitize container for detail response.

        Returns more detailed but still safe container fields.
        """
        attrs = container.attrs

        # Start with summary fields
        result = self._sanitize_container_summary(container)

        # Add detail-specific fields
        result["fullId"] = container.id

        # Add mounts (sanitized - no source paths)
        result["mounts"] = _sanitize_mounts(attrs.get("Mounts"))

        # Add networks summary
        networks = attrs.get("NetworkSettings", {}).get("Networks")
        result["networks"] = _sanitize_networks(networks)

        # Add restart policy
        host_config = attrs.get("HostConfig", {})
        restart_policy = host_config.get("RestartPolicy", {})
        result["restartPolicy"] = {
            "name": restart_policy.get("Name", ""),
            "maximumRetryCount": restart_policy.get("MaximumRetryCount", 0),
        }

        return result

    # =========================================================================
    # Image Methods (Phase 5)
    # =========================================================================

    def list_images(self) -> list[dict[str, Any]]:
        """
        List Docker images.

        Returns:
            List of sanitized image dicts.

        Raises:
            DockerConnectionError: If Docker engine is unreachable.
            DockerServiceError: For other Docker-related errors.
        """
        try:
            client = self._get_client()
            images = client.images.list()

            result = []
            for image in images:
                result.append(self._sanitize_image(image))

            return result

        except DockerConnectionError:
            raise
        except DockerException as e:
            raise DockerServiceError(f"Failed to list images: {e}") from e
        except Exception as e:
            raise DockerServiceError(f"Unexpected error: {e}") from e

    def pull_image(self, image: str) -> dict[str, Any]:
        """
        Pull a Docker image.

        Args:
            image: Image name with optional tag (e.g., "nginx:latest").

        Returns:
            Sanitized image info dict on success.

        Raises:
            InvalidImageNameError: If image name fails validation.
            ImageOperationError: If pull operation fails.
            DockerConnectionError: If Docker engine is unreachable.
        """
        # Validate image name
        self._validate_image_name(image)

        try:
            client = self._get_client()

            # Pull the image (this may take a while)
            pulled_image = client.images.pull(image)

            return self._sanitize_image(pulled_image)

        except DockerConnectionError:
            raise
        except DockerException as e:
            raise ImageOperationError("pull", image, str(e)) from e
        except InvalidImageNameError:
            raise
        except Exception as e:
            raise ImageOperationError("pull", image, str(e)) from e

    def remove_image(self, image_id: str, force: bool = False) -> None:
        """
        Remove a Docker image.

        Args:
            image_id: Image ID or name:tag.
            force: Force removal even if image is in use.

        Raises:
            ImageNotFoundError: If image doesn't exist.
            ImageOperationError: If remove operation fails.
            DockerConnectionError: If Docker engine is unreachable.
        """
        try:
            client = self._get_client()
            client.images.remove(image_id, force=force)

        except NotFound:
            raise ImageNotFoundError(image_id)
        except DockerConnectionError:
            raise
        except DockerException as e:
            raise ImageOperationError("remove", image_id, str(e)) from e
        except Exception as e:
            raise ImageOperationError("remove", image_id, str(e)) from e

    def _validate_image_name(self, image: str) -> None:
        """
        Validate image name against allowed pattern.

        Args:
            image: Image name to validate.

        Raises:
            InvalidImageNameError: If image name is invalid.
        """
        from django.conf import settings

        max_length = getattr(settings, "IMAGE_NAME_MAX_LENGTH", 200)
        pattern = getattr(settings, "IMAGE_NAME_PATTERN", None)

        if not image:
            raise InvalidImageNameError(image, "Image name cannot be empty")

        if len(image) > max_length:
            raise InvalidImageNameError(
                image, f"Image name exceeds maximum length of {max_length}"
            )

        if pattern and not pattern.match(image):
            raise InvalidImageNameError(
                image, "Image name contains invalid characters"
            )

    def _sanitize_image(self, image) -> dict[str, Any]:
        """
        Sanitize image for API response.

        Returns safe subset of image fields.
        """
        attrs = image.attrs

        # Get tags safely
        tags = image.tags or []

        # Get size
        size = attrs.get("Size", 0)

        # Get creation date
        created = attrs.get("Created", "")

        return {
            "id": image.short_id.replace("sha256:", ""),
            "fullId": image.id,
            "tags": tags,
            "size": size,
            "created": created,
            "labels": _sanitize_labels(attrs.get("Labels")),
        }

    # =========================================================================
    # Volume Methods (Phase 5)
    # =========================================================================

    def list_volumes(self) -> list[dict[str, Any]]:
        """
        List Docker volumes.

        Returns:
            List of sanitized volume dicts (no host paths exposed).

        Raises:
            DockerConnectionError: If Docker engine is unreachable.
            DockerServiceError: For other Docker-related errors.
        """
        try:
            client = self._get_client()
            volumes = client.volumes.list()

            result = []
            for volume in volumes:
                result.append(self._sanitize_volume(volume))

            return result

        except DockerConnectionError:
            raise
        except DockerException as e:
            raise DockerServiceError(f"Failed to list volumes: {e}") from e
        except Exception as e:
            raise DockerServiceError(f"Unexpected error: {e}") from e

    def _sanitize_volume(self, volume) -> dict[str, Any]:
        """
        Sanitize volume for API response.

        Does NOT include mountpoint to avoid exposing host filesystem paths.
        """
        attrs = volume.attrs

        return {
            "name": volume.name,
            "driver": attrs.get("Driver", ""),
            "scope": attrs.get("Scope", ""),
            "created": attrs.get("CreatedAt", ""),
            "labels": _sanitize_labels(attrs.get("Labels")),
        }

    # =========================================================================
    # Network Methods (Phase 5)
    # =========================================================================

    def list_networks(self) -> list[dict[str, Any]]:
        """
        List Docker networks.

        Returns:
            List of sanitized network dicts.

        Raises:
            DockerConnectionError: If Docker engine is unreachable.
            DockerServiceError: For other Docker-related errors.
        """
        try:
            client = self._get_client()
            networks = client.networks.list()

            result = []
            for network in networks:
                result.append(self._sanitize_network(network))

            return result

        except DockerConnectionError:
            raise
        except DockerException as e:
            raise DockerServiceError(f"Failed to list networks: {e}") from e
        except Exception as e:
            raise DockerServiceError(f"Unexpected error: {e}") from e

    def _sanitize_network(self, network) -> dict[str, Any]:
        """
        Sanitize network for API response.
        """
        attrs = network.attrs

        # Get IPAM config safely (just subnet info, not gateway)
        ipam = attrs.get("IPAM", {})
        ipam_config = ipam.get("Config", [])
        subnets = [cfg.get("Subnet", "") for cfg in ipam_config if cfg.get("Subnet")]

        return {
            "id": network.short_id,
            "name": network.name,
            "driver": attrs.get("Driver", ""),
            "scope": attrs.get("Scope", ""),
            "internal": attrs.get("Internal", False),
            "subnets": subnets,
            "labels": _sanitize_labels(attrs.get("Labels")),
        }

    def close(self) -> None:
        """Close the Docker client connection."""
        if self._client is not None:
            self._client.close()
            self._client = None


def get_docker_service() -> DockerService:
    """
    Factory function to get a DockerService instance configured from settings.

    Returns:
        DockerService instance configured with Django settings.
    """
    from django.conf import settings

    return DockerService(
        docker_host=getattr(settings, "DOCKER_HOST", None),
        tls_verify=getattr(settings, "DOCKER_TLS_VERIFY", False),
        cert_path=getattr(settings, "DOCKER_CERT_PATH", None) or None,
    )
