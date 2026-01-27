/**
 * Docker query hooks using TanStack Query.
 *
 * Phase 3: Read-only hooks for system info and containers list.
 * Phase 4: Container detail, logs, and action mutations.
 * Phase 5: Images, volumes, networks.
 * Phase 6: StaleTime tuning and abort controller support.
 *
 * DEFAULT: StaleTime values:
 * - System info: 15s (updates regularly)
 * - System version: 5 minutes (rarely changes)
 * - Containers list: 5s (changes frequently)
 * - Container detail: 5s
 * - Logs: 3s (when polling) - polling only when auto-refresh enabled
 * - Images: 30s
 * - Volumes/Networks: 60s (rarely change)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSystemInfo,
  getSystemVersion,
  listContainers,
  getContainer,
  getContainerLogs,
  startContainer,
  stopContainer,
  restartContainer,
  // Phase 5
  listImages,
  pullImage,
  removeImage,
  listVolumes,
  listNetworks,
} from '../../api/docker'
import type { ListContainersParams } from '../../api/docker'
import type { ContainerLogsParams } from '../../api/types'

// =============================================================================
// Query Keys
// =============================================================================

export const dockerKeys = {
  all: ['docker'] as const,
  system: () => [...dockerKeys.all, 'system'] as const,
  systemInfo: () => [...dockerKeys.system(), 'info'] as const,
  systemVersion: () => [...dockerKeys.system(), 'version'] as const,
  containers: () => [...dockerKeys.all, 'containers'] as const,
  containersList: (params?: ListContainersParams) =>
    [...dockerKeys.containers(), 'list', params ?? {}] as const,
  containerDetail: (id: string) => [...dockerKeys.containers(), 'detail', id] as const,
  containerLogs: (id: string, params?: ContainerLogsParams) =>
    [...dockerKeys.containers(), 'logs', id, params ?? {}] as const,
  // Phase 5
  images: () => [...dockerKeys.all, 'images'] as const,
  imagesList: () => [...dockerKeys.images(), 'list'] as const,
  volumes: () => [...dockerKeys.all, 'volumes'] as const,
  volumesList: () => [...dockerKeys.volumes(), 'list'] as const,
  networks: () => [...dockerKeys.all, 'networks'] as const,
  networksList: () => [...dockerKeys.networks(), 'list'] as const,
}

// =============================================================================
// System Hooks
// =============================================================================

/**
 * Hook to fetch Docker system info.
 * Used in DashboardPage for system stats.
 *
 * DEFAULT: staleTime 15s - system stats (containers running, images) can change
 */
export function useSystemInfo() {
  return useQuery({
    queryKey: dockerKeys.systemInfo(),
    queryFn: getSystemInfo,
    staleTime: 15_000, // DEFAULT: 15 seconds - system info updates regularly
  })
}

/**
 * Hook to fetch Docker version info.
 * Used in DashboardPage for version display.
 */
export function useSystemVersion() {
  return useQuery({
    queryKey: dockerKeys.systemVersion(),
    queryFn: getSystemVersion,
    staleTime: 5 * 60_000, // 5 minutes - version changes rarely
  })
}

// =============================================================================
// Containers Hooks
// =============================================================================

/**
 * Hook to fetch containers list with optional filters.
 * Used in ContainersPage for the table.
 *
 * DEFAULT: staleTime 5s - containers can start/stop frequently
 */
export function useContainers(params?: ListContainersParams) {
  return useQuery({
    queryKey: dockerKeys.containersList(params),
    queryFn: () => listContainers(params),
    staleTime: 5_000, // DEFAULT: 5 seconds - containers change frequently
  })
}

// =============================================================================
// Container Detail Hooks (Phase 4)
// =============================================================================

/**
 * Hook to fetch container detail by ID.
 * Used in ContainerDetailPage.
 *
 * DEFAULT: staleTime 5s - container state can change
 */
export function useContainer(id: string) {
  return useQuery({
    queryKey: dockerKeys.containerDetail(id),
    queryFn: () => getContainer(id),
    staleTime: 5_000, // DEFAULT: 5 seconds
    enabled: Boolean(id),
  })
}

/**
 * Hook to fetch container logs.
 * Supports polling via refetchInterval when autoRefresh is enabled.
 *
 * Phase 6: Uses abort signal for request cancellation on unmount.
 *
 * DEFAULT: tail=200, poll interval=3s when enabled, staleTime 3s
 */
export function useContainerLogs(
  id: string,
  params?: ContainerLogsParams,
  options?: { autoRefresh?: boolean }
) {
  return useQuery({
    queryKey: dockerKeys.containerLogs(id, params),
    // Pass signal for abort-on-unmount (Phase 6)
    queryFn: ({ signal }) => getContainerLogs(id, params, signal),
    staleTime: 3_000, // DEFAULT: 3 seconds for logs
    enabled: Boolean(id),
    // Poll every 3 seconds when auto-refresh is enabled
    // DEFAULT: Only poll when explicitly enabled to avoid over-polling
    refetchInterval: options?.autoRefresh ? 3_000 : false,
  })
}

// =============================================================================
// Container Action Mutations (Phase 4)
// =============================================================================

/**
 * Hook to start a container.
 * Invalidates container detail and list queries on success.
 */
export function useStartContainer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => startContainer(id),
    onSuccess: (_data, id) => {
      // Invalidate container detail and list queries
      queryClient.invalidateQueries({ queryKey: dockerKeys.containerDetail(id) })
      queryClient.invalidateQueries({ queryKey: dockerKeys.containers() })
      queryClient.invalidateQueries({ queryKey: dockerKeys.systemInfo() })
    },
  })
}

/**
 * Hook to stop a container.
 * Invalidates container detail and list queries on success.
 */
export function useStopContainer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => stopContainer(id),
    onSuccess: (_data, id) => {
      // Invalidate container detail and list queries
      queryClient.invalidateQueries({ queryKey: dockerKeys.containerDetail(id) })
      queryClient.invalidateQueries({ queryKey: dockerKeys.containers() })
      queryClient.invalidateQueries({ queryKey: dockerKeys.systemInfo() })
    },
  })
}

/**
 * Hook to restart a container.
 * Invalidates container detail and list queries on success.
 */
export function useRestartContainer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => restartContainer(id),
    onSuccess: (_data, id) => {
      // Invalidate container detail and list queries
      queryClient.invalidateQueries({ queryKey: dockerKeys.containerDetail(id) })
      queryClient.invalidateQueries({ queryKey: dockerKeys.containers() })
      queryClient.invalidateQueries({ queryKey: dockerKeys.systemInfo() })
    },
  })
}

// =============================================================================
// Images Hooks (Phase 5)
// =============================================================================

/**
 * Hook to fetch images list.
 * Used in ImagesPage.
 */
export function useImages() {
  return useQuery({
    queryKey: dockerKeys.imagesList(),
    queryFn: listImages,
    staleTime: 30_000, // 30 seconds - images change less frequently than containers
  })
}

/**
 * Hook to pull an image.
 * DEFAULT: Invalidates images query after 2s delay to allow backend to process.
 */
export function usePullImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (image: string) => pullImage(image),
    onSuccess: () => {
      // Invalidate images query after a short delay
      // DEFAULT DECISION: 2s delay for async pull operation
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: dockerKeys.images() })
        queryClient.invalidateQueries({ queryKey: dockerKeys.systemInfo() })
      }, 2000)
    },
  })
}

/**
 * Hook to remove an image.
 * Admin-only UI. Backend enforces role check.
 * DEFAULT: Invalidates images query after 2s delay.
 */
export function useRemoveImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => removeImage(id, force),
    onSuccess: () => {
      // Invalidate images query after a short delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: dockerKeys.images() })
        queryClient.invalidateQueries({ queryKey: dockerKeys.systemInfo() })
      }, 2000)
    },
  })
}

// =============================================================================
// Volumes Hooks (Phase 5)
// =============================================================================

/**
 * Hook to fetch volumes list.
 * Used in VolumesPage (read-only).
 */
export function useVolumes() {
  return useQuery({
    queryKey: dockerKeys.volumesList(),
    queryFn: listVolumes,
    staleTime: 60_000, // 1 minute - volumes change rarely
  })
}

// =============================================================================
// Networks Hooks (Phase 5)
// =============================================================================

/**
 * Hook to fetch networks list.
 * Used in NetworksPage (read-only).
 */
export function useNetworks() {
  return useQuery({
    queryKey: dockerKeys.networksList(),
    queryFn: listNetworks,
    staleTime: 60_000, // 1 minute - networks change rarely
  })
}
