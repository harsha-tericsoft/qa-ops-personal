export default function TestSuitesPage() {
  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Suites</h1>
        <p className="text-gray-600 mb-8">Organize test cases into reusable collections</p>

        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">📦</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No test suites yet</h2>
          <p className="text-gray-600 mb-6">Create a suite to organize related tests</p>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Create Test Suite
          </button>
        </div>

        <div className="mt-12 grid gap-6">
          <div className="bg-pink-50 rounded-lg border border-pink-200 p-6">
            <h3 className="font-bold text-pink-900 mb-2">📦 Suite Categories</h3>
            <div className="text-pink-800 text-sm space-y-2">
              <div><strong>Smoke:</strong> Quick sanity tests</div>
              <div><strong>Regression:</strong> Full feature coverage</div>
              <div><strong>Sprint:</strong> Current sprint tests</div>
              <div><strong>Release:</strong> Pre-release validation</div>
              <div><strong>Custom:</strong> User-defined categories</div>
            </div>
          </div>

          <div className="bg-pink-50 rounded-lg border border-pink-200 p-6">
            <h3 className="font-bold text-pink-900 mb-2">🎯 Selection Methods</h3>
            <ul className="text-pink-800 text-sm space-y-1">
              <li>• <strong>Repository Tree:</strong> Select by folder/hierarchy</li>
              <li>• <strong>Tags:</strong> Filter by tags (AND/OR logic)</li>
              <li>• <strong>Search:</strong> Full-text search across test cases</li>
              <li>• <strong>Manual:</strong> Hand-pick specific tests</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
