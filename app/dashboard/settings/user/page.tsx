'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, redirect } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { DetailView, DetailSection, FieldGrid } from '@/components/ui/DetailView';
import ActivityLogView from '@/components/ui/ActivityLogView';
import AssignedToSection from '@/components/ui/AssignedToSection';
import AttachmentSection from '@/components/ui/AttachmentSection';
import { AlertCircle } from 'lucide-react';
import { formatDateTime } from '@/lib/date';

interface UserWithRole {
  id: string;
  name: string;
  username: string;
  role: string;
  role_id: string;
  last_active?: string;
}

function formatLastActive(iso: string | undefined): string {
  if (!iso) return 'Never';
  const formatted = formatDateTime(iso);
  return formatted === '-' ? 'Never' : formatted;
}

function UserDetailPageInner() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const id = decodeURIComponent(String(searchParams.get('id')));
  const [user, setUser] = useState<UserWithRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.user.permissions.setting) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const list: UserWithRole[] = await res.json();
        setUser(list.find((u) => u.id === id) || null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (status !== 'loading' && !session) redirect('/login');
  if (status === 'loading' && !session) return null;
  if (!session) return null;

  const layoutUser = {
    id: session.user.id,
    username: session.user.email || '',
    name: session.user.name ?? '',
    role: session.user.role,
    permissions: session.user.permissions,
  };

  if (!session.user.permissions.setting) {
    return (
      
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertCircle className="mx-auto text-red-500 mb-3" size={40} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">You don't have permission to access this page.</p>
          </div>
        </div>
      
    );
  }

  return (
    
      <DetailView
        backHref="/dashboard/settings"
        backLabel="Settings"
        title={user?.name || id}
        subtitle={user ? `@${user.username}` : undefined}
        isLoading={isLoading}
        notFound={!isLoading && !user}
        sidebar={
          user && (
            <>
              <AssignedToSection doctype="User" documentId={user.id} />
              <DetailSection title="Riwayat">
                <ActivityLogView doctype="User" documentId={user.id} />
                <AttachmentSection doctype="User" documentId={user.id} />
              </DetailSection>
            </>
          )
        }
      >
        {user && (
          <div className="space-y-4">
            <DetailSection title="Detail">
              <FieldGrid
                fields={[
                  { label: 'Nama', value: user.name },
                  { label: 'Username', value: user.username },
                  { label: 'Role', value: user.role || '-' },
                  { label: 'Last Active', value: formatLastActive(user.last_active) },
                ]}
              />
            </DetailSection>
          </div>
        )}
      </DetailView>
    
  );
}

export default function UserDetailPage() {
  return (
    <Suspense fallback={null}>
      <UserDetailPageInner />
    </Suspense>
  );
}
