/**
 * Docker query hooks using TanStack Query.
 *
 * Phase 3: Read-only hooks for system info and containers list.
 * Phase 4: Container detail, logs, and action mutations.
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
}

// =============================================================================
// System Hooks
// =============================================================================

/**
 * Hook to fetch Docker system info.
 * Used in DashboardPage for system stats.
 */
export function useSystemInfo() {
  return useQuery({
    queryKey: dockerKeys.systemInfo(),
    queryFn: getSystemInfo,
    staleTime: 60_000, // 1 minute - system info doesn't change often
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
 */
export function useContainers(params?: ListContainersParams) {
  return useQuery({
    queryKey: dockerKeys.containersList(params),
    queryFn: () => listContainers(params),
    staleTime: 10_000, // 10 seconds - container list can change frequently
  })
}

// =============================================================================
// Container Detail Hooks (Phase 4)
// =============================================================================

/**
 * Hook to fetch container detail by ID.
 * Used in ContainerDetailPage.
 */
export function useContainer(id: string) {
  return useQuery({
    queryKey: dockerKeys.containerDetail(id),
    queryFn: () => getContainer(id),
    staleTime: 10_000, // 10 seconds
    enabled: Boolean(id),
  })
}

/**
 * Hook to fetch container logs.
 * Supports polling via refetchInterval when autoRefresh is enabled.
 *
 * DEFAULT: tail=200, poll interval=3s when enabled
 */
export function useContainerLogs(
  id: string,
  params?: ContainerLogsParams,
  options?: { autoRefresh?: boolean }
) {
  return useQuery({
    queryKey: dockerKeys.containerLogs(id, params),
    queryFn: () => getContainerLogs(id, params),
    staleTime: 5_000, // 5 seconds
    enabled: Boolean(id),
    // Poll every 3 seconds when auto-refresh is enabled
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
