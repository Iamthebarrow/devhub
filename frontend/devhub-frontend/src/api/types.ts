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

// Container port mapping - matches backend ContainerPortSerializer
export interface ContainerPort {
  containerPort: number
  hostPort?: number | null
  hostIp?: string
  protocol: string
}

// Container summary from /docker/containers/ - matches backend ContainerSummarySerializer
export interface DockerContainerSummary {
  id: string
  name: string
  image: string
  state: string
  status: string
  created: string
  ports: ContainerPort[]
  labels: Record<string, string>
}

// =============================================================================
// Container Detail Types (Phase 4)
// =============================================================================

// Container mount - matches backend ContainerMountSerializer
export interface ContainerMount {
  target: string
  type: string
  readOnly: boolean
}

// Container network - matches backend ContainerNetworkSerializer
export interface ContainerNetwork {
  name: string
  ipAddress: string
}

// Restart policy - matches backend RestartPolicySerializer
export interface RestartPolicy {
  name: string
  maximumRetryCount: number
}

// Full container detail from /docker/containers/{id}/
// Extends summary with additional fields - matches backend ContainerDetailSerializer
export interface DockerContainerDetail extends DockerContainerSummary {
  fullId: string
  mounts: ContainerMount[]
  networks: ContainerNetwork[]
  restartPolicy: RestartPolicy
}

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
 * Matches backend ImageSummarySerializer
 */
export interface DockerImageSummary {
  id: string
  fullId: string
  tags: string[]
  size: number
  created: string
  labels?: Record<string, string>
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
 * Matches backend VolumeSummarySerializer
 * Note: mountpoint is not exposed for security reasons
 */
export interface DockerVolume {
  name: string
  driver: string
  scope: string
  created?: string
  labels?: Record<string, string>
}

/**
 * Volumes list response - matches backend VolumeListResponseSerializer
 */
export interface VolumesListResponse {
  results: DockerVolume[]
  count: number
}

// =============================================================================
// Network Types (Phase 5)
// =============================================================================

/**
 * Docker network from /docker/networks/
 * Matches backend NetworkSummarySerializer
 */
export interface DockerNetwork {
  id: string
  name: string
  driver: string
  scope: string
  internal: boolean
  subnets?: string[]
  labels?: Record<string, string>
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
