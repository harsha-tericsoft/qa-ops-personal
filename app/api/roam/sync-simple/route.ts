import { NextRequest, NextResponse } from 'next/server';
import { syncViaMCPSimple } from '@/lib/roam/mcp-sync-simple';
import { prisma } from '@/lib/prisma';
import { shouldUseBridge, getBridgeFeatureFlag, logRoutingDecision } from '@/lib/bridge/routing';
import { syncTestCases } from '@/lib/bridge/bridge-client';

const requestId = Math.random().toString(36).substring(7);

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    const config = await prisma.roamConfig.findUnique({ where: { projectId } });
    if (!config) throw new Error('Config not found');

    // BRIDGE ROUTING LOGIC (NEW - Parallel path)
    const userId = extractUserIdFromRequest(req); // TODO: Get from actual auth
    const featureFlagEnabled = getBridgeFeatureFlag();
    const routingDecision = await shouldUseBridge(userId, featureFlagEnabled);
    logRoutingDecision(requestId, routingDecision, 'SYNC_SIMPLE');

    // If bridge available: try it first
    if (routingDecision.useBridge) {
      try {
        const bridgeConfig = {
          endpoint: routingDecision.bridgeEndpoint!,
          token: routingDecision.bridgeToken!,
          userId,
          requestId,
        };

        const bridgeResponse = await syncTestCases(bridgeConfig, projectId, 'refresh');

        if (bridgeResponse.success) {
          return NextResponse.json({
            success: true,
            ...bridgeResponse,
            _source: 'BRIDGE',
          });
        }
      } catch (bridgeError) {
        console.warn('[SYNC_SIMPLE] Bridge failed, falling back to CLI');
      }
    }

    // CLI FALLBACK (EXISTING - Unchanged)
    const result = await syncViaMCPSimple(projectId, config.graphName);

    return NextResponse.json({
      success: true,
      ...result,
      _source: 'CLI',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Extract user ID from request (placeholder)
 * TODO: Get from actual authentication system
 */
function extractUserIdFromRequest(req: NextRequest): string {
  // Placeholder - will be replaced with actual auth
  return 'user_placeholder';
}
