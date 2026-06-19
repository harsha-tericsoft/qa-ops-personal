import { NextRequest, NextResponse } from 'next/server';
import { syncViaMCPSimple } from '@/lib/roam/mcp-sync-simple';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();
    const config = await prisma.roamConfig.findUnique({ where: { projectId } });
    if (!config) throw new Error('Config not found');

    const result = await syncViaMCPSimple(projectId, config.graphName);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
