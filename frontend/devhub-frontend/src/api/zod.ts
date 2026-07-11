import { z } from 'zod'

// =============================================================================
// Auth Schemas
// =============================================================================

export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().optional(),
  roles: z.array(z.string()),
})

export const LoginResponseSchema = z.object({
  access: z.string(),
  user: UserSchema,
})

export const RefreshResponseSchema = z.object({
  access: z.string(),
})

export const MeResponseSchema = UserSchema

// =============================================================================
// API Error Schema
// =============================================================================

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
})

// =============================================================================
// Docker Schemas (Phase 3)
// =============================================================================

// Docker system info schema - partial validation (only critical fields)
// Uses camelCase to match backend serializers
export const DockerSystemInfoSchema = z.object({
  containers: z.number(),
  containersRunning: z.number(),
  containersPaused: z.number(),
  containersStopped: z.number(),
  images: z.number(),
  name: z.string(),
  operatingSystem: z.string().optional(),
  osType: z.string().optional(),
  architecture: z.string().optional(),
  ncpu: z.number().optional(),
  memTotal: z.number().optional(),
  serverVersion: z.string().optional(),
  id: z.string().optional(),
})

// Docker version schema - uses camelCase to match backend serializers
export const DockerSystemVersionSchema = z.object({
  version: z.string().optional(),
  apiVersion: z.string().optional(),
  gitCommit: z.string().optional(),
  goVersion: z.string().optional(),
  os: z.string().optional(),
  arch: z.string().optional(),
})

// Container port schema - matches backend ContainerPortSerializer
export const ContainerPortSchema = z.object({
  containerPort: z.number(),
  hostPort: z.number().nullable().optional(),
  hostIp: z.string().optional(),
  protocol: z.string(),
})

// Container summary schema - matches backend ContainerSummarySerializer
export const DockerContainerSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string(),
  state: z.string(),
  status: z.string(),
  created: z.string(),
  ports: z.array(ContainerPortSchema),
  labels: z.record(z.string(), z.string()),
})

// Paginated containers list schema
export const ContainersListSchema = z.object({
  results: z.array(DockerContainerSummarySchema),
  count: z.number(),
})

// =============================================================================
// Container Detail Schemas (Phase 4)
// =============================================================================

// Container mount schema - matches backend ContainerMountSerializer
const ContainerMountSchema = z.object({
  target: z.string(),
  type: z.string(),
  readOnly: z.boolean(),
})

// Container network schema - matches backend ContainerNetworkSerializer
const ContainerNetworkSchema = z.object({
  name: z.string(),
  ipAddress: z.string(),
})

// Restart policy schema - matches backend RestartPolicySerializer
const RestartPolicySchema = z.object({
  name: z.string(),
  maximumRetryCount: z.number(),
})

// Container detail extends summary with additional fields - matches backend ContainerDetailSerializer
export const DockerContainerDetailSchema = DockerContainerSummarySchema.extend({
  fullId: z.string(),
  mounts: z.array(ContainerMountSchema),
  networks: z.array(ContainerNetworkSchema),
  restartPolicy: RestartPolicySchema,
})

// Container logs response schema
// DEFAULT DECISION: Backend returns { logs: string }
// The api/docker.ts adapter handles plain string response as fallback
export const ContainerLogsResponseSchema = z.object({
  logs: z.string(),
})

// Container action response schema
export const ContainerActionResponseSchema = z.object({
  message: z.string(),
})

// =============================================================================
// Image Schemas (Phase 5)
// =============================================================================

// Image summary schema - matches backend ImageSummarySerializer
export const DockerImageSummarySchema = z.object({
  id: z.string(),
  fullId: z.string(),
  tags: z.array(z.string()),
  size: z.number(),
  created: z.string(),
  labels: z.record(z.string(), z.string()).optional(),
})

export const ImagesListSchema = z.object({
  results: z.array(DockerImageSummarySchema),
  count: z.number(),
})

export const QueuedTaskResponseSchema = z.object({
  status: z.enum(['queued', 'completed', 'failed']),
  task_id: z.string().optional(),
  message: z.string().optional(),
})

// =============================================================================
// Volume Schemas (Phase 5)
// =============================================================================

// Volume summary schema - matches backend VolumeSummarySerializer
// Note: mountpoint is not exposed for security
export const DockerVolumeSchema = z.object({
  name: z.string(),
  driver: z.string(),
  scope: z.string(),
  created: z.string().optional(),
  labels: z.record(z.string(), z.string()).optional(),
})

// Volume list response - matches backend VolumeListResponseSerializer
export const VolumesListResponseSchema = z.object({
  results: z.array(DockerVolumeSchema),
  count: z.number(),
})

// =============================================================================
// Network Schemas (Phase 5)
// =============================================================================

// Network summary schema - matches backend NetworkSummarySerializer
export const DockerNetworkSchema = z.object({
  id: z.string(),
  name: z.string(),
  driver: z.string(),
  scope: z.string(),
  internal: z.boolean(),
  subnets: z.array(z.string()).optional(),
  labels: z.record(z.string(), z.string()).optional(),
})

export const NetworksListSchema = z.object({
  results: z.array(DockerNetworkSchema),
  count: z.number(),
})

// =============================================================================
// Audit Schemas (Phase 2 — Industry-standard MVP)
// =============================================================================

// Actor can be { id, username }, a bare string, or null
const AuditActorSchema = z.union([
  z.object({ id: z.number(), username: z.string() }),
  z.string(),
  z.null(),
])

export const AuditEventSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  actor: AuditActorSchema,
  ip_address: z.string().nullable().optional().default(null),
  user_agent: z.string().nullable().optional().default(null),
  action: z.string(),
  resource_type: z.string().default(''),
  resource_id: z.string().default(''),
  resource_name: z.string().nullable().optional().default(null),
  request_id: z.string().nullable().optional().default(null),
  status: z.enum(['success', 'error']),
  error_message: z.string().nullable().optional().default(null),
  metadata: z.record(z.string(), z.unknown()).nullable().optional().default(null),
})

export const AuditEventsResponseSchema = z.object({
  results: z.array(AuditEventSchema),
  count: z.number(),
})

// =============================================================================
// Type exports (inferred from schemas)
// =============================================================================

export type UserFromSchema = z.infer<typeof UserSchema>
export type LoginResponseFromSchema = z.infer<typeof LoginResponseSchema>
export type RefreshResponseFromSchema = z.infer<typeof RefreshResponseSchema>
export type MeResponseFromSchema = z.infer<typeof MeResponseSchema>
export type ApiErrorFromSchema = z.infer<typeof ApiErrorSchema>
export type DockerSystemInfoFromSchema = z.infer<typeof DockerSystemInfoSchema>
export type DockerSystemVersionFromSchema = z.infer<typeof DockerSystemVersionSchema>
export type DockerContainerSummaryFromSchema = z.infer<typeof DockerContainerSummarySchema>
export type ContainersListFromSchema = z.infer<typeof ContainersListSchema>
export type DockerContainerDetailFromSchema = z.infer<typeof DockerContainerDetailSchema>
export type ContainerLogsResponseFromSchema = z.infer<typeof ContainerLogsResponseSchema>
export type ContainerActionResponseFromSchema = z.infer<typeof ContainerActionResponseSchema>
export type DockerImageSummaryFromSchema = z.infer<typeof DockerImageSummarySchema>
export type ImagesListFromSchema = z.infer<typeof ImagesListSchema>
export type QueuedTaskResponseFromSchema = z.infer<typeof QueuedTaskResponseSchema>
export type DockerVolumeFromSchema = z.infer<typeof DockerVolumeSchema>
export type VolumesListResponseFromSchema = z.infer<typeof VolumesListResponseSchema>
export type DockerNetworkFromSchema = z.infer<typeof DockerNetworkSchema>
export type NetworksListFromSchema = z.infer<typeof NetworksListSchema>
export type AuditEventFromSchema = z.infer<typeof AuditEventSchema>
export type AuditEventsResponseFromSchema = z.infer<typeof AuditEventsResponseSchema>
