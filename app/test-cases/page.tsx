export default function TestCasesPage() {
  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Cases</h1>
        <p className="text-gray-600 mb-8">Create and manage individual test cases</p>

        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No test cases yet</h2>
          <p className="text-gray-600 mb-6">Create a test case to start testing</p>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Create Test Case
          </button>
        </div>

        <div className="mt-12 grid gap-6">
          <div className="bg-orange-50 rounded-lg border border-orange-200 p-6">
            <h3 className="font-bold text-orange-900 mb-2">✅ Test Case Structure</h3>
            <ul className="text-orange-800 text-sm space-y-1">
              <li>• Title and detailed description</li>
              <li>• Link to repository hierarchy</li>
              <li>• Tag assignment for filtering</li>
              <li>• Execution history tracking</li>
              <li>• Attach screenshots and documents</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
