'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import { DetailView, DetailSection, FieldGrid } from '@/components/ui/DetailView';
import { StatusBadge } from '@/components/ui/ListView';
import ActivityLogView from '@/components/ui/ActivityLogView';
import AttachmentSection from '@/components/ui/AttachmentSection';
import { Registration } from '@/types';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { formatDateTime } from '@/lib/date';

const STATUS_TONE: Record<string, 'orange' | 'green' | 'red'> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
};

export default function RegistrationDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const id = decodeURIComponent(String(params.id));
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session?.user.permissions.registration_request) fetchData();
    else setIsLoading(false);
  }, [session, id]);

  const fetchData = async () => {
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
        alert('Gagal memproses registrasi');
      }
    } catch (error) {
      console.error('Error updating registration:', error);
    } finally {
      setBusy(false);
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

  if (!session.user.permissions.registration_request) {
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
            <DetailSection title="Riwayat">
              <ActivityLogView doctype="Registration" documentId={registration.id} />
              <AttachmentSection doctype="Registration" documentId={registration.id} />
            </DetailSection>
          </div>
        )}
      </DetailView>
    </DashboardLayout>
  );
}
