import { SuiteCategory } from '@/app/generated/prisma'

interface SuiteCategoryBadgeProps {
  category: SuiteCategory
}

const categoryColors: Record<SuiteCategory, string> = {
  SMOKE: 'bg-blue-100 text-blue-800',
  REGRESSION: 'bg-purple-100 text-purple-800',
  SPRINT: 'bg-orange-100 text-orange-800',
  RELEASE: 'bg-green-100 text-green-800',
  CUSTOM: 'bg-gray-100 text-gray-800',
}

const categoryLabels: Record<SuiteCategory, string> = {
  SMOKE: 'Smoke',
  REGRESSION: 'Regression',
  SPRINT: 'Sprint',
  RELEASE: 'Release',
  CUSTOM: 'Custom',
}

export function SuiteCategoryBadge({ category }: SuiteCategoryBadgeProps) {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColors[category]}`}>
      {categoryLabels[category]}
    </span>
  )
}
