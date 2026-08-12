'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { DetailView, DetailSection, FieldGrid } from '@/components/ui/DetailView';
import ActivityLogView from '@/components/ui/ActivityLogView';
import { AlertCircle } from 'lucide-react';

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
  const date = new Date(iso);
  if (isNaN(date.getTime())) return 'Never';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function UserDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const id = decodeURIComponent(String(params.id));
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
  if (status === 'loading') return null;
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
      <DashboardLayout user={layoutUser}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertCircle className="mx-auto text-red-500 mb-3" size={40} />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">You don't have permission to access this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={layoutUser}>
      <DetailView
        backHref="/dashboard/settings"
        backLabel="Settings"
        title={user?.name || id}
        subtitle={user ? `@${user.username}` : undefined}
        isLoading={isLoading}
        notFound={!isLoading && !user}
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
            <DetailSection title="Riwayat">
              <ActivityLogView doctype="User" documentId={user.id} />
            </DetailSection>
          </div>
        )}
      </DetailView>
    </DashboardLayout>
  );
}
