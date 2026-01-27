/**
 * Docker API module.
 *
 * Phase 3: System info and containers list (read-only).
 * Phase 4: Container detail, logs, and lifecycle actions.
 */

import { apiClient } from './client'
import {
  DockerSystemInfoSchema,
  DockerSystemVersionSchema,
  ContainersListSchema,
  DockerContainerDetailSchema,
  ContainerLogsResponseSchema,
  ContainerActionResponseSchema,
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
 * DEFAULT DECISION: Expects { logs: string } from backend.
 * Falls back to plain string if backend returns text directly.
 */
export async function getContainerLogs(
  id: string,
  params?: ContainerLogsParams
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

  const data = await apiClient.get<unknown>(endpoint)

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
