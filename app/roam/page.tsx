'use client'

import { useSearchParams } from 'next/navigation'
import { RoamImportFileForm } from '@/components/forms/RoamImportFileForm'
import { RoamLiveSyncForm } from '@/components/forms/RoamLiveSyncForm'
import { ProtectedRoute } from '@/components/ProtectedRoute'

function RoamContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId') || 'default-project'

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Roam Integration</h1>
        <p className="text-gray-600 mb-8">Import test cases from Roam Research</p>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Method 1: Import File */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Method 1: Import File</h2>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-800">No API key required. Upload a Roam export file.</p>
            </div>
            <RoamImportFileForm projectId={projectId} />
          </div>

          {/* Method 2: Live Sync */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Method 2: Live Sync</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">API key required. Sync automatically with Roam.</p>
            </div>
            <RoamLiveSyncForm projectId={projectId} />
          </div>
        </div>

        {/* Info Boxes */}
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-cyan-50 rounded-lg border border-cyan-200 p-6">
            <h3 className="font-bold text-cyan-900 mb-2">📤 What Gets Imported</h3>
            <ul className="text-cyan-800 text-sm space-y-1">
              <li>✓ Test case hierarchy and structure</li>
              <li>✓ Test titles and descriptions</li>
              <li>✓ Folder organization and nesting</li>
              <li>✓ Tags from page properties</li>
              <li>✓ Never deletes existing data</li>
            </ul>
          </div>

          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
            <h3 className="font-bold text-blue-900 mb-2">🔐 Security</h3>
            <ul className="text-blue-800 text-sm space-y-1">
              <li>✓ AES-256-GCM encryption at rest</li>
              <li>✓ HTTPS only connections</li>
              <li>✓ No data retained from Roam</li>
              <li>✓ Audit logging of all syncs</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RoamPage() {
  return (
    <ProtectedRoute>
      <RoamContent />
    </ProtectedRoute>
  )
}
