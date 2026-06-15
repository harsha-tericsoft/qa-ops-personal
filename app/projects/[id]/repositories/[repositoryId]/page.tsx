import Link from 'next/link'
import { RepositoryDetail } from '@/src/components/repositories/RepositoryDetail'

interface RepositoryDetailPageProps {
  params: Promise<{ id: string; repositoryId: string }>
}

export const metadata = {
  title: 'Repository Details',
}

export default async function RepositoryDetailPage({ params }: RepositoryDetailPageProps) {
  const { id, repositoryId } = await params

  return (
    <div className="container mx-auto p-6">
      <Link href={`/projects/${id}/repositories`} className="text-blue-600 hover:underline text-sm mb-4 inline-block">
        ← Back to Repositories
      </Link>
      <RepositoryDetail repositoryId={repositoryId} projectId={id} />
    </div>
  )
}
