export { apiClient, API_BASE_URL, AuthError, ApiRequestError } from './client'
export { login, refresh, logout, me, AuthApiError } from './auth'
export {
  getSystemInfo,
  getSystemVersion,
  listContainers,
  getContainer,
  getContainerLogs,
  startContainer,
  stopContainer,
  restartContainer,
  // Phase 5: Images
  listImages,
  pullImage,
  removeImage,
  // Phase 5: Volumes
  listVolumes,
  // Phase 5: Networks
  listNetworks,
  DockerApiError,
} from './docker'
export type { ListContainersParams } from './docker'
export { listAuditEvents, AuditApiError } from './audit'
export type * from './types'
export * from './zod'
