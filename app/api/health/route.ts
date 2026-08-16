import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Trivial DB ping — no auth, no sensitive data. Two jobs:
// 1. Basic uptime/liveness check.
// 2. Hit by a scheduled GitHub Action (see .github/workflows/keep-supabase-alive.yml)
//    so Supabase's free-tier project never sits idle long enough to auto-pause
//    (paused at 7 days of inactivity; the workflow pings well before that).
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({ status: 'error' }, { status: 503 });
  }
}
