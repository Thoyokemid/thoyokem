'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { DetailView, DetailSection } from '@/components/ui/DetailView';
import { StatusBadge } from '@/components/ui/ListView';
import ActivityLogView from '@/components/ui/ActivityLogView';
import { Role } from '@/types';
import { AlertCircle } from 'lucide-react';

const PERMISSION_LABELS: { key: keyof Omit<Role, 'role_id' | 'role_name' | 'is_super_admin'>; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'leave', label: 'Leave' },
  { key: 'staff', label: 'Staff' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'purchasing', label: 'Purchasing' },
  { key: 'sales_order', label: 'Sales Order' },
  { key: 'delivery_order', label: 'Delivery Order' },
  { key: 'can_approve', label: 'Can Approve' },
  { key: 'registration_request', label: 'Registration' },
  { key: 'setting', label: 'Settings' },
];

export default function RoleDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const id = decodeURIComponent(String(params.id));
  const [role, setRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.user.permissions.setting) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/roles');
      if (res.ok) {
        const list: Role[] = await res.json();
        setRole(list.find((r) => r.role_id === id) || null);
      }
    } catch (error) {
      console.error('Error fetching role:', error);
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
        title={role?.role_name || id}
        subtitle={role?.role_id}
        isLoading={isLoading}
        notFound={!isLoading && !role}
        badges={role?.is_super_admin && <StatusBadge label="Super Admin" tone="orange" />}
      >
        {role && (
          <div className="space-y-4">
            <DetailSection title="Permissions">
              <div className="flex flex-wrap gap-2">
                {PERMISSION_LABELS.map((p) => (
                  <StatusBadge
                    key={p.key}
                    label={p.label}
                    tone={role.is_super_admin || role[p.key] ? 'green' : 'gray'}
                  />
                ))}
              </div>
              {role.is_super_admin && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  Super Admin selalu punya akses penuh ke semua modul, termasuk yang ditambahkan di masa depan — terlepas dari flag di atas.
                </p>
              )}
            </DetailSection>
            <DetailSection title="Riwayat">
              <ActivityLogView doctype="Role" documentId={role.role_id} />
            </DetailSection>
          </div>
        )}
      </DetailView>
    </DashboardLayout>
  );
}
