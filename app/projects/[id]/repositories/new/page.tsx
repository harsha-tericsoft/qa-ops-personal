import Link from 'next/link'
import { RepositoryForm } from '@/src/components/repositories/RepositoryForm'

interface NewRepositoryPageProps {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: 'New Repository',
}

export default async function NewRepositoryPage({ params }: NewRepositoryPageProps) {
  const { id } = await params

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-2xl">
        <Link href={`/projects/${id}/repositories`} className="text-blue-600 hover:underline text-sm mb-4 inline-block">
          ← Back to Repositories
        </Link>
        <h1 className="text-2xl font-bold mb-6">Register Repository</h1>
        <RepositoryForm projectId={id} />
      </div>
    </div>
  )
}
