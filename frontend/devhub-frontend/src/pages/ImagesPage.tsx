import { PageShell } from '../components/layout/PageShell'
import { Search, Download, Trash2 } from 'lucide-react'

/**
 * Images list page.
 * Phase 1: Static placeholder UI with pull image form.
 * Future phases will fetch from /docker/images/ and implement pull/remove.
 */
export function ImagesPage() {
  // Placeholder images - will be fetched from API
  const placeholderImages = [
    { id: 'sha256:abc123', name: 'nginx', tag: 'latest', size: '142 MB', created: '2 weeks ago' },
    { id: 'sha256:def456', name: 'postgres', tag: '15', size: '379 MB', created: '1 month ago' },
    { id: 'sha256:ghi789', name: 'redis', tag: 'alpine', size: '32 MB', created: '3 weeks ago' },
    { id: 'sha256:jkl012', name: 'node', tag: '20-slim', size: '219 MB', created: '1 week ago' },
  ]

  const pullAction = (
    <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
      <Download className="h-4 w-4" />
      Pull Image
    </button>
  )

  return (
    <PageShell title="Images" description="Manage Docker images" actions={pullAction}>
      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search images..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Images table */}
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Repository
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Tag
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Image ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {placeholderImages.map((image) => (
                <tr key={image.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                    {image.name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className="rounded bg-gray-100 px-2 py-1 text-sm text-gray-600">
                      {image.tag}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 font-mono text-sm text-gray-500">
                    {image.id.slice(7, 19)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{image.size}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {image.created}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <button
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phase 1 notice */}
      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-700">
          <strong>Phase 1:</strong> Placeholder data. Real images will be fetched from the Docker API
          in future phases.
        </p>
      </div>
    </PageShell>
  )
}
