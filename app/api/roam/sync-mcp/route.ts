import { NextRequest, NextResponse } from 'next/server';
import { RoamMCPImporter } from '@/lib/roam/mcp-importer';
import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/roam/crypto';

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'projectId required' },
        { status: 400 }
      );
    }

    console.log('[sync-mcp] Starting MCP sync for project:', projectId);

    // Get Roam config
    const config = await prisma.roamConfig.findUnique({
      where: { projectId },
    });

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Roam config not found' },
        { status: 400 }
      );
    }

    console.log('[sync-mcp] Config found:', config.graphName);

    // Decrypt token
    let decryptedToken: string;
    try {
      console.log('[sync-mcp] Attempting to decrypt token...');
      decryptedToken = decryptApiKey(config.apiToken);
      console.log('[sync-mcp] Token decrypted successfully');
    } catch (error) {
      console.error('[sync-mcp] Token decryption failed:', error);
      return NextResponse.json(
        { success: false, error: `Failed to decrypt Roam token: ${error instanceof Error ? error.message : 'unknown'}` },
        { status: 500 }
      );
    }

    // Create importer and run
    const importer = new RoamMCPImporter(config.graphName, decryptedToken);
    const result = await importer.importViaMCP(projectId, config.repositoryRootPage || '');

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Log sync
    await prisma.syncLog.create({
      data: {
        projectId,
        action: 'MCP_SYNC',
        status: 'SUCCESS',
        nodesAdded: result.repositoryNodesImported,
        durationMs: 0,
      },
    });

    return NextResponse.json({
      success: true,
      testCasesImported: result.testCasesImported,
      repositoryNodesImported: result.repositoryNodesImported,
      message: `MCP import completed: ${result.testCasesImported} test cases imported`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[sync-mcp] Error:', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
