'use client'

import { useSearchParams } from 'next/navigation'
import { RoamConfigForm } from '@/components/forms/RoamConfigForm'

export default function RoamPage() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId') || 'default-project'

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Roam Integration</h1>
        <p className="text-gray-600 mb-8">Connect and sync with Roam Research workspace</p>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Configure Roam Connection</h2>
            <RoamConfigForm projectId={projectId} />
          </div>

          <div className="space-y-6">
            <div className="bg-cyan-50 rounded-lg border border-cyan-200 p-6">
              <h3 className="font-bold text-cyan-900 mb-2">📤 Import from Roam</h3>
              <ul className="text-cyan-800 text-sm space-y-2">
                <li>✓ Import test hierarchies from Roam</li>
                <li>✓ Preserve folder structure</li>
                <li>✓ Extract tags from page properties</li>
                <li>✓ One-time or scheduled syncs</li>
                <li>✓ Never deletes existing data</li>
              </ul>
              <button className="mt-4 w-full bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium">
                Import Now
              </button>
            </div>

            <div className="bg-cyan-50 rounded-lg border border-cyan-200 p-6">
              <h3 className="font-bold text-cyan-900 mb-2">📥 Export to Roam</h3>
              <ul className="text-cyan-800 text-sm space-y-2">
                <li>✓ Export test results to Roam</li>
                <li>✓ Update page status with run results</li>
                <li>✓ Link execution cycles</li>
                <li>✓ Sync defects and comments</li>
                <li>✓ Bidirectional synchronization</li>
              </ul>
              <button className="mt-4 w-full bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium">
                Export Now
              </button>
            </div>

            <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
              <h3 className="font-bold text-blue-900 mb-2">🔐 Security</h3>
              <ul className="text-blue-800 text-sm space-y-1">
                <li>✓ AES-256-GCM encryption at rest</li>
                <li>✓ HTTPS only connections</li>
                <li>✓ No data storage from Roam</li>
                <li>✓ Audit logging of all syncs</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
