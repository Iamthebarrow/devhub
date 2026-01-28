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

// Container port schema
export const ContainerPortSchema = z.object({
  ip: z.string().optional(),
  private_port: z.number(),
  public_port: z.number().optional(),
  type: z.string(),
})

// Container summary schema
export const DockerContainerSummarySchema = z.object({
  id: z.string(),
  names: z.array(z.string()),
  image: z.string(),
  image_id: z.string(),
  command: z.string(),
  created: z.number(),
  ports: z.array(ContainerPortSchema),
  labels: z.record(z.string(), z.string()),
  state: z.string(),
  status: z.string(),
  host_config: z.object({
    network_mode: z.string(),
  }),
  network_settings: z.object({
    networks: z.record(
      z.string(),
      z.object({
        network_id: z.string(),
        endpoint_id: z.string(),
        gateway: z.string(),
        ip_address: z.string(),
        ip_prefix_len: z.number(),
        mac_address: z.string(),
      })
    ),
  }),
  mounts: z.array(
    z.object({
      type: z.string(),
      name: z.string().optional(),
      source: z.string(),
      destination: z.string(),
      driver: z.string().optional(),
      mode: z.string(),
      rw: z.boolean(),
    })
  ),
})

// Paginated containers list schema
export const ContainersListSchema = z.object({
  results: z.array(DockerContainerSummarySchema),
  count: z.number(),
})

// =============================================================================
// Container Detail Schemas (Phase 4)
// =============================================================================

// Container detail is same as summary (reuse the schema)
export const DockerContainerDetailSchema = DockerContainerSummarySchema

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

export const DockerImageSummarySchema = z.object({
  id: z.string(),
  repo_tags: z.array(z.string()),
  repo_digests: z.array(z.string()),
  parent_id: z.string(),
  size: z.number(),
  virtual_size: z.number(),
  shared_size: z.number(),
  labels: z.record(z.string(), z.string()).nullable(),
  containers: z.number(),
  created: z.number(),
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

export const DockerVolumeSchema = z.object({
  name: z.string(),
  driver: z.string(),
  mountpoint: z.string(),
  created_at: z.string(),
  status: z.record(z.string(), z.string()).optional(),
  labels: z.record(z.string(), z.string()).nullable(),
  scope: z.string(),
  options: z.record(z.string(), z.string()).nullable(),
  usage_data: z
    .object({
      size: z.number(),
      ref_count: z.number(),
    })
    .optional(),
})

export const VolumesListResponseSchema = z.object({
  volumes: z.array(DockerVolumeSchema),
  warnings: z.array(z.string()).optional(),
})

// =============================================================================
// Network Schemas (Phase 5)
// =============================================================================

export const DockerNetworkSchema = z.object({
  id: z.string(),
  name: z.string(),
  driver: z.string(),
  scope: z.string(),
  created: z.string(),
  internal: z.boolean(),
  attachable: z.boolean(),
  ingress: z.boolean(),
  ipam: z.object({
    driver: z.string(),
    config: z.array(
      z.object({
        subnet: z.string().optional(),
        gateway: z.string().optional(),
        ip_range: z.string().optional(),
      })
    ),
  }),
  enable_ipv6: z.boolean(),
  containers: z.record(
    z.string(),
    z.object({
      name: z.string(),
      endpoint_id: z.string(),
      mac_address: z.string(),
      ipv4_address: z.string(),
      ipv6_address: z.string(),
    })
  ),
  options: z.record(z.string(), z.string()),
  labels: z.record(z.string(), z.string()),
})

export const NetworksListSchema = z.object({
  results: z.array(DockerNetworkSchema),
  count: z.number(),
})

// =============================================================================
// Audit Schemas (Phase 5)
// =============================================================================

export const AuditEventSchema = z.object({
  id: z.number(),
  timestamp: z.string(),
  actor: z.string(),
  action: z.string(),
  resource: z.string(),
  status: z.enum(['success', 'failed']),
  details: z.record(z.string(), z.unknown()).optional(),
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
