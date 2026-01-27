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
export const DockerSystemInfoSchema = z.object({
  containers: z.number(),
  containers_running: z.number(),
  containers_paused: z.number(),
  containers_stopped: z.number(),
  images: z.number(),
  driver: z.string(),
  kernel_version: z.string(),
  operating_system: z.string(),
  os_type: z.string(),
  architecture: z.string(),
  ncpu: z.number(),
  mem_total: z.number(),
  docker_root_dir: z.string(),
  name: z.string(),
  server_version: z.string(),
  // Optional fields with defaults
  memory_limit: z.boolean().optional(),
  swap_limit: z.boolean().optional(),
  kernel_memory: z.boolean().optional(),
  cpu_cfs_period: z.boolean().optional(),
  cpu_cfs_quota: z.boolean().optional(),
  cpu_shares: z.boolean().optional(),
  cpu_set: z.boolean().optional(),
  ipv4_forwarding: z.boolean().optional(),
  bridge_nf_iptables: z.boolean().optional(),
  bridge_nf_ip6tables: z.boolean().optional(),
  oom_kill_disable: z.boolean().optional(),
  logging_driver: z.string().optional(),
  cgroup_driver: z.string().optional(),
  n_events_listener: z.number().optional(),
  labels: z.array(z.string()).optional(),
  experimental_build: z.boolean().optional(),
})

// Docker version schema
export const DockerSystemVersionSchema = z.object({
  platform: z.object({
    name: z.string(),
  }),
  components: z
    .array(
      z.object({
        name: z.string(),
        version: z.string(),
        details: z.record(z.string(), z.string()).optional(),
      })
    )
    .optional(),
  version: z.string(),
  api_version: z.string(),
  min_api_version: z.string().optional(),
  git_commit: z.string().optional(),
  go_version: z.string().optional(),
  os: z.string(),
  arch: z.string(),
  kernel_version: z.string().optional(),
  build_time: z.string().optional(),
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
