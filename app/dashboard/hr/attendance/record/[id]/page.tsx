'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { DetailView, DetailSection, FieldGrid } from '@/components/ui/DetailView';
import { AttendanceImport } from '@/types';
import { AlertCircle } from 'lucide-react';

export default function AttendanceRecordDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const id = decodeURIComponent(String(params.id));
  const [record, setRecord] = useState<AttendanceImport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.user.permissions.attendance) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/attendance');
      if (res.ok) {
        const list: AttendanceImport[] = await res.json();
        setRecord(list.find((r) => r.id === id || r.cloud_id === id) || null);
      }
    } catch (error) {
      console.error('Error fetching attendance record:', error);
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

  if (!session.user.permissions.attendance) {
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
        backHref="/dashboard/hr/attendance?tab=data"
        backLabel="Attendance Data"
        title={record?.employee_name || id}
        subtitle={record ? `${record.attendance_date} · ${record.jam_absensi || '-'}` : undefined}
        isLoading={isLoading}
        notFound={!isLoading && !record}
      >
        {record && (
          <DetailSection title="Detail">
            <FieldGrid
              fields={[
                { label: 'Nama', value: record.employee_name || '-' },
                { label: 'Tanggal', value: record.attendance_date || '-' },
                { label: 'Jam Absensi', value: record.jam_absensi || '-' },
                { label: 'Jam Set', value: record.jam_set || '-' },
                { label: 'Tipe', value: record.tipe_absensi || '-' },
                { label: 'Jabatan', value: record.designation || '-' },
                { label: 'Kantor', value: record.branch || '-' },
                { label: 'Verifikasi', value: record.verifikasi || '-' },
                { label: 'Keterangan', value: record.remarks || '-' },
              ]}
            />
          </DetailSection>
        )}
      </DetailView>
    </DashboardLayout>
  );
}
