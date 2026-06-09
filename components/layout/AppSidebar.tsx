'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  label: string
  href: string
  icon: string
  description: string
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: '📊',
    description: 'QA health overview',
  },
  {
    label: 'Projects',
    href: '/projects',
    icon: '📁',
    description: 'Manage projects',
  },
  {
    label: 'Repository Tree',
    href: '/repository',
    icon: '🌳',
    description: 'Test hierarchy',
  },
  {
    label: 'Test Cases',
    href: '/test-cases',
    icon: '✅',
    description: 'Manage test cases',
  },
  {
    label: 'Test Suites',
    href: '/test-suites',
    icon: '📦',
    description: 'Saved test collections',
  },
  {
    label: 'Execution Cycles',
    href: '/cycles',
    icon: '🔄',
    description: 'Test execution runs',
  },
  {
    label: 'Tags',
    href: '/tags',
    icon: '🏷️',
    description: 'Organize by tags',
  },
  {
    label: 'Roam Integration',
    href: '/roam',
    icon: '🔗',
    description: 'Sync with Roam',
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 border-l-4 border-blue-600 text-blue-900'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <div className="flex-1">
                <div className="font-medium text-sm">{item.label}</div>
                <div className="text-xs text-gray-500">{item.description}</div>
              </div>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
