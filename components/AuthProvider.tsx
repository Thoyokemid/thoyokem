'use client';

import { useEffect, useRef, useState } from 'react';
import { SessionProvider, useSession, signOut } from 'next-auth/react';
import { Session } from 'next-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

interface AuthProviderProps {
  children: React.ReactNode;
  session: Session | null;
}

// If the server marks this session invalid (its underlying `users` row was
// deleted, or its id changed under it — e.g. by a data migration), force a
// clean sign-out instead of leaving the user stuck on a page with broken
// permissions/data.
function InvalidSessionGuard() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user?.sessionInvalid) {
      signOut({ callbackUrl: '/login' });
    }
  }, [session?.user?.sessionInvalid]);

  return null;
}

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
const ACTIVITY_PING_INTERVAL_MS = 60_000; // matches SessionProvider's refetchInterval below

/**
 * Makes the 30-minute session a sliding idle timeout instead of a fixed one:
 * on real user activity, pings the session endpoint (throttled) so NextAuth's
 * `updateAge` (lib/auth.ts) pushes the expiry back to now + 30min. If there's
 * no activity at all, nothing pings it and it expires on schedule — at which
 * point the SessionProvider's periodic refetch below notices and this same
 * component signs the user out cleanly instead of leaving them stuck on a
 * page that silently stopped working.
 */
function SessionActivityRenewer() {
  const { status, update } = useSession();
  const lastPingRef = useRef(0);
  const wasAuthenticatedRef = useRef(false);

  useEffect(() => {
    if (status === 'authenticated') wasAuthenticatedRef.current = true;
    if (status === 'unauthenticated' && wasAuthenticatedRef.current) {
      signOut({ callbackUrl: '/login' });
    }
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastPingRef.current < ACTIVITY_PING_INTERVAL_MS) return;
      lastPingRef.current = now;
      update();
    };

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [status, update]);

  return null;
}

export default function AuthProvider({ children, session }: AuthProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <SessionProvider session={session} refetchInterval={60}>
      <InvalidSessionGuard />
      <SessionActivityRenewer />
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { fontSize: '13px' },
            success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
            error: { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
          }}
        />
      </QueryClientProvider>
    </SessionProvider>
  );
}
