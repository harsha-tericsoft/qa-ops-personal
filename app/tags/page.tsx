export default function TagsPage() {
  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Tags</h1>
        <p className="text-gray-600 mb-8">Organize and filter tests by tags</p>

        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">🏷️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No tags yet</h2>
          <p className="text-gray-600 mb-6">Create tags to organize your tests</p>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Create Tag
          </button>
        </div>

        <div className="mt-12 grid gap-6">
          <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-6">
            <h3 className="font-bold text-indigo-900 mb-2">🏷️ Tag System</h3>
            <ul className="text-indigo-800 text-sm space-y-1">
              <li>• Create custom tags with color coding</li>
              <li>• Assign multiple tags to each test case</li>
              <li>• Filter and search by tags</li>
              <li>• Use in test suite selection (AND/OR logic)</li>
              <li>• Common examples: smoke, critical, ui, api, performance</li>
            </ul>
          </div>

          <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-6">
            <h3 className="font-bold text-indigo-900 mb-2">🎨 Tag Features</h3>
            <ul className="text-indigo-800 text-sm space-y-1">
              <li>• Visual color-coded identification</li>
              <li>• Organize tests across multiple dimensions</li>
              <li>• Build dynamic test suites with tag filters</li>
              <li>• Quick filtering in execution cycles</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
