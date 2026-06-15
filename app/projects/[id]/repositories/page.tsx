import { RepositoryList } from '@/src/components/repositories/RepositoryList'

interface RepositoriesPageProps {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: 'Repositories',
}

export default async function RepositoriesPage({ params }: RepositoriesPageProps) {
  const { id } = await params

  return (
    <div className="container mx-auto p-6">
      <RepositoryList projectId={id} />
    </div>
  )
}
