import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Safe no-op when DSN is empty — set NEXT_PUBLIC_SENTRY_DSN (Sentry dashboard →
  // Settings → Client Keys) to start receiving events.
  tracesSampleRate: 0.1,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
