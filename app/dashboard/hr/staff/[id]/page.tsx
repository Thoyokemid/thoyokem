'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { DetailView, DetailSection, FieldGrid, DetailTable } from '@/components/ui/DetailView';
import { StatusBadge } from '@/components/ui/ListView';
import ActivityLogView from '@/components/ui/ActivityLogView';
import { LeaveAttendance, StaffList } from '@/types';
import { countLeaveDays, countUsedLeaveDays } from '@/utils/attendance';
import { AlertCircle } from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  sick: 'Sick Leave',
  annual: 'Annual Leave',
  personal: 'Personal Leave',
  emergency: 'Emergency Leave',
};

const CATEGORY_TONE: Record<string, 'red' | 'blue' | 'purple' | 'orange'> = {
  sick: 'red',
  annual: 'blue',
  personal: 'purple',
  emergency: 'orange',
};

export default function StaffDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const id = decodeURIComponent(String(params.id));
  const [staff, setStaff] = useState<StaffList | null>(null);
  const [leaves, setLeaves] = useState<LeaveAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.user.permissions.staff) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const [staffRes, leaveRes] = await Promise.all([fetch('/api/staff'), fetch('/api/leave')]);
      if (staffRes.ok) {
        const list: StaffList[] = await staffRes.json();
        setStaff(list.find((s) => s.employee_id === id) || null);
      }
      if (leaveRes.ok) setLeaves(await leaveRes.json());
    } catch (error) {
      console.error('Error fetching staff:', error);
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

  if (!session.user.permissions.staff) {
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

  const staffLeaves = staff
    ? leaves.filter((l) => l.employee === staff.user_id).sort((a, b) => b.from_date.localeCompare(a.from_date))
    : [];
  const quota = staff?.leave_allocation ?? 12;
  const used = staff ? countUsedLeaveDays(leaves, staff.user_id) : 0;
  const remaining = Math.max(0, quota - used);

  return (
    <DashboardLayout user={layoutUser}>
      <DetailView
        backHref="/dashboard/hr/staff"
        backLabel="Staff"
        title={staff?.employee_name || id}
        subtitle={staff?.user_id}
        isLoading={isLoading}
        notFound={!isLoading && !staff}
      >
        {staff && (
          <div className="space-y-4">
            <DetailSection title="Detail">
              <FieldGrid
                fields={[
                  { label: 'Tanggal Lahir', value: staff.date_of_birth || '-' },
                  { label: 'Kuota Cuti', value: `${quota} hari/tahun` },
                  { label: 'Sisa Kuota', value: `${remaining} / ${quota} hari` },
                ]}
              />
            </DetailSection>
            <DetailSection title={`Riwayat Cuti (${staffLeaves.length})`}>
              <DetailTable
                columns={[
                  { key: 'from_date', header: 'Dari' },
                  { key: 'to_date', header: 'Sampai' },
                  { key: 'days', header: 'Hari', align: 'right' },
                  { key: 'category', header: 'Kategori' },
                  { key: 'description', header: 'Keterangan' },
                ]}
                rows={staffLeaves.map((l) => ({
                  from_date: (
                    <Link href={`/dashboard/hr/leave/${encodeURIComponent(l.id)}`} className="text-primary hover:underline">
                      {l.from_date}
                    </Link>
                  ),
                  to_date: l.to_date,
                  days: countLeaveDays(l),
                  category: <StatusBadge label={CATEGORY_LABELS[l.leave_type] || l.leave_type} tone={CATEGORY_TONE[l.leave_type] || 'gray'} />,
                  description: l.description || '-',
                }))}
              />
            </DetailSection>
            <DetailSection title="Riwayat">
              <ActivityLogView doctype="Staff" documentId={staff.employee_id} />
            </DetailSection>
          </div>
        )}
      </DetailView>
    </DashboardLayout>
  );
}
