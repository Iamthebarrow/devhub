/**
 * Docker API module.
 *
 * Phase 3: System info and containers list (read-only).
 * Phase 4: Container detail, logs, and lifecycle actions.
 * Phase 5: Images, volumes, networks.
 * Phase 6: Abort signal support for logs fetch cancellation.
 */

import { apiClient } from './client'
import {
  DockerSystemInfoSchema,
  DockerSystemVersionSchema,
  ContainersListSchema,
  DockerContainerDetailSchema,
  ContainerLogsResponseSchema,
  ContainerActionResponseSchema,
  ImagesListSchema,
  QueuedTaskResponseSchema,
  VolumesListResponseSchema,
  NetworksListSchema,
} from './zod'
import type {
  DockerSystemInfo,
  DockerSystemVersion,
  DockerContainerSummary,
  DockerContainerDetail,
  ContainerLogsResponse,
  ContainerLogsParams,
  ContainerActionResponse,
  PagedResult,
  DockerImageSummary,
  QueuedTaskResponse,
  VolumesListResponse,
  DockerNetwork,
} from './types'

// =============================================================================
// Error Classes
// =============================================================================

export class DockerApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'DockerApiError'
    this.status = status
    this.code = code
  }
}

// =============================================================================
// System Endpoints
// =============================================================================

/**
 * Get Docker system info.
 * GET /docker/system/info/
 */
export async function getSystemInfo(): Promise<DockerSystemInfo> {
  const data = await apiClient.get<unknown>('/docker/system/info/')

  const result = DockerSystemInfoSchema.safeParse(data)
  if (!result.success) {
    console.error('[Docker API] Invalid system info response:', result.error)
    throw new DockerApiError('Invalid system info response from server', 500, 'INVALID_RESPONSE')
  }

  return result.data as DockerSystemInfo
}

/**
 * Get Docker version info.
 * GET /docker/system/version/
 */
export async function getSystemVersion(): Promise<DockerSystemVersion> {
  const data = await apiClient.get<unknown>('/docker/system/version/')

  const result = DockerSystemVersionSchema.safeParse(data)
  if (!result.success) {
    console.error('[Docker API] Invalid system version response:', result.error)
    throw new DockerApiError('Invalid system version response from server', 500, 'INVALID_RESPONSE')
  }

  return result.data as DockerSystemVersion
}

// =============================================================================
// Containers Endpoints
// =============================================================================

export interface ListContainersParams {
  status?: string // 'running' | 'exited' | 'paused' | 'all'
  search?: string
}

/**
 * List Docker containers.
 * GET /docker/containers/?status=&search=
 */
export async function listContainers(
  params?: ListContainersParams
): Promise<PagedResult<DockerContainerSummary>> {
  // Build query string
  const searchParams = new URLSearchParams()
  if (params?.status && params.status !== 'all') {
    searchParams.set('status', params.status)
  }
  if (params?.search) {
    searchParams.set('search', params.search)
  }

  const queryString = searchParams.toString()
  const endpoint = `/docker/containers/${queryString ? `?${queryString}` : ''}`

  const data = await apiClient.get<unknown>(endpoint)

  const result = ContainersListSchema.safeParse(data)
  if (!result.success) {
    console.error('[Docker API] Invalid containers list response:', result.error)
    throw new DockerApiError('Invalid containers list response from server', 500, 'INVALID_RESPONSE')
  }

  return result.data as PagedResult<DockerContainerSummary>
}

// =============================================================================
// Container Detail Endpoints (Phase 4)
// =============================================================================

/**
 * Get container detail by ID.
 * GET /docker/containers/{id}/
 */
export async function getContainer(id: string): Promise<DockerContainerDetail> {
  const data = await apiClient.get<unknown>(`/docker/containers/${id}/`)

  const result = DockerContainerDetailSchema.safeParse(data)
  if (!result.success) {
    console.error('[Docker API] Invalid container detail response:', result.error)
    throw new DockerApiError('Invalid container detail response from server', 500, 'INVALID_RESPONSE')
  }

  return result.data as DockerContainerDetail
}

/**
 * Get container logs.
 * GET /docker/containers/{id}/logs/?tail=&since=
 *
 * Phase 6: Supports abort signal for request cancellation on unmount.
 *
 * DEFAULT DECISION: Expects { logs: string } from backend.
 * Falls back to plain string if backend returns text directly.
 */
export async function getContainerLogs(
  id: string,
  params?: ContainerLogsParams,
  signal?: AbortSignal
): Promise<ContainerLogsResponse> {
  const searchParams = new URLSearchParams()
  if (params?.tail) {
    searchParams.set('tail', params.tail.toString())
  }
  if (params?.since) {
    searchParams.set('since', params.since)
  }

  const queryString = searchParams.toString()
  const endpoint = `/docker/containers/${id}/logs/${queryString ? `?${queryString}` : ''}`

  const data = await apiClient.get<unknown>(endpoint, signal)

  // Handle both { logs: string } and plain string responses
  if (typeof data === 'string') {
    return { logs: data }
  }

  const result = ContainerLogsResponseSchema.safeParse(data)
  if (!result.success) {
    console.error('[Docker API] Invalid container logs response:', result.error)
    throw new DockerApiError('Invalid container logs response from server', 500, 'INVALID_RESPONSE')
  }

  return result.data as ContainerLogsResponse
}

// =============================================================================
// Container Actions (Phase 4)
// =============================================================================

/**
 * Start a container.
 * POST /docker/containers/{id}/start/
 */
export async function startContainer(id: string): Promise<ContainerActionResponse> {
  const data = await apiClient.post<unknown>(`/docker/containers/${id}/start/`)

  const result = ContainerActionResponseSchema.safeParse(data)
  if (!result.success) {
    // Return a generic success message if response doesn't match schema
    return { message: 'Container started successfully' }
  }

  return result.data as ContainerActionResponse
}

/**
 * Stop a container.
 * POST /docker/containers/{id}/stop/
 */
export async function stopContainer(id: string): Promise<ContainerActionResponse> {
  const data = await apiClient.post<unknown>(`/docker/containers/${id}/stop/`)

  const result = ContainerActionResponseSchema.safeParse(data)
  if (!result.success) {
    return { message: 'Container stopped successfully' }
  }

  return result.data as ContainerActionResponse
}

/**
 * Restart a container.
 * POST /docker/containers/{id}/restart/
 */
export async function restartContainer(id: string): Promise<ContainerActionResponse> {
  const data = await apiClient.post<unknown>(`/docker/containers/${id}/restart/`)

  const result = ContainerActionResponseSchema.safeParse(data)
  if (!result.success) {
    return { message: 'Container restarted successfully' }
  }

  return result.data as ContainerActionResponse
}

// =============================================================================
// Images Endpoints (Phase 5)
// =============================================================================

/**
 * List Docker images.
 * GET /docker/images/
 */
export async function listImages(): Promise<PagedResult<DockerImageSummary>> {
  const data = await apiClient.get<unknown>('/docker/images/')

  const result = ImagesListSchema.safeParse(data)
  if (!result.success) {
    console.error('[Docker API] Invalid images list response:', result.error)
    throw new DockerApiError('Invalid images list response from server', 500, 'INVALID_RESPONSE')
  }

  return result.data as PagedResult<DockerImageSummary>
}

/**
 * Pull a Docker image.
 * POST /docker/images/pull/
 *
 * DEFAULT DECISION: Backend returns { status: "queued", task_id?: string }
 * The pull operation runs asynchronously.
 */
export async function pullImage(image: string): Promise<QueuedTaskResponse> {
  const data = await apiClient.post<unknown>('/docker/images/pull/', { image })

  const result = QueuedTaskResponseSchema.safeParse(data)
  if (!result.success) {
    // Fallback: return generic queued response
    return { status: 'queued', message: 'Image pull queued' }
  }

  return result.data as QueuedTaskResponse
}

/**
 * Remove a Docker image.
 * POST /docker/images/{id}/remove/
 *
 * Admin-only UI. Backend enforces role check.
 * DEFAULT DECISION: Backend returns { status: "queued", task_id?: string }
 */
export async function removeImage(id: string, force?: boolean): Promise<QueuedTaskResponse> {
  const body = force ? { force: true } : {}
  const data = await apiClient.post<unknown>(`/docker/images/${id}/remove/`, body)

  const result = QueuedTaskResponseSchema.safeParse(data)
  if (!result.success) {
    // Fallback: return generic queued response
    return { status: 'queued', message: 'Image removal queued' }
  }

  return result.data as QueuedTaskResponse
}

// =============================================================================
// Volumes Endpoints (Phase 5)
// =============================================================================

/**
 * List Docker volumes.
 * GET /docker/volumes/
 */
export async function listVolumes(): Promise<VolumesListResponse> {
  const data = await apiClient.get<unknown>('/docker/volumes/')

  const result = VolumesListResponseSchema.safeParse(data)
  if (!result.success) {
    console.error('[Docker API] Invalid volumes list response:', result.error)
    throw new DockerApiError('Invalid volumes list response from server', 500, 'INVALID_RESPONSE')
  }

  return result.data as VolumesListResponse
}

// =============================================================================
// Networks Endpoints (Phase 5)
// =============================================================================

/**
 * List Docker networks.
 * GET /docker/networks/
 */
export async function listNetworks(): Promise<PagedResult<DockerNetwork>> {
  const data = await apiClient.get<unknown>('/docker/networks/')

  const result = NetworksListSchema.safeParse(data)
  if (!result.success) {
    console.error('[Docker API] Invalid networks list response:', result.error)
    throw new DockerApiError('Invalid networks list response from server', 500, 'INVALID_RESPONSE')
  }

  return result.data as PagedResult<DockerNetwork>
}
