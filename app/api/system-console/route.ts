import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { supabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase';
import packageJson from '@/package.json';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session.user.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const database = await (async () => {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'connected' as const, latencyMs: Date.now() - start };
    } catch (error) {
      return { status: 'error' as const, latencyMs: Date.now() - start, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  })();

  const storage = await (async () => {
    const start = Date.now();
    try {
      const { data, error } = await supabaseAdmin.storage.listBuckets();
      if (error) throw error;
      const bucketExists = data.some((b) => b.name === STORAGE_BUCKET);
      return { status: bucketExists ? ('connected' as const) : ('bucket_missing' as const), latencyMs: Date.now() - start, bucket: STORAGE_BUCKET };
    } catch (error) {
      return { status: 'error' as const, latencyMs: Date.now() - start, error: error instanceof Error ? error.message : 'Unknown error', bucket: STORAGE_BUCKET };
    }
  })();

  const [userCount, poCount, soCount, itemCount] = await Promise.all([
    prisma.user.count(),
    prisma.purchaseOrder.count(),
    prisma.salesOrder.count(),
    prisma.item.count(),
  ]);

  return NextResponse.json({
    app: {
      name: packageJson.name,
      version: packageJson.version,
      nodeVersion: process.version,
      nextVersion: (packageJson.dependencies as Record<string, string>).next,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
      region: process.env.VERCEL_REGION || 'local',
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
      commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
      deploymentUrl: process.env.VERCEL_URL || null,
    },
    database,
    storage,
    counts: { users: userCount, purchaseOrders: poCount, salesOrders: soCount, items: itemCount },
  });
}
