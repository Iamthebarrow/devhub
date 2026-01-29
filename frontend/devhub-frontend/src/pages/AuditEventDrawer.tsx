import { X, Copy, CheckCircle, XCircle, Clock, User, Globe, Monitor, Hash } from 'lucide-react'
import toast from 'react-hot-toast'
import type { AuditEvent } from '../api/types'

// =============================================================================
// Constants
// =============================================================================

/** Keys whose values are redacted in metadata display. */
const SENSITIVE_KEY_PATTERNS = [
  'password',
  'secret',
  'token',
  'authorization',
  'cookie',
  'credential',
  'api_key',
  'apikey',
  'private',
]

/** DEFAULT: max metadata JSON size before truncation (32 KB). */
const MAX_METADATA_DISPLAY_BYTES = 32 * 1024

// =============================================================================
// Helpers
// =============================================================================

/** Get a display-friendly actor name. */
export function getActorName(actor: AuditEvent['actor']): string {
  if (!actor) return 'System'
  if (typeof actor === 'string') return actor
  return actor.username
}

/** Copy text to clipboard with toast feedback. */
async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`Copied ${label}`)
  } catch {
    // Fallback
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      toast.success(`Copied ${label}`)
    } catch {
      toast.error('Failed to copy')
    }
  }
}

/** Format ISO date to full locale string. */
function formatExactTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    })
  } catch {
    return iso
  }
}

/**
 * Redact sensitive keys in metadata (best-effort).
 * Any key containing a sensitive pattern gets its value replaced.
 */
function redactMetadata(data: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase()
    if (SENSITIVE_KEY_PATTERNS.some((p) => keyLower.includes(p))) {
      redacted[key] = '***redacted***'
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      redacted[key] = redactMetadata(value as Record<string, unknown>)
    } else {
      redacted[key] = value
    }
  }
  return redacted
}

// =============================================================================
// Inline CopyButton
// =============================================================================

function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <button
      onClick={() => copyToClipboard(text, label)}
      className="ml-1 inline-flex items-center rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  )
}

// =============================================================================
// Detail Row
// =============================================================================

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 py-2">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{children}</dd>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

interface AuditEventDrawerProps {
  event: AuditEvent | null
  onClose: () => void
}

export function AuditEventDrawer({ event, onClose }: AuditEventDrawerProps) {
  if (!event) return null

  const actorName = getActorName(event.actor)
  const isError = event.status === 'error'

  // Build redacted metadata JSON
  let metadataJson = ''
  if (event.metadata && Object.keys(event.metadata).length > 0) {
    const safe = redactMetadata(event.metadata)
    const raw = JSON.stringify(safe, null, 2)
    metadataJson = raw.length > MAX_METADATA_DISPLAY_BYTES
      ? raw.slice(0, MAX_METADATA_DISPLAY_BYTES) + '\n\n… (truncated)'
      : raw
  }

  return (
    // Overlay
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      {/* Drawer panel */}
      <div
        className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Event Details</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {/* Status banner */}
          <div
            className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-3 ${
              isError ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'
            }`}
          >
            {isError ? <XCircle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
            <span className="font-medium capitalize">{event.status}</span>
            {isError && event.error_message && (
              <span className="ml-1 text-sm font-normal">— {event.error_message}</span>
            )}
          </div>

          {/* Details */}
          <dl className="divide-y divide-gray-100">
            <DetailRow label="Time">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-gray-400" />
                {formatExactTime(event.created_at)}
              </div>
            </DetailRow>

            <DetailRow label="Action">
              <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-sm">{event.action}</span>
            </DetailRow>

            <DetailRow label="Actor">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4 text-gray-400" />
                {actorName}
              </div>
            </DetailRow>

            <DetailRow label="Resource Type">
              {event.resource_type || '—'}
            </DetailRow>

            <DetailRow label="Resource ID">
              <div className="flex items-center">
                <span className="font-mono text-sm">{event.resource_id || '—'}</span>
                {event.resource_id && (
                  <CopyButton text={event.resource_id} label="resource ID" />
                )}
              </div>
            </DetailRow>

            <DetailRow label="Resource Name">
              {event.resource_name || '—'}
            </DetailRow>

            <DetailRow label="Request ID">
              <div className="flex items-center">
                <Hash className="mr-1 h-4 w-4 text-gray-400" />
                <span className="font-mono text-sm">{event.request_id || '—'}</span>
                {event.request_id && (
                  <CopyButton text={event.request_id} label="request ID" />
                )}
              </div>
            </DetailRow>

            {event.ip_address && (
              <DetailRow label="IP Address">
                <div className="flex items-center gap-1">
                  <Globe className="h-4 w-4 text-gray-400" />
                  {event.ip_address}
                </div>
              </DetailRow>
            )}

            {event.user_agent && (
              <DetailRow label="User Agent">
                <div className="flex items-center gap-1">
                  <Monitor className="h-4 w-4 text-gray-400" />
                  <span className="break-all text-xs">{event.user_agent}</span>
                </div>
              </DetailRow>
            )}
          </dl>

          {/* Metadata */}
          {metadataJson && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">Metadata</h3>
                <button
                  onClick={() => copyToClipboard(metadataJson, 'metadata')}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                >
                  <Copy className="h-3 w-3" />
                  Copy JSON
                </button>
              </div>
              <pre className="max-h-80 overflow-auto rounded-lg bg-gray-50 p-4 font-mono text-xs text-gray-700">
                {metadataJson}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
