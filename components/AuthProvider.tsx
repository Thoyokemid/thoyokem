'use client';

import { useEffect, useState } from 'react';
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
    <SessionProvider session={session}>
      <InvalidSessionGuard />
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
