export default function RepositoryPage() {
  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Repository Tree</h1>
        <p className="text-gray-600 mb-8">Hierarchical organization of test cases from Roam or manual creation</p>

        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">🌳</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No repositories yet</h2>
          <p className="text-gray-600 mb-6">Create a repository or sync from Roam Research</p>
          <div className="flex gap-4 justify-center">
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Create Repository
            </button>
            <button className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
              Sync from Roam
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-6">
          <div className="bg-green-50 rounded-lg border border-green-200 p-6">
            <h3 className="font-bold text-green-900 mb-2">🌳 Hierarchy Features</h3>
            <ul className="text-green-800 text-sm space-y-1">
              <li>• Unlimited nesting levels for test organization</li>
              <li>• Drag-and-drop folder structure</li>
              <li>• Quick selection of test groups</li>
              <li>• Path-based materialized storage for efficient queries</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
