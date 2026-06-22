import { RoamPage, RoamBlock } from './client'
import { slugify } from '@/lib/utils/formatters'
import { prisma } from '@/lib/prisma'

export interface SyncResult {
  added: number
  updated: number
  skipped: number
  errors: string[]
}

export async function importRoamJSON(
  pages: RoamPage[],
  repositoryId: string,
  projectId: string
): Promise<SyncResult> {
  const result: SyncResult = { added: 0, updated: 0, skipped: 0, errors: [] }

  try {
    for (const page of pages) {
      await importPage(page, repositoryId, projectId, null, '/', 0, result)
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
  }

  return result
}

async function importPage(
  page: RoamPage,
  repositoryId: string,
  projectId: string,
  parentId: string | null,
  parentPath: string,
  depth: number,
  result: SyncResult
): Promise<string> {
  const slug = slugify(page.title)
  const nodePath = parentPath === '/' ? `/${page.uid}` : `${parentPath}/${page.uid}`

  try {
    let nodeId: string

    const existing = await prisma.repositoryNode.findUnique({
      where: {
        repositoryId_roamNodeId: {
          repositoryId,
          roamNodeId: page.uid,
        }
      },
    })

    if (existing) {
      // Update existing node if name changed
      if (existing.name !== page.title) {
        await prisma.repositoryNode.update({
          where: { id: existing.id },
          data: { name: page.title, slug, updatedAt: new Date(), syncedAt: new Date() },
        })
        result.updated++
      } else {
        result.skipped++
      }
      nodeId = existing.id
    } else {
      // Create new node
      const created = await prisma.repositoryNode.create({
        data: {
          repositoryId,
          projectId,
          name: page.title,
          slug,
          path: nodePath,
          depth,
          parentId,
          roamNodeId: page.uid,
          roamPageId: page.uid,
          syncedAt: new Date(),
        },
      })
      result.added++
      nodeId = created.id
    }

    // Recursively import children
    if (page.children && page.children.length > 0) {
      for (const child of page.children) {
        await importBlock(child, repositoryId, projectId, nodeId, nodePath, depth + 1, result)
      }
    }

    return nodeId
  } catch (error) {
    result.errors.push(`Error importing page "${page.title}": ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}

async function importBlock(
  block: RoamBlock,
  repositoryId: string,
  projectId: string,
  parentId: string | null,
  parentPath: string,
  depth: number,
  result: SyncResult
): Promise<string> {
  const slug = slugify(block.string.substring(0, 50))
  const blockPath = parentPath === '/' ? `/${block.uid}` : `${parentPath}/${block.uid}`

  try {
    let nodeId: string

    const existing = await prisma.repositoryNode.findUnique({
      where: {
        repositoryId_roamNodeId: {
          repositoryId,
          roamNodeId: block.uid,
        }
      },
    })

    if (existing) {
      if (existing.name !== block.string) {
        await prisma.repositoryNode.update({
          where: { id: existing.id },
          data: { name: block.string, slug, updatedAt: new Date(), syncedAt: new Date() },
        })
        result.updated++
      } else {
        result.skipped++
      }
      nodeId = existing.id
    } else {
      const created = await prisma.repositoryNode.create({
        data: {
          repositoryId,
          projectId,
          name: block.string,
          slug,
          path: blockPath,
          depth,
          parentId,
          roamNodeId: block.uid,
          type: 'FILE',
          syncedAt: new Date(),
        },
      })
      result.added++
      nodeId = created.id
    }

    // Recursively import children
    if (block.children && block.children.length > 0) {
      for (const child of block.children) {
        await importBlock(child, repositoryId, projectId, nodeId, blockPath, depth + 1, result)
      }
    }

    return nodeId
  } catch (error) {
    result.errors.push(`Error importing block "${block.string}": ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}
