export default function ExecutionCyclesPage() {
  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Execution Cycles</h1>
        <p className="text-gray-600 mb-8">Track and manage test execution runs</p>

        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">🔄</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No cycles yet</h2>
          <p className="text-gray-600 mb-6">Create an execution cycle to start testing</p>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Create Execution Cycle
          </button>
        </div>

        <div className="mt-12 grid gap-6">
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
            <h3 className="font-bold text-yellow-900 mb-2">🔄 Test Statuses</h3>
            <div className="text-yellow-800 text-sm space-y-2 grid grid-cols-2">
              <div><strong>✅ PASS:</strong> Test passed</div>
              <div><strong>❌ FAIL:</strong> Test failed</div>
              <div><strong>⚠️ BLOCKED:</strong> Cannot execute</div>
              <div><strong>⏳ NOT EXECUTED:</strong> Pending</div>
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
            <h3 className="font-bold text-yellow-900 mb-2">📝 Cycle Features</h3>
            <ul className="text-yellow-800 text-sm space-y-1">
              <li>• Add comments to individual test runs</li>
              <li>• Link Jira defects to failed/blocked tests</li>
              <li>• Attach screenshots and logs</li>
              <li>• Track execution time and performance</li>
              <li>• Monitor cycle status (PLANNED, IN_PROGRESS, COMPLETED, ABORTED)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
