'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { DetailView, DetailSection, FieldGrid } from '@/components/ui/DetailView';
import { StatusBadge } from '@/components/ui/ListView';
import ActivityLogView from '@/components/ui/ActivityLogView';
import AssignedToSection from '@/components/ui/AssignedToSection';
import AttachmentSection from '@/components/ui/AttachmentSection';
import { LeaveAttendance, StaffList } from '@/types';
import { countLeaveDays, countUsedLeaveDays } from '@/utils/attendance';
import { generateLeaveLetterPDF } from '@/utils/leaveLetter';
import { Download, FileText } from 'lucide-react';
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

export default function LeaveDetailView({ id }: { id: string }) {
  const [leave, setLeave] = useState<LeaveAttendance | null>(null);
  const [leaves, setLeaves] = useState<LeaveAttendance[]>([]);
  const [staff, setStaff] = useState<StaffList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
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

  const relatedStaff = leave ? staff.find((s) => s.user_id === leave.employee) : undefined;
  const quota = relatedStaff?.leave_allocation ?? 12;
  const usedDays = leave ? countUsedLeaveDays(leaves, leave.employee) : 0;
  const remaining = Math.max(0, quota - usedDays);
  const totalDays = leave ? countLeaveDays(leave) : 0;

  return (
    <DetailView
      backHref="/dashboard/hr/leave"
      backLabel="Leave"
      title={leave?.employee_name || id}
      subtitle={leave ? `${formatDate(leave.from_date)} - ${formatDate(leave.to_date)}` : undefined}
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
      sidebar={
        leave && (
          <>
            <AssignedToSection doctype="Leave" documentId={leave.id} />
            <DetailSection title="Riwayat">
              <ActivityLogView doctype="Leave" documentId={leave.id} />
              <AttachmentSection doctype="Leave" documentId={leave.id} />
            </DetailSection>
          </>
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
                    <Link href={`/dashboard/hr/staff?id=${encodeURIComponent(relatedStaff.employee_id)}`} className="text-primary hover:underline">
                      {leave.employee_name}
                    </Link>
                  ) : leave.employee_name,
                },
                { label: 'Tanggal Mulai', value: formatDate(leave.from_date) },
                { label: 'Tanggal Selesai', value: formatDate(leave.to_date) },
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
        </div>
      )}
    </DetailView>
  );
}
