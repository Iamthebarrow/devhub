/**
 * API types placeholder.
 * Phase 1: Empty file with structure comments.
 * Future phases will add types matching backend schema.
 */

// =============================================================================
// Auth Types (Phase 2)
// =============================================================================

export interface User {
  id: number
  username: string
  email?: string
  roles: string[]
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  access: string
  user: User
}

export interface RefreshResponse {
  access: string
}

// =============================================================================
// Docker Types (Phase 3+)
// =============================================================================

// Generic paginated result type
export interface PagedResult<T> {
  results: T[]
  count: number
}

// Docker system info from /docker/system/info/
// Uses camelCase to match backend serializers
export interface DockerSystemInfo {
  containers: number
  containersRunning: number
  containersPaused: number
  containersStopped: number
  images: number
  name: string
  operatingSystem?: string
  osType?: string
  architecture?: string
  ncpu?: number
  memTotal?: number
  serverVersion?: string
  id?: string
}

// Docker version info from /docker/system/version/
// Uses camelCase to match backend serializers
export interface DockerSystemVersion {
  version?: string
  apiVersion?: string
  gitCommit?: string
  goVersion?: string
  os?: string
  arch?: string
}

// Container port mapping
export interface ContainerPort {
  ip?: string
  private_port: number
  public_port?: number
  type: string
}

// Container summary from /docker/containers/
export interface DockerContainerSummary {
  id: string
  names: string[]
  image: string
  image_id: string
  command: string
  created: number // Unix timestamp
  ports: ContainerPort[]
  labels: Record<string, string>
  state: string
  status: string
  host_config: {
    network_mode: string
  }
  network_settings: {
    networks: Record<
      string,
      {
        network_id: string
        endpoint_id: string
        gateway: string
        ip_address: string
        ip_prefix_len: number
        mac_address: string
      }
    >
  }
  mounts: Array<{
    type: string
    name?: string
    source: string
    destination: string
    driver?: string
    mode: string
    rw: boolean
  }>
}

// =============================================================================
// Container Detail Types (Phase 4)
// =============================================================================

// Full container detail from /docker/containers/{id}/
// This is the same as DockerContainerSummary but aliased for clarity
export type DockerContainerDetail = DockerContainerSummary

// Container logs response
// DEFAULT DECISION: Backend returns { logs: string }
// If backend returns plain string, adapter in api/docker.ts handles it
export interface ContainerLogsResponse {
  logs: string
}

// Container logs request params
export interface ContainerLogsParams {
  tail?: number
  since?: string
}

// Container action response (start/stop/restart)
export interface ContainerActionResponse {
  message: string
}

// Legacy container type for compatibility
export interface Container {
  id: string
  name: string
  image: string
  status: string
  state: string
  created: string
}

// =============================================================================
// Image Types (Phase 5)
// =============================================================================

/**
 * Docker image summary from /docker/images/
 */
export interface DockerImageSummary {
  id: string
  repo_tags: string[]
  repo_digests: string[]
  parent_id: string
  size: number
  virtual_size: number
  shared_size: number
  labels: Record<string, string> | null
  containers: number
  created: number // Unix timestamp
}

/**
 * Pull image request
 */
export interface PullImageRequest {
  image: string
}

/**
 * Queued task response for async operations (pull/remove)
 * DEFAULT DECISION: Backend returns { status: "queued", task_id?: string }
 */
export interface QueuedTaskResponse {
  status: 'queued' | 'completed' | 'failed'
  task_id?: string
  message?: string
}

// =============================================================================
// Volume Types (Phase 5)
// =============================================================================

/**
 * Docker volume from /docker/volumes/
 */
export interface DockerVolume {
  name: string
  driver: string
  mountpoint: string
  created_at: string
  status?: Record<string, string>
  labels: Record<string, string> | null
  scope: string
  options: Record<string, string> | null
  usage_data?: {
    size: number
    ref_count: number
  }
}

/**
 * Volumes list response
 */
export interface VolumesListResponse {
  volumes: DockerVolume[]
  warnings?: string[]
}

// =============================================================================
// Network Types (Phase 5)
// =============================================================================

/**
 * Docker network from /docker/networks/
 */
export interface DockerNetwork {
  id: string
  name: string
  driver: string
  scope: string
  created: string
  internal: boolean
  attachable: boolean
  ingress: boolean
  ipam: {
    driver: string
    config: Array<{
      subnet?: string
      gateway?: string
      ip_range?: string
    }>
  }
  enable_ipv6: boolean
  containers: Record<
    string,
    {
      name: string
      endpoint_id: string
      mac_address: string
      ipv4_address: string
      ipv6_address: string
    }
  >
  options: Record<string, string>
  labels: Record<string, string>
}

// =============================================================================
// Audit Types (Phase 5)
// =============================================================================

/**
 * Audit event from /api/v1/audit/events/
 */
export interface AuditEvent {
  id: number
  timestamp: string
  actor: string
  action: string
  resource: string
  status: 'success' | 'failed'
  details?: Record<string, unknown>
}

/**
 * Audit events list params
 */
export interface AuditEventsParams {
  action?: string
  status?: string
  actor?: string
  from?: string
  to?: string
}

/**
 * Audit events list response
 */
export interface AuditEventsResponse {
  results: AuditEvent[]
  count: number
}

// Legacy types for compatibility (Phase 1)
export interface Image {
  id: string
  name: string
  tag: string
  size: number
  created: string
}

export interface Volume {
  name: string
  driver: string
  mountpoint: string
  created: string
}

export interface Network {
  id: string
  name: string
  driver: string
  scope: string
}

// =============================================================================
// API Error Types
// =============================================================================

export interface ApiError {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}
