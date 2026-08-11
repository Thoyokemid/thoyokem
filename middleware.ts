import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// In-memory sliding-window counter per client IP + route bucket.
// Runs per Edge instance — good enough to blunt scripted scraping/abuse on a
// single-region deployment; not a substitute for a shared store at scale.
const RATE_LIMIT = 120; // requests
const WINDOW_MS = 60_000; // per 1 minute
const hits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (now > v.resetAt) hits.delete(k);
    }
  }
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
    if (isRateLimited(`${ip}:${pathname}`)) {
      return NextResponse.json({ error: 'Too many requests, please slow down' }, { status: 429 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/dashboard')) {
    const token = await getToken({ req });
    if (!token) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
