import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '../../api/client'

// Mock user data
export const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  roles: ['admin'],
}

// Mock Docker system info
export const mockSystemInfo = {
  containers: 5,
  containers_running: 3,
  containers_paused: 0,
  containers_stopped: 2,
  images: 15,
  driver: 'overlay2',
  memory_limit: true,
  swap_limit: true,
  kernel_memory: true,
  cpu_cfs_period: true,
  cpu_cfs_quota: true,
  cpu_shares: true,
  cpu_set: true,
  ipv4_forwarding: true,
  bridge_nf_iptables: true,
  bridge_nf_ip6tables: true,
  oom_kill_disable: true,
  logging_driver: 'json-file',
  cgroup_driver: 'systemd',
  n_events_listener: 0,
  kernel_version: '6.1.0-18-amd64',
  operating_system: 'Ubuntu 22.04.3 LTS',
  os_type: 'linux',
  architecture: 'x86_64',
  ncpu: 8,
  mem_total: 16777216000, // ~16GB
  docker_root_dir: '/var/lib/docker',
  name: 'docker-host',
  labels: [],
  experimental_build: false,
  server_version: '24.0.7',
}

// Mock Docker system version
export const mockSystemVersion = {
  platform: {
    name: 'Docker Engine - Community',
  },
  components: [
    {
      name: 'Engine',
      version: '24.0.7',
      details: {
        ApiVersion: '1.43',
        MinAPIVersion: '1.12',
        GitCommit: 'afdd53b',
        GoVersion: 'go1.21.3',
        Os: 'linux',
        Arch: 'amd64',
      },
    },
  ],
  version: '24.0.7',
  api_version: '1.43',
  min_api_version: '1.12',
  git_commit: 'afdd53b',
  go_version: 'go1.21.3',
  os: 'linux',
  arch: 'amd64',
  kernel_version: '6.1.0-18-amd64',
  build_time: '2023-10-26T09:08:02.000000000+00:00',
}

// Mock containers list
export const mockContainers = [
  {
    id: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
    names: ['/nginx-proxy'],
    image: 'nginx:latest',
    image_id: 'sha256:abc123',
    command: 'nginx -g "daemon off;"',
    created: Math.floor(Date.now() / 1000) - 86400 * 2, // 2 days ago
    ports: [
      { ip: '0.0.0.0', private_port: 80, public_port: 8080, type: 'tcp' },
      { ip: '0.0.0.0', private_port: 443, public_port: 8443, type: 'tcp' },
    ],
    labels: { 'com.example.env': 'production' },
    state: 'running',
    status: 'Up 2 days',
    host_config: { network_mode: 'bridge' },
    network_settings: {
      networks: {
        bridge: {
          network_id: 'net123',
          endpoint_id: 'ep123',
          gateway: '172.17.0.1',
          ip_address: '172.17.0.2',
          ip_prefix_len: 16,
          mac_address: '02:42:ac:11:00:02',
        },
      },
    },
    mounts: [],
  },
  {
    id: 'def456ghi789def456ghi789def456ghi789def456ghi789def456ghi789def4',
    names: ['/postgres-db'],
    image: 'postgres:15',
    image_id: 'sha256:def456',
    command: 'docker-entrypoint.sh postgres',
    created: Math.floor(Date.now() / 1000) - 3600 * 5, // 5 hours ago
    ports: [{ ip: '0.0.0.0', private_port: 5432, public_port: 5432, type: 'tcp' }],
    labels: { 'com.example.service': 'database' },
    state: 'running',
    status: 'Up 5 hours',
    host_config: { network_mode: 'bridge' },
    network_settings: {
      networks: {
        bridge: {
          network_id: 'net123',
          endpoint_id: 'ep456',
          gateway: '172.17.0.1',
          ip_address: '172.17.0.3',
          ip_prefix_len: 16,
          mac_address: '02:42:ac:11:00:03',
        },
      },
    },
    mounts: [
      {
        type: 'volume',
        name: 'postgres-data',
        source: '/var/lib/docker/volumes/postgres-data/_data',
        destination: '/var/lib/postgresql/data',
        driver: 'local',
        mode: 'rw',
        rw: true,
      },
    ],
  },
  {
    id: 'ghi789jkl012ghi789jkl012ghi789jkl012ghi789jkl012ghi789jkl012ghi7',
    names: ['/redis-cache'],
    image: 'redis:alpine',
    image_id: 'sha256:ghi789',
    command: 'redis-server',
    created: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    ports: [],
    labels: {},
    state: 'exited',
    status: 'Exited (0) 1 hour ago',
    host_config: { network_mode: 'bridge' },
    network_settings: {
      networks: {
        bridge: {
          network_id: 'net123',
          endpoint_id: '',
          gateway: '',
          ip_address: '',
          ip_prefix_len: 0,
          mac_address: '',
        },
      },
    },
    mounts: [],
  },
]

// Track request states for testing
export const requestTracker = {
  refreshCalled: 0,
  lastAuthHeader: null as string | null,
  reset() {
    this.refreshCalled = 0
    this.lastAuthHeader = null
  },
}

// Flag to control refresh behavior
export let shouldRefreshSucceed = true
export const setRefreshBehavior = (succeed: boolean) => {
  shouldRefreshSucceed = succeed
}

export const handlers = [
  // Login handler
  http.post(`${API_BASE_URL}/auth/login/`, async ({ request }) => {
    const body = (await request.json()) as { username: string; password: string }

    if (body.username === 'testuser' && body.password === 'password123') {
      return HttpResponse.json({
        access: 'mock-access-token',
        user: mockUser,
      })
    }

    return HttpResponse.json(
      {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
        },
      },
      { status: 401 }
    )
  }),

  // Refresh handler
  http.post(`${API_BASE_URL}/auth/refresh/`, () => {
    requestTracker.refreshCalled++

    if (shouldRefreshSucceed) {
      return HttpResponse.json({
        access: 'new-access-token',
      })
    }

    return HttpResponse.json(
      {
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token expired',
        },
      },
      { status: 401 }
    )
  }),

  // Logout handler
  http.post(`${API_BASE_URL}/auth/logout/`, () => {
    return HttpResponse.json({ message: 'Logged out' })
  }),

  // Me handler
  http.get(`${API_BASE_URL}/auth/me/`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    requestTracker.lastAuthHeader = authHeader

    if (authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(mockUser)
    }

    return HttpResponse.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      },
      { status: 401 }
    )
  }),

  // Protected endpoint for testing 401 retry
  http.get(`${API_BASE_URL}/test/protected`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    requestTracker.lastAuthHeader = authHeader

    if (authHeader === 'Bearer valid-token' || authHeader === 'Bearer new-access-token') {
      return HttpResponse.json({ data: 'protected data' })
    }

    return HttpResponse.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      },
      { status: 401 }
    )
  }),

  // ==========================================================================
  // Docker API Handlers (Phase 3)
  // ==========================================================================

  // Docker system info
  http.get(`${API_BASE_URL}/docker/system/info/`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }
    return HttpResponse.json(mockSystemInfo)
  }),

  // Docker system version
  http.get(`${API_BASE_URL}/docker/system/version/`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }
    return HttpResponse.json(mockSystemVersion)
  }),

  // Docker containers list
  http.get(`${API_BASE_URL}/docker/containers/`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const statusFilter = url.searchParams.get('status')
    const searchFilter = url.searchParams.get('search')

    let filteredContainers = [...mockContainers]

    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      filteredContainers = filteredContainers.filter(
        (c) => c.state.toLowerCase() === statusFilter.toLowerCase()
      )
    }

    // Apply search filter (by name or image)
    if (searchFilter) {
      const search = searchFilter.toLowerCase()
      filteredContainers = filteredContainers.filter(
        (c) =>
          c.names.some((n) => n.toLowerCase().includes(search)) ||
          c.image.toLowerCase().includes(search)
      )
    }

    return HttpResponse.json({
      results: filteredContainers,
      count: filteredContainers.length,
    })
  }),

  // ==========================================================================
  // Docker Container Detail & Actions (Phase 4)
  // ==========================================================================

  // Container detail by ID
  http.get(`${API_BASE_URL}/docker/containers/:id/`, ({ request, params }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const { id } = params
    const container = mockContainers.find((c) => c.id === id)

    if (!container) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Container not found' } },
        { status: 404 }
      )
    }

    return HttpResponse.json(container)
  }),

  // Container logs
  http.get(`${API_BASE_URL}/docker/containers/:id/logs/`, ({ request, params }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const { id } = params
    const container = mockContainers.find((c) => c.id === id)

    if (!container) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Container not found' } },
        { status: 404 }
      )
    }

    const url = new URL(request.url)
    const tail = url.searchParams.get('tail') || '200'

    // Generate mock logs based on container name
    const containerName = container.names[0].replace(/^\//, '')
    const mockLogLines = [
      `[${new Date().toISOString()}] ${containerName} started`,
      `[${new Date().toISOString()}] Initializing...`,
      `[${new Date().toISOString()}] Configuration loaded`,
      `[${new Date().toISOString()}] Service ready`,
      `[${new Date().toISOString()}] Listening on port ${container.ports[0]?.private_port || 8080}`,
    ]

    // Repeat lines to match tail count (simplified)
    const lines = []
    const numLines = Math.min(parseInt(tail, 10), 50) // Cap at 50 for testing
    for (let i = 0; i < numLines; i++) {
      lines.push(mockLogLines[i % mockLogLines.length])
    }

    return HttpResponse.json({ logs: lines.join('\n') })
  }),

  // Start container
  http.post(`${API_BASE_URL}/docker/containers/:id/start/`, ({ request, params }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const { id } = params
    const container = mockContainers.find((c) => c.id === id)

    if (!container) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Container not found' } },
        { status: 404 }
      )
    }

    // Update container state in mock data
    container.state = 'running'
    container.status = 'Up 1 second'

    return HttpResponse.json({ message: 'Container started successfully' })
  }),

  // Stop container
  http.post(`${API_BASE_URL}/docker/containers/:id/stop/`, ({ request, params }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const { id } = params
    const container = mockContainers.find((c) => c.id === id)

    if (!container) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Container not found' } },
        { status: 404 }
      )
    }

    // Update container state in mock data
    container.state = 'exited'
    container.status = 'Exited (0) 1 second ago'

    return HttpResponse.json({ message: 'Container stopped successfully' })
  }),

  // Restart container
  http.post(`${API_BASE_URL}/docker/containers/:id/restart/`, ({ request, params }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const { id } = params
    const container = mockContainers.find((c) => c.id === id)

    if (!container) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Container not found' } },
        { status: 404 }
      )
    }

    // Update container state in mock data
    container.state = 'running'
    container.status = 'Up 1 second'

    return HttpResponse.json({ message: 'Container restarted successfully' })
  }),

  // ==========================================================================
  // Docker Images API (Phase 5)
  // ==========================================================================

  // Images list
  http.get(`${API_BASE_URL}/docker/images/`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return HttpResponse.json({
      results: mockImages,
      count: mockImages.length,
    })
  }),

  // Pull image
  http.post(`${API_BASE_URL}/docker/images/pull/`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return HttpResponse.json({
      status: 'queued',
      task_id: 'pull-task-123',
      message: 'Image pull queued',
    })
  }),

  // Remove image
  http.post(`${API_BASE_URL}/docker/images/:id/remove/`, ({ request, params }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const { id } = params
    const imageIndex = mockImages.findIndex((img) => img.id === id)

    if (imageIndex === -1) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Image not found' } },
        { status: 404 }
      )
    }

    return HttpResponse.json({
      status: 'queued',
      task_id: 'remove-task-123',
      message: 'Image removal queued',
    })
  }),

  // ==========================================================================
  // Docker Volumes API (Phase 5)
  // ==========================================================================

  // Volumes list
  http.get(`${API_BASE_URL}/docker/volumes/`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return HttpResponse.json({
      volumes: mockVolumes,
      warnings: [],
    })
  }),

  // ==========================================================================
  // Docker Networks API (Phase 5)
  // ==========================================================================

  // Networks list
  http.get(`${API_BASE_URL}/docker/networks/`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return HttpResponse.json({
      results: mockNetworks,
      count: mockNetworks.length,
    })
  }),

  // ==========================================================================
  // Audit API (Phase 5)
  // ==========================================================================

  // Audit events list
  http.get(`${API_BASE_URL}/audit/events/`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return HttpResponse.json({
      results: mockAuditEvents,
      count: mockAuditEvents.length,
    })
  }),
]

// ==========================================================================
// Mock Data for Phase 5
// ==========================================================================

export const mockImages = [
  {
    id: 'sha256:abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
    repo_tags: ['nginx:latest'],
    repo_digests: ['nginx@sha256:abc123'],
    parent_id: '',
    size: 142000000, // ~142MB
    virtual_size: 142000000,
    shared_size: 0,
    labels: { maintainer: 'NGINX Docker Maintainers' },
    containers: 1,
    created: Math.floor(Date.now() / 1000) - 86400 * 14, // 2 weeks ago
  },
  {
    id: 'sha256:def456ghi789def456ghi789def456ghi789def456ghi789def456ghi789def4',
    repo_tags: ['postgres:15'],
    repo_digests: ['postgres@sha256:def456'],
    parent_id: '',
    size: 379000000, // ~379MB
    virtual_size: 379000000,
    shared_size: 0,
    labels: null,
    containers: 1,
    created: Math.floor(Date.now() / 1000) - 86400 * 30, // 1 month ago
  },
  {
    id: 'sha256:ghi789jkl012ghi789jkl012ghi789jkl012ghi789jkl012ghi789jkl012ghi7',
    repo_tags: ['redis:alpine'],
    repo_digests: ['redis@sha256:ghi789'],
    parent_id: '',
    size: 32000000, // ~32MB
    virtual_size: 32000000,
    shared_size: 0,
    labels: null,
    containers: 1,
    created: Math.floor(Date.now() / 1000) - 86400 * 21, // 3 weeks ago
  },
]

export const mockVolumes = [
  {
    name: 'postgres-data',
    driver: 'local',
    mountpoint: '/var/lib/docker/volumes/postgres-data/_data',
    created_at: '2024-01-10T10:00:00Z',
    status: {},
    labels: { 'com.example.service': 'database' },
    scope: 'local',
    options: null,
    usage_data: {
      size: 524288000, // ~500MB
      ref_count: 1,
    },
  },
  {
    name: 'redis-data',
    driver: 'local',
    mountpoint: '/var/lib/docker/volumes/redis-data/_data',
    created_at: '2024-01-12T14:30:00Z',
    status: {},
    labels: null,
    scope: 'local',
    options: null,
    usage_data: {
      size: 10485760, // ~10MB
      ref_count: 0,
    },
  },
  {
    name: 'app-uploads',
    driver: 'local',
    mountpoint: '/var/lib/docker/volumes/app-uploads/_data',
    created_at: '2024-01-15T09:15:00Z',
    status: {},
    labels: null,
    scope: 'local',
    options: null,
  },
]

export const mockNetworks = [
  {
    id: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
    name: 'bridge',
    driver: 'bridge',
    scope: 'local',
    created: '2024-01-01T00:00:00Z',
    internal: false,
    attachable: false,
    ingress: false,
    ipam: {
      driver: 'default',
      config: [{ subnet: '172.17.0.0/16', gateway: '172.17.0.1' }],
    },
    enable_ipv6: false,
    containers: {
      'abc123': {
        name: 'nginx-proxy',
        endpoint_id: 'ep123',
        mac_address: '02:42:ac:11:00:02',
        ipv4_address: '172.17.0.2/16',
        ipv6_address: '',
      },
    },
    options: { 'com.docker.network.bridge.default_bridge': 'true' },
    labels: {},
  },
  {
    id: 'def456ghi789def456ghi789def456ghi789def456ghi789def456ghi789def4',
    name: 'host',
    driver: 'host',
    scope: 'local',
    created: '2024-01-01T00:00:00Z',
    internal: false,
    attachable: false,
    ingress: false,
    ipam: {
      driver: 'default',
      config: [],
    },
    enable_ipv6: false,
    containers: {},
    options: {},
    labels: {},
  },
  {
    id: 'ghi789jkl012ghi789jkl012ghi789jkl012ghi789jkl012ghi789jkl012ghi7',
    name: 'devhub_network',
    driver: 'bridge',
    scope: 'local',
    created: '2024-01-05T12:00:00Z',
    internal: false,
    attachable: true,
    ingress: false,
    ipam: {
      driver: 'default',
      config: [{ subnet: '172.18.0.0/16', gateway: '172.18.0.1' }],
    },
    enable_ipv6: false,
    containers: {},
    options: {},
    labels: { 'com.docker.compose.project': 'devhub' },
  },
]

export const mockAuditEvents = [
  {
    id: 1,
    timestamp: '2024-01-20T14:32:15Z',
    actor: 'admin',
    action: 'container.start',
    resource: 'nginx-proxy',
    status: 'success' as const,
  },
  {
    id: 2,
    timestamp: '2024-01-20T14:30:00Z',
    actor: 'operator1',
    action: 'container.stop',
    resource: 'redis-cache',
    status: 'success' as const,
  },
  {
    id: 3,
    timestamp: '2024-01-20T14:25:30Z',
    actor: 'admin',
    action: 'image.pull',
    resource: 'nginx:latest',
    status: 'success' as const,
  },
  {
    id: 4,
    timestamp: '2024-01-20T14:20:00Z',
    actor: 'viewer1',
    action: 'container.view',
    resource: 'postgres-db',
    status: 'success' as const,
  },
  {
    id: 5,
    timestamp: '2024-01-20T14:15:00Z',
    actor: 'operator1',
    action: 'container.restart',
    resource: 'node-api',
    status: 'failed' as const,
  },
]
