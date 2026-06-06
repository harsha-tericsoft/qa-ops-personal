import { PrismaClient } from '@/app/generated/prisma'
import { RoamPage, RoamBlock } from './client'

const prisma = new PrismaClient()

export async function exportToRoamJSON(repositoryId: string): Promise<RoamPage[]> {
  // Fetch all nodes for the repository
  const nodes = await prisma.repositoryNode.findMany({
    where: { repositoryId },
    orderBy: [{ depth: 'asc' }, { order: 'asc' }],
  })

  // Build hierarchy from flat list
  const nodeMap = new Map<string, RoamPage | RoamBlock>()
  const rootPages: RoamPage[] = []

  for (const node of nodes) {
    // Skip nodes marked as deleted
    if (node.deletedAt) continue

    const item: RoamPage | RoamBlock = node.depth === 0 ? ({
      title: node.name,
      uid: node.roamNodeId || node.id,
      children: [],
    } as RoamPage) : ({
      string: node.name,
      uid: node.roamNodeId || node.id,
      children: [],
    } as RoamBlock)

    nodeMap.set(node.id, item)

    if (node.parentId) {
      const parent = nodeMap.get(node.parentId)
      if (parent && 'children' in parent) {
        parent.children = parent.children || []
        parent.children.push(item as RoamBlock)
      }
    } else if (node.depth === 0) {
      rootPages.push(item as RoamPage)
    }
  }

  return rootPages
}
