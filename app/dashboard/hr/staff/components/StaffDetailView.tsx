'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DetailView, DetailSection, FieldGrid, DetailTable } from '@/components/ui/DetailView';
import { StatusBadge } from '@/components/ui/ListView';
import ActivityLogView from '@/components/ui/ActivityLogView';
import AssignedToSection from '@/components/ui/AssignedToSection';
import AttachmentSection from '@/components/ui/AttachmentSection';
import { LeaveAttendance, StaffList } from '@/types';
import { countLeaveDays, countUsedLeaveDays } from '@/utils/attendance';
import { formatDate } from '@/lib/date';

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

export default function StaffDetailView({ id }: { id: string }) {
  const [staff, setStaff] = useState<StaffList | null>(null);
  const [leaves, setLeaves] = useState<LeaveAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
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

  const staffLeaves = staff
    ? leaves.filter((l) => l.employee === staff.user_id).sort((a, b) => b.from_date.localeCompare(a.from_date))
    : [];
  const quota = staff?.leave_allocation ?? 12;
  const used = staff ? countUsedLeaveDays(leaves, staff.user_id) : 0;
  const remaining = Math.max(0, quota - used);

  return (
    <DetailView
      backHref="/dashboard/hr/staff"
      backLabel="Staff"
      title={staff?.employee_name || id}
      subtitle={staff?.user_id}
      isLoading={isLoading}
      notFound={!isLoading && !staff}
      sidebar={
        staff && (
          <>
            <AssignedToSection doctype="Staff" documentId={staff.employee_id} />
            <DetailSection title="Riwayat">
              <ActivityLogView doctype="Staff" documentId={staff.employee_id} />
              <AttachmentSection doctype="Staff" documentId={staff.employee_id} />
            </DetailSection>
          </>
        )
      }
    >
      {staff && (
        <div className="space-y-4">
          <DetailSection title="Detail">
            <FieldGrid
              fields={[
                { label: 'Tanggal Lahir', value: staff.date_of_birth ? formatDate(staff.date_of_birth) : '-' },
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
                  <Link href={`/dashboard/hr/leave?id=${encodeURIComponent(l.id)}`} className="text-primary hover:underline">
                    {formatDate(l.from_date)}
                  </Link>
                ),
                to_date: formatDate(l.to_date),
                days: countLeaveDays(l),
                category: <StatusBadge label={CATEGORY_LABELS[l.leave_type] || l.leave_type} tone={CATEGORY_TONE[l.leave_type] || 'gray'} />,
                description: l.description || '-',
              }))}
            />
          </DetailSection>
        </div>
      )}
    </DetailView>
  );
}
