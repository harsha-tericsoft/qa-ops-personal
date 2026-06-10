import { ProtectedRoute } from '@/components/ProtectedRoute'

function TestCasesContent() {
  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Cases</h1>
        <p className="text-gray-600 mb-8">View test cases imported from Roam Research</p>

        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No test cases imported yet</h2>
          <p className="text-gray-600 mb-6">Import test cases from Roam in the Roam Integration section</p>
          <a href="/roam" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Go to Roam Integration
          </a>
        </div>

        <div className="mt-12 grid gap-6">
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
            <h3 className="font-bold text-blue-900 mb-2">📋 Test Case Management</h3>
            <ul className="text-blue-800 text-sm space-y-1">
              <li>• Test cases are created and maintained in Roam Research</li>
              <li>• Imported test cases appear here after syncing</li>
              <li>• View test details and hierarchy from the Repository</li>
              <li>• Use Test Suites to organize tests for execution</li>
              <li>• Execute tests in Execution Cycles</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TestCasesPage() {
  return (
    <ProtectedRoute>
      <TestCasesContent />
    </ProtectedRoute>
  )
}
