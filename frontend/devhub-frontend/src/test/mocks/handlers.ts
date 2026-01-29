import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '../../api/client'

// Mock user data
export const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  roles: ['admin'],
}

// Mock Docker system info - uses camelCase to match backend serializers
export const mockSystemInfo = {
  containers: 5,
  containersRunning: 3,
  containersPaused: 0,
  containersStopped: 2,
  images: 15,
  name: 'docker-host',
  operatingSystem: 'Ubuntu 22.04.3 LTS',
  osType: 'linux',
  architecture: 'x86_64',
  ncpu: 8,
  memTotal: 16777216000, // ~16GB
  serverVersion: '24.0.7',
  id: 'ABC123',
}

// Mock Docker system version - uses camelCase to match backend serializers
export const mockSystemVersion = {
  version: '24.0.7',
  apiVersion: '1.43',
  gitCommit: 'afdd53b',
  goVersion: 'go1.21.3',
  os: 'linux',
  arch: 'amd64',
}

// Mock containers list - matches backend ContainerSummarySerializer
export const mockContainers = [
  {
    id: 'abc123def456',
    name: 'nginx-proxy',
    image: 'nginx:latest',
    state: 'running',
    status: 'Up 2 days',
    created: new Date(Date.now() - 86400 * 2 * 1000).toISOString(),
    ports: [
      { containerPort: 80, hostPort: 8080, hostIp: '0.0.0.0', protocol: 'tcp' },
      { containerPort: 443, hostPort: 8443, hostIp: '0.0.0.0', protocol: 'tcp' },
    ],
    labels: { 'com.example.env': 'production' },
  },
  {
    id: 'def456ghi789',
    name: 'postgres-db',
    image: 'postgres:15',
    state: 'running',
    status: 'Up 5 hours',
    created: new Date(Date.now() - 3600 * 5 * 1000).toISOString(),
    ports: [{ containerPort: 5432, hostPort: 5432, hostIp: '0.0.0.0', protocol: 'tcp' }],
    labels: { 'com.example.service': 'database' },
  },
  {
    id: 'ghi789jkl012',
    name: 'redis-cache',
    image: 'redis:alpine',
    state: 'exited',
    status: 'Exited (0) 1 hour ago',
    created: new Date(Date.now() - 3600 * 1000).toISOString(),
    ports: [],
    labels: {},
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
          c.name.toLowerCase().includes(search) ||
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

  // Container detail by ID - returns extended format with mounts, networks, restartPolicy
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

    // Build container detail with extended fields
    const containerDetail = {
      ...container,
      fullId: container.id + '00000000000000000000000000000000000000000000',
      mounts: container.name === 'postgres-db'
        ? [{ target: '/var/lib/postgresql/data', type: 'volume', readOnly: false }]
        : [],
      networks: [{ name: 'bridge', ipAddress: '172.17.0.' + (mockContainers.indexOf(container) + 2) }],
      restartPolicy: { name: 'no', maximumRetryCount: 0 },
    }

    return HttpResponse.json(containerDetail)
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
    const containerName = container.name
    const mockLogLines = [
      `[${new Date().toISOString()}] ${containerName} started`,
      `[${new Date().toISOString()}] Initializing...`,
      `[${new Date().toISOString()}] Configuration loaded`,
      `[${new Date().toISOString()}] Service ready`,
      `[${new Date().toISOString()}] Listening on port ${container.ports[0]?.containerPort || 8080}`,
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
      results: mockVolumes,
      count: mockVolumes.length,
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

  // Audit events list (Phase 2 — supports pagination & filters)
  http.get(`${API_BASE_URL}/audit/events/`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const statusFilter = url.searchParams.get('status')
    const actionFilter = url.searchParams.get('action')
    const searchFilter = url.searchParams.get('search')
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const pageSize = parseInt(url.searchParams.get('page_size') || '25', 10)

    let filtered = [...mockAuditEvents]

    if (statusFilter) {
      filtered = filtered.filter((e) => e.status === statusFilter)
    }
    if (actionFilter) {
      filtered = filtered.filter((e) =>
        e.action.toLowerCase().includes(actionFilter.toLowerCase())
      )
    }
    if (searchFilter) {
      const s = searchFilter.toLowerCase()
      filtered = filtered.filter(
        (e) =>
          e.action.toLowerCase().includes(s) ||
          (e.resource_name ?? '').toLowerCase().includes(s) ||
          e.resource_type.toLowerCase().includes(s) ||
          (typeof e.actor === 'object' && e.actor !== null
            ? e.actor.username.toLowerCase().includes(s)
            : String(e.actor ?? '').toLowerCase().includes(s))
      )
    }

    const total = filtered.length
    const start = (page - 1) * pageSize
    const paged = filtered.slice(start, start + pageSize)

    return HttpResponse.json({
      results: paged,
      count: total,
    })
  }),
]

// ==========================================================================
// Mock Data for Phase 5
// ==========================================================================

// Mock images - matches backend ImageSummarySerializer
export const mockImages = [
  {
    id: 'sha256:abc123def456',
    fullId: 'sha256:abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
    tags: ['nginx:latest'],
    size: 142000000, // ~142MB
    created: new Date(Date.now() - 86400 * 14 * 1000).toISOString(), // 2 weeks ago
    labels: { maintainer: 'NGINX Docker Maintainers' },
  },
  {
    id: 'sha256:def456ghi789',
    fullId: 'sha256:def456ghi789def456ghi789def456ghi789def456ghi789def456ghi789def4',
    tags: ['postgres:15'],
    size: 379000000, // ~379MB
    created: new Date(Date.now() - 86400 * 30 * 1000).toISOString(), // 1 month ago
  },
  {
    id: 'sha256:ghi789jkl012',
    fullId: 'sha256:ghi789jkl012ghi789jkl012ghi789jkl012ghi789jkl012ghi789jkl012ghi7',
    tags: ['redis:alpine'],
    size: 32000000, // ~32MB
    created: new Date(Date.now() - 86400 * 21 * 1000).toISOString(), // 3 weeks ago
  },
]

// Mock volumes - matches backend VolumeSummarySerializer
// Note: mountpoint is not exposed for security reasons
export const mockVolumes = [
  {
    name: 'postgres-data',
    driver: 'local',
    scope: 'local',
    created: '2024-01-10T10:00:00Z',
    labels: { 'com.example.service': 'database' },
  },
  {
    name: 'redis-data',
    driver: 'local',
    scope: 'local',
    created: '2024-01-12T14:30:00Z',
  },
  {
    name: 'app-uploads',
    driver: 'local',
    scope: 'local',
    created: '2024-01-15T09:15:00Z',
  },
]

// Mock networks - matches backend NetworkSummarySerializer
export const mockNetworks = [
  {
    id: 'abc123def456',
    name: 'bridge',
    driver: 'bridge',
    scope: 'local',
    internal: false,
    subnets: ['172.17.0.0/16'],
    labels: {},
  },
  {
    id: 'def456ghi789',
    name: 'host',
    driver: 'host',
    scope: 'local',
    internal: false,
    subnets: [],
    labels: {},
  },
  {
    id: 'ghi789jkl012',
    name: 'devhub_network',
    driver: 'bridge',
    scope: 'local',
    internal: false,
    subnets: ['172.18.0.0/16'],
    labels: { 'com.docker.compose.project': 'devhub' },
  },
]

// Mock audit events — matches backend AuditEvent model (Phase 2)
export const mockAuditEvents = [
  {
    id: 'a1b2c3d4-0001-4000-8000-000000000001',
    created_at: '2024-01-20T14:32:15Z',
    actor: { id: 1, username: 'admin' },
    ip_address: '192.168.1.10',
    user_agent: 'Mozilla/5.0',
    action: 'container.start',
    resource_type: 'container',
    resource_id: 'abc123def456',
    resource_name: 'nginx-proxy',
    request_id: 'req-aaa-111',
    status: 'success' as const,
    error_message: null,
    metadata: { image: 'nginx:latest' },
  },
  {
    id: 'a1b2c3d4-0002-4000-8000-000000000002',
    created_at: '2024-01-20T14:30:00Z',
    actor: { id: 2, username: 'operator1' },
    ip_address: '10.0.0.5',
    user_agent: 'Mozilla/5.0',
    action: 'container.stop',
    resource_type: 'container',
    resource_id: 'ghi789jkl012',
    resource_name: 'redis-cache',
    request_id: 'req-bbb-222',
    status: 'success' as const,
    error_message: null,
    metadata: null,
  },
  {
    id: 'a1b2c3d4-0003-4000-8000-000000000003',
    created_at: '2024-01-20T14:25:30Z',
    actor: { id: 1, username: 'admin' },
    ip_address: '192.168.1.10',
    user_agent: 'Mozilla/5.0',
    action: 'image.pull',
    resource_type: 'image',
    resource_id: 'sha256:abc123def456',
    resource_name: 'nginx:latest',
    request_id: 'req-ccc-333',
    status: 'success' as const,
    error_message: null,
    metadata: { tag: 'latest' },
  },
  {
    id: 'a1b2c3d4-0004-4000-8000-000000000004',
    created_at: '2024-01-20T14:20:00Z',
    actor: { id: 3, username: 'viewer1' },
    ip_address: '10.0.0.15',
    user_agent: 'curl/8.0',
    action: 'auth.login',
    resource_type: 'auth',
    resource_id: '',
    resource_name: null,
    request_id: 'req-ddd-444',
    status: 'success' as const,
    error_message: null,
    metadata: null,
  },
  {
    id: 'a1b2c3d4-0005-4000-8000-000000000005',
    created_at: '2024-01-20T14:15:00Z',
    actor: { id: 2, username: 'operator1' },
    ip_address: '10.0.0.5',
    user_agent: 'Mozilla/5.0',
    action: 'container.restart',
    resource_type: 'container',
    resource_id: 'xyz789abc123',
    resource_name: 'node-api',
    request_id: 'req-eee-555',
    status: 'error' as const,
    error_message: 'Container not running',
    metadata: { attempted_action: 'restart', container_state: 'exited' },
  },
]
