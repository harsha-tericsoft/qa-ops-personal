import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MarkdownRoamParser } from '@/lib/roam/markdown-parser'

export async function POST(req: NextRequest) {
  const logs: string[] = []
  const log = (msg: string) => {
    console.log(msg)
    logs.push(msg)
  }

  try {
    const { uid, markdown } = await req.json()
    log(`[START] Parsing markdown...`)

    // STEP 1: Parse markdown
    const tree = MarkdownRoamParser.parseMarkdown(markdown, 'TestSuite : Kinergy', uid)
    log(`[PARSE] Tree created, root uid=${tree?.uid}`)

    if (!tree) {
      throw new Error('Failed to parse markdown - tree is null')
    }

    // STEP 2: Flatten tree
    const allNodes = MarkdownRoamParser.flattenTree(tree)
    log(`[FLATTEN] Total nodes: ${allNodes.length}`)

    // STEP 3: Take only first 10 and rename UIDs to avoid conflicts
    const nodes = allNodes.slice(0, 10)
    const timestamp = Date.now().toString().slice(-6)
    const testNodes = nodes.map((n, i) => ({
      ...n,
      originalUid: n.uid,
      uid: `debug${timestamp}_${i}`, // Rename to avoid unique constraint conflicts
      parentId: nodes[0].parentId === n.parentId ? null : `debug${timestamp}_${nodes.findIndex(x => x.uid === n.parentId)}`, // Map parent refs
    }))
    log(`[SAMPLE] Processing first 10 nodes (renamed with timestamp ${timestamp})`)
    log(``)

    // STEP 4: Show flattened nodes sample
    log(`=== FLATTENED NODES (FIRST 10) ===`)
    const flattenedSample = testNodes.map((n, i) => ({
      index: i,
      uid: n.uid,
      originalUid: n.originalUid,
      text: n.text?.substring(0, 40),
      nodeDepth: n.nodeDepth,
      parentId_roamUid: n.parentId,
      isTestCase: n.isTestCase,
    }))

    flattenedSample.forEach(n => {
      log(`[${n.index}] uid=${n.uid} | parentId=${n.parentId_roamUid} | depth=${n.nodeDepth} | text="${n.text}"`)
    })
    log(``)

    // STEP 5: Create temp project and repository
    log(`[DB] Creating temporary project...`)
    const tempProject = await prisma.project.create({
      data: {
        name: 'Debug Project',
        description: 'Temporary debug project for 10-node test',
      },
    })
    log(`[DB] Project created: id=${tempProject.id}`)

    log(`[DB] Creating temporary repository...`)
    const tempRepo = await prisma.repository.create({
      data: {
        projectId: tempProject.id,
        name: 'Debug Repository',
        description: 'Temporary debug repo for 10-node test',
      },
    })
    log(`[DB] Repository created: id=${tempRepo.id}`)
    log(``)

    // STEP 6: Sort by depth
    const sortedNodes = [...testNodes].sort((a, b) => (a.nodeDepth || 0) - (b.nodeDepth || 0))
    log(`=== SORTED BY DEPTH ===`)
    sortedNodes.forEach((n, i) => {
      log(`[${i}] uid=${n.uid} (original: ${n.originalUid}) | depth=${n.nodeDepth} | parentId_roamUid=${n.parentId}`)
    })
    log(``)

    // STEP 7: Import with full logging
    log(`=== IMPORTING 10 NODES ===`)
    const uidToNodeId = new Map<string, string>()
    const importResults = []

    for (const node of sortedNodes) {
      if (!node.uid) {
        log(`[SKIP] Node has no uid`)
        continue
      }

      log(`[INSERT-${node.uid}] Processing node: ${node.text?.substring(0, 30)}`)

      // Determine parent FK value
      let parentNodeId: string | null = null
      if (node.parentId) {
        log(`[LOOKUP-${node.uid}] Looking up parentId_roamUid="${node.parentId}" in map...`)
        parentNodeId = uidToNodeId.get(node.parentId) || null
        log(`[LOOKUP-${node.uid}] Result: parentNodeId=${parentNodeId}`)
      } else {
        log(`[LOOKUP-${node.uid}] No parentId in flattened node (root), parentNodeId=null`)
      }

      // Log the exact Prisma payload
      const createPayload = {
        repositoryId: tempRepo.id,
        projectId: tempRepo.projectId,
        name: node.text,
        slug: node.text?.substring(0, 20) || 'unknown',
        path: node.parentPath || '/',
        depth: node.nodeDepth,
        parentId: parentNodeId, // ← THIS IS THE KEY VALUE
        roamNodeId: node.uid,
        type: node.isTestCase ? 'FILE' : 'FOLDER',
        tags: node.tags || [],
        syncedAt: new Date(),
      }

      log(`[CREATE-${node.uid}] Prisma create payload:`)
      log(`  parentId="${parentNodeId}" (type: ${typeof parentNodeId})`)
      log(`  roamNodeId="${node.uid}"`)
      log(`  type="${createPayload.type}"`)

      // Insert without error suppression
      const created = await prisma.repositoryNode.create({ data: createPayload as any })
      log(`[SUCCESS-${node.uid}] Created with RepositoryNode.id="${created.id}"`)

      // Add to map for next iteration
      uidToNodeId.set(node.uid, created.id)
      log(`[MAP-${node.uid}] Added to uidToNodeId: "${node.uid}" → "${created.id}"`)
      log(``)

      importResults.push({
        uid: node.uid,
        text: node.text,
        repositoryNodeId: created.id,
        parentId_input: parentNodeId,
      })
    }

    // STEP 8: Query database to verify
    log(`=== VERIFYING DATABASE ===`)
    const dbRecords = await prisma.repositoryNode.findMany({
      where: { repositoryId: tempRepo.id },
      select: {
        id: true,
        roamNodeId: true,
        parentId: true,
        depth: true,
        name: true,
      },
      orderBy: { depth: 'asc' },
    })

    log(`[DB] Found ${dbRecords.length} records`)
    log(``)
    log(`=== DATABASE RECORDS ===`)
    dbRecords.forEach((record, i) => {
      log(`[${i}] roamNodeId="${record.roamNodeId}" | parentId="${record.parentId}" | depth=${record.depth} | name="${record.name?.substring(0, 30)}"`)
    })
    log(``)

    // STEP 9: Verify root and children
    log(`=== VERIFICATION ===`)
    const rootRecord = dbRecords.find(r => r.depth === 0)
    const childRecords = dbRecords.filter(r => r.depth > 0)

    log(`Root node: roamNodeId="${rootRecord?.roamNodeId}" | parentId="${rootRecord?.parentId}"`)
    if (rootRecord?.parentId === null) {
      log(`✓ Root parentId is null (correct)`)
    } else {
      log(`✗ Root parentId is NOT null! Value: "${rootRecord?.parentId}" (WRONG!)`)
    }
    log(``)

    log(`Child nodes (${childRecords.length} total):`)
    let allChildrenHaveParentId = true
    childRecords.forEach((child, i) => {
      const hasParentId = child.parentId !== null
      log(`[${i}] roamNodeId="${child.roamNodeId}" | parentId="${child.parentId}" | ${hasParentId ? '✓' : '✗'}`)
      if (!hasParentId) allChildrenHaveParentId = false
    })
    log(``)

    if (allChildrenHaveParentId) {
      log(`✓ All children have parentId set (SUCCESS)`)
    } else {
      log(`✗ Some children have parentId=null (FAILURE)`)
      log(``)
      log(`=== ROOT CAUSE ANALYSIS ===`)
      log(`Checking where parentId became null...`)

      // Show exact mapping
      log(``)
      log(`uidToNodeId map final state:`)
      const mapEntries = Array.from(uidToNodeId.entries())
      mapEntries.forEach(([roamUid, nodeId]) => {
        log(`  "${roamUid}" → "${nodeId}"`)
      })

      log(``)
      log(`Flattened nodes parentId values vs Database parentId:`)
      flattenedSample.forEach((node, i) => {
        const dbRecord = dbRecords.find(r => r.roamNodeId === node.uid)
        log(`  [${i}] uid="${node.uid}" | flattened.parentId="${node.parentId_roamUid}" | db.parentId="${dbRecord?.parentId}"`)
        if (node.parentId_roamUid && !dbRecord?.parentId) {
          log(`    ↑ PARENTID LOST: Had "${node.parentId_roamUid}" in flatten, became null in DB`)
        }
      })
    }

    return NextResponse.json({
      success: true,
      nodesProcessed: nodes.length,
      nodesInDatabase: dbRecords.length,
      rootNodeParentIdIsNull: rootRecord?.parentId === null,
      allChildrenHaveParentId,
      logs,
      flattenedSample,
      dbRecords,
      importResults,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : ''
    log(`[ERROR] ${errorMsg}`)
    log(`[STACK] ${stack}`)

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        stack,
        logs,
      },
      { status: 500 }
    )
  }
}
