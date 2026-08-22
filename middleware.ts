import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// In-memory sliding-window counter per client IP + route bucket.
// Runs per Edge instance — good enough to blunt scripted scraping/abuse on a
// single-region deployment; not a substitute for a shared store at scale.
const RATE_LIMIT = 120; // requests
const WINDOW_MS = 60_000; // per 1 minute
const hits = new Map<string, { count: number; resetAt: number }>();

// Much stricter, separate bucket for credential login attempts — this path is excluded
// from the general API rate limiter below (all of /api/auth/* is, since session/csrf/
// providers are frequent harmless reads), so without this a password could be
// brute-forced with no throttling at all.
const LOGIN_RATE_LIMIT = 8; // attempts
const LOGIN_WINDOW_MS = 5 * 60_000; // per 5 minutes
const loginHits = new Map<string, { count: number; resetAt: number }>();

function isLimited(store: Map<string, { count: number; resetAt: number }>, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (store.size > 5000) {
    for (const [k, v] of store) {
      if (now > v.resetAt) store.delete(k);
    }
  }
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

function isRateLimited(key: string): boolean {
  return isLimited(hits, key, RATE_LIMIT, WINDOW_MS);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';

  if (pathname.startsWith('/api/auth/callback/credentials')) {
    if (isLimited(loginHits, ip, LOGIN_RATE_LIMIT, LOGIN_WINDOW_MS)) {
      return NextResponse.json({ error: 'Terlalu banyak percobaan login, coba lagi beberapa menit lagi' }, { status: 429 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
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
