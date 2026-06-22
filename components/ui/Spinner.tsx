export function Spinner() {
  return (
    <div className="inline-block">
      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
    </div>
  )
}

export function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 text-center">
        <Spinner />
        <p className="mt-4 text-gray-900 font-medium">{message}</p>
      </div>
    </div>
  )
}
