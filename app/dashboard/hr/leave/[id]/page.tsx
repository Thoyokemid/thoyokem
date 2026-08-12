'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import { DetailView, DetailSection, FieldGrid } from '@/components/ui/DetailView';
import { StatusBadge } from '@/components/ui/ListView';
import ActivityLogView from '@/components/ui/ActivityLogView';
import { LeaveAttendance, StaffList } from '@/types';
import { countLeaveDays, countUsedLeaveDays } from '@/utils/attendance';
import { generateLeaveLetterPDF } from '@/utils/leaveLetter';
import { AlertCircle, Download, FileText } from 'lucide-react';

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

export default function LeaveDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const id = decodeURIComponent(String(params.id));
  const [leave, setLeave] = useState<LeaveAttendance | null>(null);
  const [leaves, setLeaves] = useState<LeaveAttendance[]>([]);
  const [staff, setStaff] = useState<StaffList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.user.permissions.leave) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
    try {
      const [leaveRes, staffRes] = await Promise.all([fetch('/api/leave'), fetch('/api/staff')]);
      if (leaveRes.ok) {
        const list: LeaveAttendance[] = await leaveRes.json();
        setLeaves(list);
        setLeave(list.find((l) => l.id === id) || null);
      }
      if (staffRes.ok) setStaff(await staffRes.json());
    } catch (error) {
      console.error('Error fetching leave:', error);
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

  if (!session.user.permissions.leave) {
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

  const relatedStaff = leave ? staff.find((s) => s.user_id === leave.employee) : undefined;
  const quota = relatedStaff?.leave_allocation ?? 12;
  const usedDays = leave ? countUsedLeaveDays(leaves, leave.employee) : 0;
  const remaining = Math.max(0, quota - usedDays);
  const totalDays = leave ? countLeaveDays(leave) : 0;

  return (
    <DashboardLayout user={layoutUser}>
      <DetailView
        backHref="/dashboard/hr/leave"
        backLabel="Leave"
        title={leave?.employee_name || id}
        subtitle={leave ? `${leave.from_date} - ${leave.to_date}` : undefined}
        isLoading={isLoading}
        notFound={!isLoading && !leave}
        badges={leave && <StatusBadge label={CATEGORY_LABELS[leave.leave_type] || leave.leave_type} tone={CATEGORY_TONE[leave.leave_type] || 'gray'} />}
        actions={
          leave && (
            <Button variant="primary" onClick={() => generateLeaveLetterPDF(leave, { quota, usedDays })}>
              <Download size={14} className="mr-1.5" />Download Surat Cuti
            </Button>
          )
        }
      >
        {leave && (
          <div className="space-y-4">
            <DetailSection title="Detail">
              <FieldGrid
                fields={[
                  {
                    label: 'Karyawan',
                    value: relatedStaff ? (
                      <Link href={`/dashboard/hr/staff/${encodeURIComponent(relatedStaff.employee_id)}`} className="text-primary hover:underline">
                        {leave.employee_name}
                      </Link>
                    ) : leave.employee_name,
                  },
                  { label: 'Tanggal Mulai', value: leave.from_date },
                  { label: 'Tanggal Selesai', value: leave.to_date },
                  { label: 'Jumlah Hari', value: `${totalDays} hari` },
                  { label: 'Sisa Kuota Cuti', value: `${remaining} / ${quota} hari` },
                  { label: 'Keterangan', value: leave.description || '-' },
                ]}
              />
              {leave.attachment && (
                <a
                  href={leave.attachment}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1.5 mt-3"
                >
                  <FileText size={13} /> Lihat dokumen pendukung
                </a>
              )}
            </DetailSection>
            <DetailSection title="Riwayat">
              <ActivityLogView doctype="Leave" documentId={leave.id} />
            </DetailSection>
          </div>
        )}
      </DetailView>
    </DashboardLayout>
  );
}
