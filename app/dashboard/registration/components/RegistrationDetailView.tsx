'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { DetailView, DetailSection, FieldGrid } from '@/components/ui/DetailView';
import { StatusBadge } from '@/components/ui/ListView';
import ActivityLogView from '@/components/ui/ActivityLogView';
import AssignedToSection from '@/components/ui/AssignedToSection';
import AttachmentSection from '@/components/ui/AttachmentSection';
import { Registration } from '@/types';
import { CheckCircle, XCircle } from 'lucide-react';
import { formatDateTime } from '@/lib/date';
import toast from 'react-hot-toast';

const STATUS_TONE: Record<string, 'orange' | 'green' | 'red'> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
};

export default function RegistrationDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/registration');
      if (res.ok) {
        const list: Registration[] = await res.json();
        setRegistration(list.find((r) => r.id === id) || null);
      }
    } catch (error) {
      console.error('Error fetching registration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (newStatus: 'approved' | 'rejected') => {
    setBusy(true);
    try {
      const res = await fetch('/api/registration', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        router.push('/dashboard/registration');
      } else {
        toast.error('Gagal memproses registrasi');
      }
    } catch (error) {
      console.error('Error updating registration:', error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DetailView
      backHref="/dashboard/registration"
      backLabel="Registration Requests"
      title={registration?.name || id}
      subtitle={registration?.email}
      isLoading={isLoading}
      notFound={!isLoading && !registration}
      badges={registration && <StatusBadge label={registration.status} tone={STATUS_TONE[registration.status] || 'gray'} />}
      actions={
        registration?.status === 'pending' && (
          <>
            <Button variant="success" disabled={busy} onClick={() => handleAction('approved')}>
              <CheckCircle size={14} className="mr-1.5" />Approve
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => handleAction('rejected')}>
              <XCircle size={14} className="mr-1.5" />Reject
            </Button>
          </>
        )
      }
      sidebar={
        registration && (
          <>
            <AssignedToSection doctype="Registration" documentId={registration.id} />
            <DetailSection title="Riwayat">
              <ActivityLogView doctype="Registration" documentId={registration.id} />
              <AttachmentSection doctype="Registration" documentId={registration.id} />
            </DetailSection>
          </>
        )
      }
    >
      {registration && (
        <div className="space-y-4">
          <DetailSection title="Detail">
            <FieldGrid
              fields={[
                { label: 'Nama', value: registration.name },
                { label: 'Email', value: registration.email },
                { label: 'Requested At', value: formatDateTime(registration.created_at) },
                { label: 'Last Updated', value: registration.update_at ? formatDateTime(registration.update_at) : '-' },
              ]}
            />
          </DetailSection>
        </div>
      )}
    </DetailView>
  );
}
